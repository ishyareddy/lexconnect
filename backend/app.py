import suppress_warnings

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

from pydantic import BaseModel
from typing import Dict, Optional

from sqlalchemy.orm import Session
from hashlib import sha256

from .database import (
    init_db, get_db, Case, CaseStatus, LawyerRecommendation,
    RecommendationStatus, User, UserRole, LawyerProfile, ActiveCase
)

from .intake_agent import IntakeAgent
from .rag_slm import CivilRAGSLM
from .router_agent import RouterAgent
from .lawyer_agent import LawyerAgent


# ---------------------------------------------------------------------------
# The only civil case types this platform handles
# ---------------------------------------------------------------------------
CIVIL_CASE_TYPES = {
    "property":    "Property Disputes & Rent",
    "family":      "Marriage, Divorce & Maintenance",
    "custody":     "Child Custody & Adoption",
    "consumer":    "Consumer Rights & Contracts",
    "inheritance": "Inheritance & Wills",
}

app = FastAPI(title="LexConnect - Legal RAG + Lawyer Matching")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# SYSTEM INIT
# -----------------------------

init_db()

intake = IntakeAgent()
rag = CivilRAGSLM()
router = RouterAgent()
lawyer_agent = LawyerAgent()


# -----------------------------
# MODELS
# -----------------------------

class CaseInput(BaseModel):
    case_text: str
    client_id: int


class NewCaseInput(BaseModel):
    title: str
    description: str = ""
    case_type: str = "property"  # must be a key in CIVIL_CASE_TYPES


class ChatInput(BaseModel):
    message: str
    use_case_context: bool = False
    case_id: Optional[int] = None  # if set, loads this case from DB as context


class RegisterInput(BaseModel):
    name: str
    email: str
    password: str
    role: str


class StatusUpdate(BaseModel):
    status: str


# -----------------------------
# HELPERS
# -----------------------------

def get_user_from_header(authorization: Optional[str], db: Session) -> Optional[User]:
    """
    Simple token auth: token is just the user_id stored as a string.
    Replace this with JWT if you add python-jose later.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_id = int(token)
        return db.query(User).filter(User.id == user_id).first()
    except (ValueError, TypeError):
        return None


# -----------------------------
# ROOT
# -----------------------------

@app.get("/")
def root():
    return {"message": "LexConnect API running"}


# -----------------------------
# AUTH
# -----------------------------

@app.post("/register")
def register(payload: RegisterInput, db: Session = Depends(get_db)):

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email already exists")

    if payload.role not in ("client", "lawyer"):
        raise HTTPException(400, "Role must be 'client' or 'lawyer'")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=sha256(payload.password.encode()).hexdigest(),
        role=UserRole(payload.role)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if payload.role == "lawyer":
        profile = LawyerProfile(
            user_id=user.id,
            specialization="General",
            city="Unknown",
            experience_years=0,
            rating=0
        )
        db.add(profile)
        db.commit()

    return {
        "status": "registered",
        "user_id": user.id,
        "role": user.role.value
    }


@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    hashed = sha256(form_data.password.encode()).hexdigest()
    if user.password_hash != hashed:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # We use user_id as the bearer token (simple, no JWT dependency needed)
    return {
        "access_token": str(user.id),
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "role": user.role.value
    }


# -----------------------------
# CHATBOT  ← THIS IS WHAT THE FRONTEND CALLS
# -----------------------------

@app.post("/chat")
def chat(
    payload: ChatInput,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Frontend sends: { "message": "...", "use_case_context": false, "case_id": 4 }
    Returns:        { "answer": "...", "retrieved_count": 0 }
    """
    ctx = None

    # 1. If a specific case_id is provided, load it from the DB
    if payload.case_id is not None:
        case = db.query(Case).filter(Case.id == payload.case_id).first()
        if case:
            ctx = (
                "CLIENT FACTS – DO NOT ALTER.\n"
                f"Issue Type: {case.issue_type}\n"
                f"Description: {case.description}\n"
            )
        # If case not found, fall through gracefully

    # 2. Fallback: use in-memory intake context if flag is set
    elif payload.use_case_context:
        ctx = intake.get_case_context()

    try:
        result = rag.answer(payload.message, case_context=ctx)
        return {
            "answer": result["answer"],
            "retrieved_count": result.get("retrieved_count", 0)
        }
    except Exception as e:
        return {
            "answer": f"The AI assistant encountered an error: {str(e)[:200]}",
            "retrieved_count": 0
        }


# -----------------------------
# CASE MANAGEMENT
# -----------------------------

@app.post("/caseintake")
def intake_case(payload: CaseInput, db: Session = Depends(get_db)):
    details = intake.extract_case_details(payload.case_text)
    case_id = intake.store_case_details(db, details, client_id=payload.client_id)
    return {
        "status": "case_saved",
        "case_id": case_id,
        "issue_type": details["issue_type"]
    }


@app.get("/cases/types")
def get_case_types():
    """Frontend fetches this to populate the case type dropdown."""
    return [{"value": k, "label": v} for k, v in CIVIL_CASE_TYPES.items()]


@app.post("/cases")
def create_case(
    payload: NewCaseInput,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Frontend new-case form calls this.
    Requires Authorization: Bearer {user_id} header.
    """
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated — make sure the Bearer token is being sent in the Authorization header."
        )
    if user.role != UserRole.client:
        raise HTTPException(403, "Only clients can file cases")

    # Normalise and validate case type
    case_type_key = payload.case_type.lower().strip()
    if case_type_key not in CIVIL_CASE_TYPES:
        # Fuzzy match e.g. "Property" -> "property", "Marriage" -> "family"
        mapping = {
            "property": "property", "rent": "property", "real estate": "property",
            "marriage": "family", "divorce": "family", "maintenance": "family",
            "custody": "custody", "adoption": "custody", "child": "custody",
            "consumer": "consumer", "contract": "consumer", "cheque": "consumer",
            "inheritance": "inheritance", "will": "inheritance", "succession": "inheritance",
        }
        for fragment, key in mapping.items():
            if fragment in case_type_key:
                case_type_key = key
                break
        else:
            case_type_key = "property"  # safe default

    description_full = f"{payload.title}\n\n{payload.description}".strip()

    case = Case(
        client_id=user.id,
        issue_type=case_type_key,
        description=description_full,
        status=CaseStatus.open
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    # Auto-generate lawyer recommendations
    try:
        lawyers = router.get_top_lawyers(db, case.issue_type)
        if lawyers:
            router.create_recommendations(db, case.id, lawyers)
    except Exception:
        pass  # Non-fatal

    return {
        "status": "case_saved",
        "case_id": case.id,
        "issue_type": case_type_key,
        "label": CIVIL_CASE_TYPES[case_type_key]
    }


@app.get("/cases")
def get_cases(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Returns all cases for the logged-in client."""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    cases = db.query(Case).filter(Case.client_id == user.id).all()

    result = []
    for c in cases:
        # Find assigned lawyer name if any active case record exists
        active = db.query(ActiveCase).filter(
            ActiveCase.case_id == c.id,
            ActiveCase.status == "active"
        ).first()
        lawyer_name = None
        if active and active.lawyer and active.lawyer.user:
            lawyer_name = active.lawyer.user.name

        result.append({
            "id": c.id,
            "title": c.description.split("\n")[0] if "\n" in c.description else c.description[:60],
            "description": c.description,
            "case_type": c.issue_type,
            "status": c.status.value.capitalize() if hasattr(c.status, 'value') else str(c.status),
            "assigned_lawyer": lawyer_name,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })

    return result


@app.patch("/cases/{case_id}/status")
def update_case_status(
    case_id: int,
    payload: StatusUpdate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Lawyer accepts/declines/resolves a case."""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    status_map = {
        "In Progress": CaseStatus.matched,
        "Resolved": CaseStatus.closed,
        "Rejected": CaseStatus.open,   # re-open so client can find another lawyer
        "Pending": CaseStatus.open,
    }
    new_status = status_map.get(payload.status)
    if new_status:
        case.status = new_status
        db.commit()

    return {"status": "updated", "case_id": case_id}


# -----------------------------
# LAWYER MATCHING
# -----------------------------

@app.post("/cases/{case_id}/recommendations")
def get_recommendations(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    lawyers = router.get_top_lawyers(db, case.issue_type)
    rec_ids = router.create_recommendations(db, case_id, lawyers)

    return {
        "case_id": case_id,
        "recommendations": lawyers,
        "rec_ids": rec_ids
    }


@app.get("/lawyers")
def list_lawyers(db: Session = Depends(get_db)):
    """Frontend LawyerRecommendations component calls this."""
    profiles = db.query(LawyerProfile).filter(LawyerProfile.is_available == 1).all()
    return [
        {
            "id": p.id,
            "name": p.user.name if p.user else "Unknown",
            "specialization": p.specialization,
            "city": p.city,
            "experience": p.experience_years,
            "rating": p.rating or 0,
        }
        for p in profiles
    ]


@app.post("/request-lawyer")
def request_lawyer(
    payload: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Client requests a specific lawyer for a specific case."""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    lawyer_id = payload.get("lawyer_id")
    if not lawyer_id:
        raise HTTPException(400, "lawyer_id required")

    # Use case_id from payload if provided, otherwise fall back to most recent open case
    case_id = payload.get("case_id")
    if case_id:
        case = db.query(Case).filter(
            Case.id == case_id,
            Case.client_id == user.id
        ).first()
        if not case:
            raise HTTPException(404, "Case not found or not yours")
    else:
        case = db.query(Case).filter(
            Case.client_id == user.id,
            Case.status == CaseStatus.open
        ).order_by(Case.created_at.desc()).first()
        if not case:
            raise HTTPException(404, "No open case found. File a case first.")

    # Check if recommendation already exists
    existing = db.query(LawyerRecommendation).filter(
        LawyerRecommendation.case_id == case.id,
        LawyerRecommendation.lawyer_id == lawyer_id
    ).first()

    if existing:
        existing.status = RecommendationStatus.client_accepted
        db.commit()
        return {"status": "request_updated", "rec_id": existing.id}

    rec = LawyerRecommendation(
        case_id=case.id,
        lawyer_id=lawyer_id,
        score=50,
        status=RecommendationStatus.client_accepted
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {"status": "requested", "rec_id": rec.id}


@app.post("/recommendations/{rec_id}/client-accept")
def client_accept(rec_id: int, db: Session = Depends(get_db)):
    rec = db.query(LawyerRecommendation).filter(LawyerRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(404)
    rec.status = RecommendationStatus.client_accepted
    db.commit()
    return {"status": "client_accepted"}


@app.post("/recommendations/{rec_id}/lawyer-accept")
def lawyer_accept(rec_id: int, db: Session = Depends(get_db)):
    active = lawyer_agent.accept_case(db, rec_id)
    if not active:
        raise HTTPException(404)
    return {"status": "case_activated"}


# -----------------------------
# LAWYER DASHBOARD
# -----------------------------

@app.get("/lawyer/cases")
def lawyer_cases(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Returns all cases assigned/requested to this lawyer.
    Used by LawyerCaseRequests component.
    """
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if user.role != UserRole.lawyer:
        raise HTTPException(403, "Lawyers only")

    profile = db.query(LawyerProfile).filter(LawyerProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(404, "Lawyer profile not found")

    recs = db.query(LawyerRecommendation).filter(
        LawyerRecommendation.lawyer_id == profile.id
    ).all()

    result = []
    for r in recs:
        c = r.case
        if not c:
            continue

        # Map internal status → frontend display status
        if r.status == RecommendationStatus.client_accepted:
            display_status = "Pending"
        elif r.status == RecommendationStatus.lawyer_accepted:
            display_status = "In Progress"
        elif r.status == RecommendationStatus.declined:
            display_status = "Rejected"
        elif c.status == CaseStatus.closed:
            display_status = "Resolved"
        else:
            display_status = "Pending"

        client = db.query(User).filter(User.id == c.client_id).first()

        result.append({
            "id": r.id,
            "case_id": c.id,
            "title": c.description.split("\n")[0] if "\n" in c.description else c.description[:60],
            "description": c.description,
            "case_type": c.issue_type,
            "status": display_status,
            "client_name": client.name if client else "Unknown Client",
        })

    return result


@app.get("/lawyer/active-cases")
def lawyer_active_cases(lawyer_id: int, db: Session = Depends(get_db)):
    cases = lawyer_agent.get_active_cases(db, lawyer_id)
    return [
        {
            "case_id": c.case_id,
            "issue_type": c.case.issue_type,
            "description": c.case.description
        }
        for c in cases
    ]


@app.get("/lawyer/requests")
def lawyer_requests(lawyer_id: int, db: Session = Depends(get_db)):
    reqs = lawyer_agent.get_pending_requests(db, lawyer_id)
    return [
        {
            "rec_id": r.id,
            "case_id": r.case_id,
            "issue_type": r.case.issue_type,
            "description": r.case.description
        }
        for r in reqs
    ]


# -----------------------------
# HEALTH
# -----------------------------

@app.get("/health")
def health():
    return {"status": "LexConnect running"}
import suppress_warnings

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

from pydantic import BaseModel
from typing import Dict

from sqlalchemy.orm import Session
from hashlib import sha256

from .database import (
    init_db, get_db, Case, LawyerRecommendation,
    RecommendationStatus, User, UserRole, LawyerProfile
)

from .intake_agent import IntakeAgent
from .rag_slm import CivilRAGSLM
from .router_agent import RouterAgent
from .lawyer_agent import LawyerAgent


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


class ChatInput(BaseModel):
    message: str
    use_case_context: bool = False


class RegisterInput(BaseModel):
    name: str
    email: str
    password: str
    role: str


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
        "role": user.role
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

    return {
        "user_id": user.id,
        "role": user.role
    }


# -----------------------------
# CHATBOT
# -----------------------------

@app.post("/chat")
def chat(payload: ChatInput) -> Dict:

    ctx = intake.get_case_context() if payload.use_case_context else None

    result = rag.answer(payload.message, case_context=ctx)

    return {
        "answer": result["answer"],
        "retrieved_count": result.get("retrieved_count", 0)
    }


# -----------------------------
# CASE MANAGEMENT
# -----------------------------

@app.post("/caseintake")
def intake_case(payload: CaseInput, db: Session = Depends(get_db)):

    details = intake.extract_case_details(payload.case_text)

    case_id = intake.store_case_details(
        db,
        details,
        client_id=payload.client_id
    )

    return {
        "status": "case_saved",
        "case_id": case_id,
        "issue_type": details["issue_type"]
    }


@app.get("/cases")
def get_cases(client_id: int, db: Session = Depends(get_db)):

    cases = db.query(Case).filter(Case.client_id == client_id).all()

    return [
        {
            "id": c.id,
            "issue_type": c.issue_type,
            "description": c.description
        }
        for c in cases
    ]


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


@app.post("/recommendations/{rec_id}/client-accept")
def client_accept(rec_id: int, db: Session = Depends(get_db)):

    rec = db.query(LawyerRecommendation).filter(
        LawyerRecommendation.id == rec_id
    ).first()

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
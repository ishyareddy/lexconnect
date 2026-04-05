import suppress_warnings

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime

from pydantic import BaseModel
from typing import Dict, Optional

from sqlalchemy.orm import Session
from hashlib import sha256

from .database import (
    init_db, get_db, Case, CaseStatus, LawyerRecommendation,
    RecommendationStatus, User, UserRole, LawyerProfile, ActiveCase,
    Message, VideoCall, CallSession
)

from .intake_agent import IntakeAgent
from .rag_slm import CivilRAGSLM
from .router_agent import RouterAgent
from .lawyer_agent import LawyerAgent


# ---------------------------------------------------------------------------
# The only civil case types this platform handles
# ---------------------------------------------------------------------------
CIVIL_CASE_TYPES = {
    "property": "Property Disputes & Rent",
    "family": "Marriage, Divorce & Maintenance",
    "custody": "Child Custody & Adoption",
    "consumer": "Consumer Rights & Contracts",
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
    case_type: str = "property"


class ChatInput(BaseModel):
    message: str
    use_case_context: bool = False
    case_id: Optional[int] = None


class RegisterInput(BaseModel):
    name: str
    email: str
    password: str
    role: str
    location: str = ""
    lawyer_type: Optional[str] = None


class StatusUpdate(BaseModel):
    status: str


class MessageInput(BaseModel):
    recipient_id: int
    content: str
    case_id: Optional[int] = None


class InitiateCallInput(BaseModel):
    recipient_id: int
    case_id: int


class UpdateCallStatusInput(BaseModel):
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

    # Validate lawyer_type if registering as lawyer
    LAWYER_TYPES = ["Property Disputes & Rent", "Marriage, Divorce & Maintenance", "Child Custody & Adoption", "Consumer Rights & Contracts", "Inheritance & Wills"]
    if payload.role == "lawyer" and payload.lawyer_type:
        if payload.lawyer_type not in LAWYER_TYPES:
            raise HTTPException(400, f"Invalid lawyer_type. Must be one of: {', '.join(LAWYER_TYPES)}")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=sha256(payload.password.encode()).hexdigest(),
        role=UserRole(payload.role),
        location=payload.location or ""
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if payload.role == "lawyer":
        profile = LawyerProfile(
            user_id=user.id,
            specialization="General",
            lawyer_type=payload.lawyer_type or "General",
            city=payload.location or "Unknown",
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

    response = {
        "access_token": str(user.id),
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "role": user.role.value,
        "location": user.location or ""
    }
    
    # Add lawyer-specific fields if role is lawyer
    if user.role == UserRole.lawyer:
        lawyer_profile = db.query(LawyerProfile).filter(LawyerProfile.user_id == user.id).first()
        if lawyer_profile:
            response["lawyer_type"] = lawyer_profile.lawyer_type
            response["city"] = lawyer_profile.city

    return response


# -----------------------------
# CHATBOT
# -----------------------------

@app.post("/chat")
def chat(
    payload: ChatInput,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Frontend sends: { "message": "...", "use_case_context": false, "case_id": 4 }
    Returns: { "answer": "...", "retrieved_count": 0 }
    """
    ctx = None

    if payload.case_id is not None:
        case = db.query(Case).filter(Case.id == payload.case_id).first()
        if case:
            ctx = (
                "CLIENT FACTS – DO NOT ALTER.\n"
                f"Issue Type: {case.issue_type}\n"
                f"Description: {case.description}\n"
            )
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
    return [{"value": k, "label": v} for k, v in CIVIL_CASE_TYPES.items()]


@app.post("/cases")
def create_case(
    payload: NewCaseInput,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated — make sure the Bearer token is being sent in the Authorization header."
        )

    if user.role != UserRole.client:
        raise HTTPException(403, "Only clients can file cases")

    case_type_key = payload.case_type.lower().strip()
    if case_type_key not in CIVIL_CASE_TYPES:
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
            case_type_key = "property"

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

    try:
        client = db.query(User).filter(User.id == user.id).first()
        client_location = client.location if client else ""
        lawyers = router.get_top_lawyers(db, case.issue_type, client_location)
        if lawyers:
            router.create_recommendations(db, case.id, lawyers)
    except Exception:
        pass

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
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    cases = db.query(Case).filter(Case.client_id == user.id).all()

    result = []
    for c in cases:
        active = db.query(ActiveCase).filter(
            ActiveCase.case_id == c.id,
            ActiveCase.status == "active"
        ).first()

        lawyer_name = None
        lawyer_id = None
        if active and active.lawyer and active.lawyer.user:
            lawyer_name = active.lawyer.user.name
            lawyer_id = active.lawyer.user.id

        result.append({
            "id": c.id,
            "title": c.description.split("\n")[0] if "\n" in c.description else c.description[:60],
            "description": c.description,
            "case_type": c.issue_type,
            "status": c.status.value.capitalize() if hasattr(c.status, "value") else str(c.status),
            "assigned_lawyer": lawyer_name,
            "assigned_lawyer_id": lawyer_id,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })

    return result

@app.delete("/cases/{case_id}")
def delete_case(
    case_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if user.role != UserRole.client:
        raise HTTPException(403, "Only clients can delete cases")

    case = db.query(Case).filter(
        Case.id == case_id,
        Case.client_id == user.id
    ).first()

    if not case:
        raise HTTPException(404, "Case not found")

    db.query(LawyerRecommendation).filter(
        LawyerRecommendation.case_id == case.id
    ).delete()

    db.query(ActiveCase).filter(
        ActiveCase.case_id == case.id
    ).delete()

    db.delete(case)
    db.commit()

    return {"status": "deleted", "case_id": case_id}

@app.patch("/cases/{case_id}/status")
def update_case_status(
    case_id: int,
    payload: StatusUpdate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    if user.role != UserRole.lawyer:
        raise HTTPException(403, "Lawyers only")

    result = lawyer_agent.update_case_status(db, case_id, user.id, payload.status)
    if not result:
        raise HTTPException(404, "Case or lawyer assignment not found")

    return {"status": "updated", "case_id": case_id, "action": payload.status}


# -----------------------------
# LAWYER MATCHING
# -----------------------------

@app.post("/cases/{case_id}/recommendations")
def get_recommendations(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    client = db.query(User).filter(User.id == case.client_id).first()
    client_location = client.location if client else ""
    lawyers = router.get_top_lawyers(db, case.issue_type, client_location)
    rec_ids = router.create_recommendations(db, case_id, lawyers)

    return {
        "case_id": case_id,
        "recommendations": lawyers,
        "rec_ids": rec_ids
    }


@app.get("/lawyers")
def list_lawyers(db: Session = Depends(get_db)):
    profiles = db.query(LawyerProfile).filter(LawyerProfile.is_available == 1).all()
    return [
        {
            "id": p.id,
            "name": p.user.name if p.user else "Unknown",
            "specialization": p.specialization,
            "lawyer_type": p.lawyer_type,
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

    # Block duplicate only for the same case
    already = db.query(LawyerRecommendation).filter(
        LawyerRecommendation.case_id == case.id,
        LawyerRecommendation.lawyer_id == lawyer_id,
        LawyerRecommendation.status == RecommendationStatus.client_accepted
    ).first()
    if already:
        raise HTTPException(409, "You have already sent a request to this lawyer for this case.")
    existing = db.query(LawyerRecommendation).filter(
        LawyerRecommendation.case_id == case.id,
        LawyerRecommendation.lawyer_id == lawyer_id
    ).first()

    if existing:
        existing.status = RecommendationStatus.client_accepted
        db.commit()
        return {
            "status": "requested",
            "rec_id": existing.id,
            "case_id": case.id,
            "lawyer_id": lawyer_id
        }

    rec = LawyerRecommendation(
        case_id=case.id,
        lawyer_id=lawyer_id,
        score=50,
        status=RecommendationStatus.client_accepted
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return {
        "status": "requested",
        "rec_id": rec.id,
        "case_id": case.id,
        "lawyer_id": lawyer_id
    }


@app.get("/my-requests")
def my_requests(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Returns case-specific lawyer requests for the logged-in client.
    """
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    rows = (
        db.query(LawyerRecommendation.case_id, LawyerRecommendation.lawyer_id)
        .join(Case, LawyerRecommendation.case_id == Case.id)
        .filter(
            Case.client_id == user.id,
            LawyerRecommendation.status == RecommendationStatus.client_accepted,
        )
        .all()
    )

    return {
        "requested_pairs": [
            {"case_id": row.case_id, "lawyer_id": row.lawyer_id}
            for row in rows
        ]
    }


@app.post("/recommendations/{rec_id}/client-accept")
def client_accept(rec_id: int, db: Session = Depends(get_db)):
    rec = db.query(LawyerRecommendation).filter(LawyerRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(404)

    rec.status = RecommendationStatus.client_accepted
    db.commit()
    return {"status": "client_accepted"}


@app.post("/recommendations/{rec_id}/lawyer-accept")
def lawyer_accept(
    rec_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    if user.role != UserRole.lawyer:
        raise HTTPException(403, "Lawyers only")

    active = lawyer_agent.accept_case(db, rec_id)
    if not active:
        raise HTTPException(404, "Recommendation not found")

    return {"status": "case_activated"}


# -----------------------------
# LAWYER DASHBOARD
# -----------------------------

@app.get("/lawyer/cases")
def lawyer_cases(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    if user.role != UserRole.lawyer:
        raise HTTPException(403, "Lawyers only")

    return lawyer_agent.get_lawyer_cases(db, user.id)


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


@app.get("/lawyer/audit-log")
def lawyer_audit_log(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    if user.role != UserRole.lawyer:
        raise HTTPException(403, "Lawyers only")

    return lawyer_agent.get_audit_log()


# ─────────────────────────────────────────────────────────────────────────────
# MESSAGING
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/messages/send")
def send_message(
    payload: MessageInput,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Send a message between lawyer and client"""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    recipient = db.query(User).filter(User.id == payload.recipient_id).first()
    if not recipient:
        raise HTTPException(404, "Recipient not found")

    message = Message(
        sender_id=user.id,
        recipient_id=payload.recipient_id,
        content=payload.content,
        case_id=payload.case_id
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    return {
        "id": message.id,
        "sender_id": message.sender_id,
        "sender_name": user.name,
        "recipient_id": message.recipient_id,
        "content": message.content,
        "case_id": message.case_id,
        "is_read": message.is_read,
        "created_at": message.created_at.isoformat()
    }


@app.get("/messages/conversation/{other_user_id}")
def get_conversation(
    other_user_id: int,
    case_id: Optional[int] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get message history between current user and another user"""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    query = db.query(Message).filter(
        ((Message.sender_id == user.id) & (Message.recipient_id == other_user_id)) |
        ((Message.sender_id == other_user_id) & (Message.recipient_id == user.id))
    )

    if case_id:
        query = query.filter(Message.case_id == case_id)

    messages = query.order_by(Message.created_at.asc()).all()

    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.name,
            "recipient_id": m.recipient_id,
            "content": m.content,
            "case_id": m.case_id,
            "is_read": m.is_read,
            "created_at": m.created_at.isoformat()
        }
        for m in messages
    ]


@app.get("/messages/unread")
def get_unread_messages(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get count of unread messages for current user"""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    unread = db.query(Message).filter(
        Message.recipient_id == user.id,
        Message.is_read == 0
    ).all()

    # Mark as read
    for msg in unread:
        msg.is_read = 1
    db.commit()

    return {
        "unread_count": len(unread),
        "messages": [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_name": m.sender.name,
                "content": m.content,
                "case_id": m.case_id,
                "created_at": m.created_at.isoformat()
            }
            for m in unread
        ]
    }


@app.get("/messages/recent-conversations")
def get_recent_conversations(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get list of recent conversations for the current user"""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    from sqlalchemy import func, or_

    # Get distinct other users in conversations
    recent = db.query(
        func.max(Message.id).label("latest_id")
    ).filter(
        or_(
            Message.sender_id == user.id,
            Message.recipient_id == user.id
        )
    ).group_by(
        func.case(
            (Message.sender_id == user.id, Message.recipient_id),
            else_=Message.sender_id
        )
    ).order_by(func.max(Message.created_at).desc()).all()

    conversations = []
    for row in recent:
        msg = db.query(Message).filter(Message.id == row.latest_id).first()
        if msg:
            other_user = msg.sender if msg.sender_id != user.id else msg.recipient
            conversations.append({
                "user_id": other_user.id,
                "user_name": other_user.name,
                "last_message": msg.content[:100],
                "last_message_at": msg.created_at.isoformat()
            })

    return conversations


# ─────────────────────────────────────────────────────────────────────────────
# VIDEO CALLS (Jitsi Integration)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/calls/initiate")
def initiate_video_call(
    payload: InitiateCallInput,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Initiate a video call between lawyer and client"""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    recipient = db.query(User).filter(User.id == payload.recipient_id).first()
    if not recipient:
        raise HTTPException(404, "Recipient not found")

    case = db.query(Case).filter(Case.id == payload.case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    # Create unique room name for Jitsi
    room_name = f"lexconnect-case{payload.case_id}-{user.id}-{payload.recipient_id}"

    # Check if there's already an active call
    existing = db.query(VideoCall).filter(
        VideoCall.case_id == payload.case_id,
        VideoCall.status == CallSession.active
    ).first()

    if existing:
        return {
            "call_id": existing.id,
            "room_name": existing.room_name,
            "status": existing.status.value
        }

    call = VideoCall(
        case_id=payload.case_id,
        initiator_id=user.id,
        recipient_id=payload.recipient_id,
        room_name=room_name,
        status=CallSession.initiating
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    return {
        "call_id": call.id,
        "room_name": call.room_name,
        "status": call.status.value,
        "jitsi_server": "https://meet.jit.si"
    }


@app.patch("/calls/{call_id}/status")
def update_call_status(
    call_id: int,
    payload: UpdateCallStatusInput,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Update video call status (active, completed, declined)"""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    call = db.query(VideoCall).filter(VideoCall.id == call_id).first()
    if not call:
        raise HTTPException(404, "Call not found")

    if payload.status == "active":
        call.status = CallSession.active
        call.started_at = datetime.utcnow()
    elif payload.status == "completed":
        call.status = CallSession.completed
        call.ended_at = datetime.utcnow()
    elif payload.status == "declined":
        call.status = CallSession.declined
        call.ended_at = datetime.utcnow()

    db.commit()
    return {"status": call.status.value}


@app.get("/calls/active/{case_id}")
def get_active_call(
    case_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get active call for a case"""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    call = db.query(VideoCall).filter(
        VideoCall.case_id == case_id,
        VideoCall.status == CallSession.active
    ).first()

    if not call:
        return {"call": None}

    return {
        "call": {
            "id": call.id,
            "room_name": call.room_name,
            "status": call.status.value,
            "initiator_id": call.initiator_id,
            "recipient_id": call.recipient_id
        }
    }


@app.get("/calls/pending")
def get_pending_calls(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get pending incoming calls for current user"""
    user = get_user_from_header(authorization, db)
    if not user:
        raise HTTPException(401, "Not authenticated")

    calls = db.query(VideoCall).filter(
        VideoCall.recipient_id == user.id,
        VideoCall.status == CallSession.initiating
    ).all()

    return [
        {
            "call_id": c.id,
            "room_name": c.room_name,
            "initiator_id": c.initiator_id,
            "initiator_name": c.initiator.name,
            "case_id": c.case_id,
            "created_at": c.created_at.isoformat()
        }
        for c in calls
    ]


# -----------------------------
# HEALTH
# -----------------------------

@app.get("/health")
def health():
    return {"status": "LexConnect running"}
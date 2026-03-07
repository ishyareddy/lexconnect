# intake_agent.py
import re
from typing import Optional, Dict
from sqlalchemy.orm import Session
from .database import Case, CaseStatus


class IntakeAgent:
    """
    Very lightweight intake agent:
    - Detects high-level issue type from free text.
    - Stores a Case row in the DB.
    - Can generate a context string for RAG/chat.
    """

    def __init__(self):
        self._last_case: Optional[Dict] = None

    def _detect_issue_type(self, text: str) -> str:
        t = text.lower()

        CONTRACT = ["contract", "agreement", "breach", "payment", "advance", "construction", "tender"]
        PROPERTY = ["land", "plot", "property", "encroachment", "boundary", "possession", "injunction"]
        FAMILY = ["divorce", "maintenance", "custody", "domestic violence"]
        TORT = ["negligence", "accident", "damages", "defamation"]
        CONSUMER = ["defective", "refund", "consumer", "service deficiency"]
        TENANCY = ["tenant", "rent", "eviction", "lease"]

        if any(k in t for k in CONTRACT): return "contract"
        if any(k in t for k in PROPERTY): return "property"
        if any(k in t for k in TENANCY): return "tenancy"
        if any(k in t for k in CONSUMER): return "consumer"
        if any(k in t for k in TORT): return "tort"
        if any(k in t for k in FAMILY): return "family"

        return "general_civil"



    def extract_case_details(self, text: str) -> Dict:
        issue_type = self._detect_issue_type(text)
        details = {
            "issue_type": issue_type,
            "raw_description": text.strip(),
        }
        self._last_case = details
        return details

    def store_case_details(self, db: Session, details: Dict, client_id: Optional[int] = None) -> int:
        """
        Persist the case in SQL and return the new case_id.
        """
        case = Case(
            client_id=client_id,
            issue_type=details["issue_type"],
            description=details["raw_description"],
            status=CaseStatus.open,
        )
        db.add(case)
        db.commit()
        db.refresh(case)

        details_with_id = dict(details)
        details_with_id["case_id"] = case.id
        self._last_case = details_with_id
        return case.id

    def get_case_context(self) -> Optional[str]:
        """
        Return a fixed, safe context string for the last case.
        This is passed to RAG so that the chatbot can answer case-related
        questions without the user having to restate everything.
        """
        if not self._last_case:
            return None

        return (
            "CLIENT FACTS – DO NOT ALTER.\n"
            f"Issue Type: {self._last_case.get('issue_type')}\n"
            f"Description: {self._last_case.get('raw_description')}\n"
        )

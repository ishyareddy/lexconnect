from datetime import datetime
from .database import (
    Case,
    CaseStatus,
    LawyerProfile,
    LawyerRecommendation,
    ActiveCase,
    RecommendationStatus,
)


class LawyerAgent:
    def __init__(self):
        self.audit_log = []

    def log_event(self, action, case_id=None, lawyer_id=None, rec_id=None, notes=None):
        self.audit_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "case_id": case_id,
            "lawyer_id": lawyer_id,
            "rec_id": rec_id,
            "notes": notes,
        })

    def get_lawyer_profile(self, db, user_id):
        return db.query(LawyerProfile).filter(LawyerProfile.user_id == user_id).first()

    def get_pending_requests(self, db, lawyer_id):
        return db.query(LawyerRecommendation).filter(
            LawyerRecommendation.lawyer_id == lawyer_id,
            LawyerRecommendation.status == RecommendationStatus.client_accepted,
        ).all()

    def get_active_cases(self, db, lawyer_id):
        return db.query(ActiveCase).filter(
            ActiveCase.lawyer_id == lawyer_id,
            ActiveCase.status == "active",
        ).all()

    def accept_case(self, db, rec_id):
        rec = db.query(LawyerRecommendation).filter(
            LawyerRecommendation.id == rec_id
        ).first()

        if not rec:
            return None

        case = db.query(Case).filter(Case.id == rec.case_id).first()
        if not case:
            return None

        rec.status = RecommendationStatus.lawyer_accepted
        case.status = CaseStatus.matched

        existing_active = db.query(ActiveCase).filter(
            ActiveCase.case_id == rec.case_id,
            ActiveCase.lawyer_id == rec.lawyer_id,
            ActiveCase.status == "active",
        ).first()

        if not existing_active:
            active = ActiveCase(
                case_id=rec.case_id,
                lawyer_id=rec.lawyer_id,
                status="active",
            )
            db.add(active)
        else:
            active = existing_active

        db.commit()
        self.log_event(
            action="accepted",
            case_id=rec.case_id,
            lawyer_id=rec.lawyer_id,
            rec_id=rec.id,
            notes="Lawyer accepted case request",
        )
        return active

    def decline_case(self, db, rec_id):
        rec = db.query(LawyerRecommendation).filter(
            LawyerRecommendation.id == rec_id
        ).first()

        if not rec:
            return None

        case = db.query(Case).filter(Case.id == rec.case_id).first()
        if case:
            case.status = CaseStatus.open

        rec.status = RecommendationStatus.declined

        active = db.query(ActiveCase).filter(
            ActiveCase.case_id == rec.case_id,
            ActiveCase.lawyer_id == rec.lawyer_id,
            ActiveCase.status == "active",
        ).first()
        if active:
            active.status = "inactive"

        db.commit()
        self.log_event(
            action="declined",
            case_id=rec.case_id,
            lawyer_id=rec.lawyer_id,
            rec_id=rec.id,
            notes="Lawyer declined case request",
        )
        return rec

    def resolve_case(self, db, case_id, lawyer_id):
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            return None

        case.status = CaseStatus.closed

        active = db.query(ActiveCase).filter(
            ActiveCase.case_id == case_id,
            ActiveCase.lawyer_id == lawyer_id,
            ActiveCase.status == "active",
        ).first()
        if active:
            active.status = "resolved"

        rec = db.query(LawyerRecommendation).filter(
            LawyerRecommendation.case_id == case_id,
            LawyerRecommendation.lawyer_id == lawyer_id,
        ).first()
        if rec:
            rec.status = RecommendationStatus.matched

        db.commit()
        self.log_event(
            action="resolved",
            case_id=case_id,
            lawyer_id=lawyer_id,
            rec_id=rec.id if rec else None,
            notes="Case marked as resolved",
        )
        return case

    def reopen_case(self, db, case_id, lawyer_id):
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            return None

        case.status = CaseStatus.open

        active = db.query(ActiveCase).filter(
            ActiveCase.case_id == case_id,
            ActiveCase.lawyer_id == lawyer_id,
        ).first()
        if active:
            active.status = "inactive"

        rec = db.query(LawyerRecommendation).filter(
            LawyerRecommendation.case_id == case_id,
            LawyerRecommendation.lawyer_id == lawyer_id,
        ).first()
        if rec:
            rec.status = RecommendationStatus.declined

        db.commit()
        self.log_event(
            action="reopened",
            case_id=case_id,
            lawyer_id=lawyer_id,
            rec_id=rec.id if rec else None,
            notes="Case reopened after lawyer action",
        )
        return case

    def update_case_status(self, db, case_id, lawyer_user_id, action):
        profile = self.get_lawyer_profile(db, lawyer_user_id)
        if not profile:
            return None

        rec = db.query(LawyerRecommendation).filter(
            LawyerRecommendation.case_id == case_id,
            LawyerRecommendation.lawyer_id == profile.id,
        ).first()

        if action == "In Progress":
            if not rec:
                return None
            return self.accept_case(db, rec.id)

        if action in ["Declined", "Rejected"]:
            if not rec:
                return None
            return self.decline_case(db, rec.id)

        if action == "Resolved":
            return self.resolve_case(db, case_id, profile.id)

        if action == "Pending":
            return self.reopen_case(db, case_id, profile.id)

        return None

    def get_lawyer_cases(self, db, lawyer_user_id):
        profile = self.get_lawyer_profile(db, lawyer_user_id)
        if not profile:
            return []

        recs = db.query(LawyerRecommendation).filter(
            LawyerRecommendation.lawyer_id == profile.id
        ).all()

        result = []
        seen_case_ids = set()
        for r in recs:
            c = r.case
            if not c:
                continue

            # Skip duplicate cases (keep only the first recommendation per case)
            if c.id in seen_case_ids:
                continue
            seen_case_ids.add(c.id)

            parts = c.description.split("\n\n", 1)
            title = parts[0].strip() if parts and parts[0].strip() else f"Case #{c.id}"
            clean_description = parts[1].strip() if len(parts) > 1 else ""

            if c.status == CaseStatus.closed:
                display_status = "Resolved"
            elif r.status == RecommendationStatus.lawyer_accepted or c.status == CaseStatus.matched:
                display_status = "In Progress"
            elif r.status == RecommendationStatus.declined:
                display_status = "Rejected"
            elif r.status == RecommendationStatus.client_accepted:
                display_status = "Pending"
            else:
                display_status = "Pending"

            client_name = c.client.name if c.client else "Unknown Client"
            client_id = c.client.id if c.client else None

            result.append({
                "id": r.id,
                "case_id": c.id,
                "title": title,
                "description": clean_description,
                "case_type": c.issue_type,
                "status": display_status,
                "client_name": client_name,
                "client_id": client_id,
            })

        return result

    def get_audit_log(self):
        return self.audit_log
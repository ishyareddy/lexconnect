from .database import LawyerRecommendation, ActiveCase, RecommendationStatus

class LawyerAgent:

    def get_pending_requests(self, db, lawyer_id):
        return db.query(LawyerRecommendation).filter(
            LawyerRecommendation.lawyer_id == lawyer_id,
            LawyerRecommendation.status == RecommendationStatus.client_accepted
        ).all()

    def accept_case(self, db, rec_id):
        rec = db.query(LawyerRecommendation).filter(
            LawyerRecommendation.id == rec_id
        ).first()

        if not rec:
            return None

        rec.status = RecommendationStatus.lawyer_accepted

        active = ActiveCase(
            case_id=rec.case_id,
            lawyer_id=rec.lawyer_id
        )

        db.add(active)
        db.commit()
        return active

    def decline_case(self, db, rec_id):
        rec = db.query(LawyerRecommendation).filter(
            LawyerRecommendation.id == rec_id
        ).first()

        if rec:
            rec.status = RecommendationStatus.declined
            db.commit()

    def get_active_cases(self, db, lawyer_id):
        return db.query(ActiveCase).filter(
            ActiveCase.lawyer_id == lawyer_id,
            ActiveCase.status == "active"
        ).all()
# router_agent.py
from typing import List, Dict
from sqlalchemy.orm import Session
from .database import LawyerProfile, LawyerRecommendation, RecommendationStatus, Case

class RouterAgent:
    def __init__(self):
        self.specializations = {
            "property": ["property", "real estate", "land", "encroachment"],
            "family": ["family", "divorce", "matrimonial", "custody"],
            "contract": ["contract", "construction", "commercial", "breach"]
        }
    
    def get_top_lawyers(self, db: Session, case_issue_type: str, limit: int = 5) -> List[Dict]:
        """Match lawyers by specialization + availability."""
        spec_keywords = self.specializations.get(case_issue_type, [])
        
        lawyers = db.query(LawyerProfile).filter(
            LawyerProfile.is_available == 1
        ).all()
        
        scored = []
        for lawyer in lawyers:
            score = sum(1 for kw in spec_keywords if kw in (lawyer.specialization or "").lower())
            if score > 0:
                scored.append({
                    "lawyer_id": lawyer.id,
                    "name": lawyer.user.name,
                    "specialization": lawyer.specialization,
                    "city": lawyer.city,
                    "experience_years": lawyer.experience_years,
                    "rating": lawyer.rating or 0,
                    "score": score * 20 + (lawyer.experience_years or 0) * 2 + (lawyer.rating or 0)
                })
        
        return sorted(scored, key=lambda x: x["score"], reverse=True)[:limit]
    
    def create_recommendations(self, db: Session, case_id: int, lawyers: List[Dict]) -> List[int]:
        """Create recommendation records in DB."""
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            return []
        
        rec_ids = []
        for lawyer in lawyers:
            rec = LawyerRecommendation(
                case_id=case_id,
                lawyer_id=lawyer["lawyer_id"],
                score=lawyer["score"]
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
            rec_ids.append(rec.id)
        
        return rec_ids
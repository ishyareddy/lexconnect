import sys
sys.path.insert(0, '.')
from backend.database import SessionLocal, LawyerProfile

db = SessionLocal()
try:
    profiles = db.query(LawyerProfile).filter(LawyerProfile.city == 'Bangalore').limit(10).all()
    print('count', len(profiles))
    for p in profiles:
        print(p.id, repr(p.specialization), repr(p.lawyer_type), repr(p.city))
finally:
    db.close()

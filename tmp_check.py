import sys
sys.path.insert(0, '.')
from backend.database import SessionLocal, User, Case
from backend.router_agent import RouterAgent

db = SessionLocal()
try:
    case = db.query(Case).first()
    print('case', case.id if case else None, case.issue_type if case else None)
    client = db.query(User).filter(User.id == case.client_id).first() if case else None
    print('client', client.id if client else None, client.location if client else None)
    if case:
        lawyers = RouterAgent().get_top_lawyers(db, case.issue_type, client.location if client else '')
        print('lawyers count', len(lawyers))
        print('sample', lawyers[:3])
    print('total lawyers', db.query(User).filter(User.role == 'lawyer').count())
finally:
    db.close()

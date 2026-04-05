import sys
sys.path.insert(0, ".")
from backend.database import SessionLocal, User, LawyerProfile, UserRole

db = SessionLocal()
try:
    lawyer_count = db.query(User).filter(User.role == UserRole.lawyer).count()
    print(f"✓ Total lawyers in database: {lawyer_count}")
    
    # Check lawyers by lawyer_type
    print("\nLawyers by type:")
    for lt in ["Property Disputes & Rent", "Marriage, Divorce & Maintenance", "Child Custody & Adoption", "Consumer Rights & Contracts", "Inheritance & Wills"]:
        count = db.query(LawyerProfile).filter(LawyerProfile.lawyer_type == lt).count()
        print(f"  • {lt}: {count}")
    
    # Check by city
    print("\nLawyers by city (sample):")
    cities = db.query(LawyerProfile.city).distinct().limit(10).all()
    for (city,) in cities:
        count = db.query(LawyerProfile).filter(LawyerProfile.city == city).count()
        print(f"  • {city}: {count}")
        
finally:
    db.close()

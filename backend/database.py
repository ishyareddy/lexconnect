# database.py - COMPLETE WORKING VERSION FOR LEXCONNECT
from sqlalchemy import Column, Integer, String, Text, Enum, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy import create_engine
from datetime import datetime
import enum
import os
import random
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
DB_URL = os.getenv("LEGAL_RAG_DB_URL", f"sqlite:///{BASE_DIR / 'legal_rag.db'}")


engine = create_engine(
    DB_URL,
    connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class UserRole(str, enum.Enum):
    client = "client"
    lawyer = "lawyer"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    phone = Column(String(20), nullable=True)
    location = Column(String(100), nullable=True)
    cases = relationship("Case", back_populates="client", cascade="all, delete-orphan")
    lawyer_profile = relationship("LawyerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")

class LawyerProfile(Base):
    __tablename__ = "lawyer_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    specialization = Column(String(100), nullable=True)
    lawyer_type = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    experience_years = Column(Integer, nullable=True)
    rating = Column(Integer, nullable=True)
    is_available = Column(Integer, nullable=False, default=1)
    user = relationship("User", back_populates="lawyer_profile")

class CaseStatus(str, enum.Enum):
    open = "open"
    matched = "matched"
    closed = "closed"

class Case(Base):
    __tablename__ = "cases"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issue_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(CaseStatus), nullable=False, default=CaseStatus.open)
    created_at = Column(DateTime, default=datetime.utcnow)
    client = relationship("User", back_populates="cases")
    recommendations = relationship("LawyerRecommendation", back_populates="case")

class RecommendationStatus(str, enum.Enum):
    suggested = "suggested"
    client_accepted = "client_accepted"
    lawyer_accepted = "lawyer_accepted"
    matched = "matched"
    declined = "declined"

class LawyerRecommendation(Base):
    __tablename__ = "lawyer_recommendations"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    lawyer_id = Column(Integer, ForeignKey("lawyer_profiles.id"), nullable=False)
    score = Column(Integer, nullable=False)
    status = Column(Enum(RecommendationStatus), default=RecommendationStatus.suggested)
    created_at = Column(DateTime, default=datetime.utcnow)
    case = relationship("Case", back_populates="recommendations")
    lawyer = relationship("LawyerProfile")

class ActiveCase(Base):
    __tablename__ = "active_cases"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    lawyer_id = Column(Integer, ForeignKey("lawyer_profiles.id"))
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    case = relationship("Case")
    lawyer = relationship("LawyerProfile")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    content = Column(Text, nullable=False)
    is_read = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    case = relationship("Case")

class CallSession(str, enum.Enum):
    initiating = "initiating"
    active = "active"
    completed = "completed"
    declined = "declined"

class VideoCall(Base):
    __tablename__ = "video_calls"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    initiator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    room_name = Column(String(255), nullable=False, unique=True)
    status = Column(Enum(CallSession), nullable=False, default=CallSession.initiating)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    case = relationship("Case")
    initiator = relationship("User", foreign_keys=[initiator_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

# 🔥 SEED DEMO DATA
def init_db() -> None:
    """Create tables + seed demo data with 500+ realistic lawyer entries"""
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Demo Client
        if not db.query(User).filter(User.email == "test@test.com").first():
            demo_client = User(
                email="test@test.com",
                name="Demo Client", 
                password_hash="demo_hash",
                role=UserRole.client,
                phone="9876543210",
                location="Mumbai"
            )
            db.add(demo_client)
            db.commit()
            print("✅ Demo client created: test@test.com")
        
        # Check if lawyers already seeded
        lawyer_count = db.query(User).filter(User.role == UserRole.lawyer).count()
        if lawyer_count < 600:
            print("🌱 Seeding 600+ realistic lawyers with stronger 4/5 distribution...")

            first_names = [
                "Aarav", "Abhishek", "Aishwarya", "Akash", "Amit", "Amrita", "Ananya", "Aniket", "Arjun", "Arpita",
                "Arun", "Bhavya", "Chaitanya", "Deepak", "Deepti", "Divya", "Gaurav", "Geeta", "Harish", "Isha",
                "Jagdeep", "Jaya", "Karan", "Kavya", "Kiran", "Krishna", "Madhav", "Meera", "Neha", "Nidhi",
                "Nikhil", "Pallavi", "Pranav", "Priya", "Rohit", "Ritika", "Sanjay", "Shruti", "Suman", "Tanya",
                "Vaibhav", "Vikram", "Yamini", "Yash", "Zoya", "Naveen", "Sahil", "Tanvi", "Rachit", "Leena"
            ]
            last_names = [
                "Agarwal", "Bajaj", "Banerjee", "Chandra", "Das", "Deshpande", "Desai", "Garg", "Gupta", "Iyer",
                "Jain", "Joshi", "Kapoor", "Khan", "Kohli", "Kulkarni", "Mehta", "Menon", "Mishra", "Mitra",
                "Mohanty", "Murthy", "Nair", "Naidu", "Pandey", "Patel", "Prasad", "Rao", "Reddy", "Roy",
                "Saxena", "Sen", "Shah", "Sharma", "Shetty", "Singh", "Srivastava", "Talwar", "Trivedi", "Verma",
                "Venkataraman", "Wadhwa", "Yadav", "Yusuf", "Zaveri", "Chopra", "Bhatt", "Bhaskar", "Irfan", "Rakesh"
            ]
            lawyer_types = ["Property Disputes & Rent", "Marriage, Divorce & Maintenance", "Child Custody & Adoption", "Consumer Rights & Contracts", "Inheritance & Wills"]
            cities = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", 
                     "Jaipur", "Lucknow", "Kochi", "Chandigarh", "Indore", "Nagpur", "Surat", "Gurugram",
                     "Noida", "Ghaziabad", "Visakhapatnam", "Vadodara"]

            # Build at least 6 unique lawyers per city and per type
            total_needed = 600 - lawyer_count
            created = 0
            next_id = lawyer_count + 1

            for city in cities:
                if created >= total_needed:
                    break
                for lawyer_type in lawyer_types:
                    if created >= total_needed:
                        break
                    for index_in_type in range(6):
                        if created >= total_needed:
                            break
                        first_name = random.choice(first_names)
                        last_name = random.choice(last_names)
                        name = f"{first_name} {last_name}"
                        email = f"advocate{next_id}@legal.com"
                        experience = random.randint(5, 20)
                        rating = random.choices([5, 4, 3, 2, 1], weights=[45, 35, 12, 5, 3], k=1)[0]

                        user = User(
                            email=email,
                            name=name,
                            password_hash="lawyer_hash",
                            role=UserRole.lawyer,
                            phone=f"98765{str(next_id).zfill(5)}",
                            location=city
                        )
                        db.add(user)
                        db.flush()

                        profile = LawyerProfile(
                            user_id=user.id,
                            specialization=lawyer_type,
                            lawyer_type=lawyer_type,
                            city=city,
                            experience_years=experience,
                            rating=rating,
                            is_available=1
                        )
                        db.add(profile)

                        created += 1
                        next_id += 1

                        if created % 50 == 0:
                            db.commit()
                            print(f"  ✓ Added {created} lawyers...")

            db.commit()
            print(f"✅ Seeded {created} realistic lawyers across all cities and types")

        normalize_existing_lawyer_names(db)
    except Exception as e:
        print(f"❌ Seed error: {e}")
        db.rollback()
    finally:
        db.close()
    print("✅ Database ready with complete demo data!")


def normalize_lawyer_ratings(db):
    from sqlalchemy.orm import joinedload

    profiles = db.query(LawyerProfile).options(joinedload(LawyerProfile.user)).all()
    if not profiles:
        return

    # Ensure each city/type bucket has at least three 4- or 5-star lawyers
    buckets = {}
    for profile in profiles:
        if not profile.city or not profile.lawyer_type:
            continue
        key = (profile.city.strip().lower(), profile.lawyer_type.strip().lower())
        buckets.setdefault(key, []).append(profile)

    for profile_list in buckets.values():
        high_rated = [p for p in profile_list if (p.rating or 0) >= 4]
        if len(high_rated) < 3:
            low_profiles = sorted(profile_list, key=lambda p: (p.rating or 0))
            for p in low_profiles[:3 - len(high_rated)]:
                p.rating = 5 if random.random() < 0.6 else 4

    # Boost some remaining 3-star lawyers to 4-star for better coverage
    for profile in profiles:
        if profile.rating == 3 and random.random() < 0.4:
            profile.rating = 4

    db.commit()


def normalize_existing_lawyer_names(db):
    first_names = [
        "Aarav", "Aditya", "Aishwarya", "Akash", "Amrita", "Ananya", "Aniket", "Arjun", "Arpita", "Arun",
        "Bhavya", "Chaitanya", "Deepak", "Deepti", "Divya", "Gaurav", "Geeta", "Harish", "Isha", "Jagdeep",
        "Jaya", "Karan", "Kavya", "Kiran", "Krishna", "Madhav", "Meera", "Neha", "Nidhi", "Nikhil",
        "Pallavi", "Pranav", "Priya", "Rohit", "Ritika", "Sanjay", "Shruti", "Suman", "Tanya", "Vaibhav",
        "Vikram", "Yamini", "Yash", "Zoya", "Naveen", "Sahil", "Tanvi", "Rachit", "Leena", "Sanjeev"
    ]
    last_names = [
        "Agarwal", "Bajaj", "Banerjee", "Chandra", "Das", "Deshpande", "Desai", "Garg", "Gupta", "Iyer",
        "Jain", "Joshi", "Kapoor", "Khan", "Kohli", "Kulkarni", "Mehta", "Menon", "Mishra", "Mitra",
        "Mohanty", "Murthy", "Nair", "Naidu", "Pandey", "Patel", "Prasad", "Rao", "Reddy", "Roy",
        "Saxena", "Sen", "Shah", "Sharma", "Shetty", "Singh", "Srivastava", "Talwar", "Trivedi", "Verma",
        "Venkataraman", "Wadhwa", "Yadav", "Yusuf", "Zaveri", "Chopra", "Bhatt", "Bhaskar", "Irfan", "Kapur"
    ]
    lawyers = db.query(User).filter(User.role == UserRole.lawyer).order_by(User.id).all()
    if not lawyers:
        return

    current_names = [lawyer.name for lawyer in lawyers]
    repeated_names = len(set(current_names)) < max(1, len(current_names) * 0.8)
    has_advocate_prefix = any(name.lower().startswith("advocate ") for name in current_names)
    if not (repeated_names or has_advocate_prefix):
        # Existing names look already realistic enough; still improve ratings
        normalize_lawyer_ratings(db)
        return

    name_combinations = [f"{first} {last}" for first in first_names for last in last_names]
    random.shuffle(name_combinations)

    for lawyer, new_name in zip(lawyers, name_combinations):
        lawyer.name = new_name

    db.commit()
    print("🔄 Updated existing lawyer names to realistic, unique entries.")

    normalize_lawyer_ratings(db)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 🔥 EXPORTS FOR app.py
__all__ = [
    'init_db', 'get_db', 
    'User', 'UserRole', 
    'Case', 'CaseStatus',
    'LawyerProfile', 
    'LawyerRecommendation', 'RecommendationStatus',
    'ActiveCase',
    'Message', 'VideoCall', 'CallSession'
]

import os
import sqlite3
from hashlib import sha256
from sqlalchemy.orm import Session
from pathlib import Path

from database import SessionLocal, User, UserRole, LawyerProfile

SOURCE_DB = os.getenv("SOURCE_LAWYERS_DB", "lawyers.db")
DEFAULT_PASSWORD = os.getenv("IMPORTED_LAWYER_PASSWORD", "lawyer123")


def safe_email_from_phone_or_id(phone, source_id):
    digits = ''.join(ch for ch in (phone or '') if ch.isdigit())
    if digits:
        return f"lawyer_{digits}@import.local"
    return f"lawyer_{source_id}@import.local"


def main():
    if not Path(SOURCE_DB).exists():
        raise FileNotFoundError(f"Source DB not found: {SOURCE_DB}")

    src = sqlite3.connect(SOURCE_DB)
    src.row_factory = sqlite3.Row
    rows = src.execute("SELECT * FROM lawyers").fetchall()

    db: Session = SessionLocal()
    created_users = 0
    created_profiles = 0
    skipped = 0

    try:
        for row in rows:
            source_id = row["user_id"]
            name = row["user_name"]  # ✅ NEW
            specialization = row["specialization"]
            city = row["city"]
            address = row["address"]
            phone = row["phone_number"]
            experience_years = row["experience_years"]
            rating = row["rating"]
            is_available = row["is_available"]

            email = safe_email_from_phone_or_id(phone, source_id)

            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                existing_profile = db.query(LawyerProfile).filter(
                    LawyerProfile.user_id == existing_user.id
                ).first()

                if existing_profile:
                    existing_profile.specialization = specialization or existing_profile.specialization
                    existing_profile.city = city or existing_profile.city
                    existing_profile.experience_years = experience_years if experience_years is not None else existing_profile.experience_years
                    existing_profile.rating = int(round(rating)) if rating is not None else existing_profile.rating
                    existing_profile.is_available = int(is_available) if is_available is not None else existing_profile.is_available

                    skipped += 1
                    continue

            # ✅ Use user_name directly
            user = User(
                email=email,
                name=name if name else f"Lawyer #{source_id}",  # fallback
                password_hash=sha256(DEFAULT_PASSWORD.encode()).hexdigest(),
                role=UserRole.lawyer,
                phone=phone,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            created_users += 1

            profile = LawyerProfile(
                user_id=user.id,
                specialization=specialization or "General",
                city=city or "Unknown",
                experience_years=experience_years or 0,
                rating=int(round(rating)) if rating is not None else 0,
                is_available=int(is_available) if is_available is not None else 1,
            )
            db.add(profile)
            db.commit()
            created_profiles += 1

        print({
            "source_db": SOURCE_DB,
            "rows_found": len(rows),
            "created_users": created_users,
            "created_profiles": created_profiles,
            "updated_existing": skipped,
            "default_password": DEFAULT_PASSWORD,
            "note": "address not imported unless schema updated"
        })

    finally:
        db.close()
        src.close()


if __name__ == "__main__":
    main()
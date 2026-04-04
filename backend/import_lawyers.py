import os
import sqlite3
from pathlib import Path
from hashlib import sha256
from sqlalchemy.orm import Session

from database import SessionLocal, User, UserRole, LawyerProfile

SOURCE_DB = os.getenv("SOURCE_LAWYERS_DB", "lawyers.db")
DEFAULT_PASSWORD = os.getenv("IMPORTED_LAWYER_PASSWORD", "lawyer123")


def safe_email_from_phone_or_id(phone, source_id):
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if digits:
        return f"lawyer_{digits}@import.local"
    return f"lawyer_{source_id}@import.local"


def safe_name_from_source(source_id, user_name, specialization, city):
    if user_name and user_name.strip():
        return user_name.strip()

    spec = (specialization or "Lawyer").strip().title()
    city_part = f" - {city.strip().title()}" if city else ""
    return f"Advocate {spec}{city_part} #{source_id}"


def main():
    if not Path(SOURCE_DB).exists():
        raise FileNotFoundError(f"Source DB not found: {SOURCE_DB}")

    src = sqlite3.connect(SOURCE_DB)
    src.row_factory = sqlite3.Row
    rows = src.execute("""
        SELECT
            user_id,
            user_name,
            specialization,
            city,
            address,
            phone_number,
            experience_years,
            rating,
            is_available
        FROM lawyers
    """).fetchall()

    db: Session = SessionLocal()
    created_users = 0
    created_profiles = 0
    updated_existing = 0

    try:
        for row in rows:
            source_id = row["user_id"]
            user_name = row["user_name"]
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
                existing_user.name = safe_name_from_source(source_id, user_name, specialization, city)
                existing_user.phone = phone or existing_user.phone

                existing_profile = db.query(LawyerProfile).filter(
                    LawyerProfile.user_id == existing_user.id
                ).first()

                if existing_profile:
                    existing_profile.specialization = specialization or existing_profile.specialization
                    existing_profile.city = city or existing_profile.city
                    existing_profile.experience_years = (
                        experience_years if experience_years is not None else existing_profile.experience_years
                    )
                    existing_profile.rating = (
                        int(round(rating)) if rating is not None else existing_profile.rating
                    )
                    existing_profile.is_available = (
                        int(is_available) if is_available is not None else existing_profile.is_available
                    )
                    updated_existing += 1
                else:
                    profile = LawyerProfile(
                        user_id=existing_user.id,
                        specialization=specialization or "General",
                        city=city or "Unknown",
                        experience_years=experience_years if experience_years is not None else 0,
                        rating=int(round(rating)) if rating is not None else 0,
                        is_available=int(is_available) if is_available is not None else 1,
                    )
                    db.add(profile)
                    created_profiles += 1

                db.commit()
                continue

            user = User(
                email=email,
                name=safe_name_from_source(source_id, user_name, specialization, city),
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
                experience_years=experience_years if experience_years is not None else 0,
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
            "updated_existing": updated_existing,
            "default_password": DEFAULT_PASSWORD,
            "note": "address is not imported because current schema has no address column"
        })

    finally:
        db.close()
        src.close()


if __name__ == "__main__":
    main()
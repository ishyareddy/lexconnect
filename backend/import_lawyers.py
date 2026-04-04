import os
import sqlite3
<<<<<<< HEAD
from hashlib import sha256
from sqlalchemy.orm import Session
from pathlib import Path
=======
from pathlib import Path
from hashlib import sha256
from sqlalchemy.orm import Session
>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326

from database import SessionLocal, User, UserRole, LawyerProfile

SOURCE_DB = os.getenv("SOURCE_LAWYERS_DB", "lawyers.db")
DEFAULT_PASSWORD = os.getenv("IMPORTED_LAWYER_PASSWORD", "lawyer123")


def safe_email_from_phone_or_id(phone, source_id):
<<<<<<< HEAD
    digits = ''.join(ch for ch in (phone or '') if ch.isdigit())
=======
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326
    if digits:
        return f"lawyer_{digits}@import.local"
    return f"lawyer_{source_id}@import.local"


<<<<<<< HEAD
=======
def safe_name_from_source(source_id, user_name, specialization, city):
    if user_name and user_name.strip():
        return user_name.strip()

    spec = (specialization or "Lawyer").strip().title()
    city_part = f" - {city.strip().title()}" if city else ""
    return f"Advocate {spec}{city_part} #{source_id}"


>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326
def main():
    if not Path(SOURCE_DB).exists():
        raise FileNotFoundError(f"Source DB not found: {SOURCE_DB}")

    src = sqlite3.connect(SOURCE_DB)
    src.row_factory = sqlite3.Row
<<<<<<< HEAD
    rows = src.execute("SELECT * FROM lawyers").fetchall()
=======
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
>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326

    db: Session = SessionLocal()
    created_users = 0
    created_profiles = 0
<<<<<<< HEAD
    skipped = 0
=======
    updated_existing = 0
>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326

    try:
        for row in rows:
            source_id = row["user_id"]
<<<<<<< HEAD
            name = row["user_name"]  # ✅ NEW
=======
            user_name = row["user_name"]
>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326
            specialization = row["specialization"]
            city = row["city"]
            address = row["address"]
            phone = row["phone_number"]
            experience_years = row["experience_years"]
            rating = row["rating"]
            is_available = row["is_available"]

            email = safe_email_from_phone_or_id(phone, source_id)
<<<<<<< HEAD

            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
=======
            existing_user = db.query(User).filter(User.email == email).first()

            if existing_user:
                existing_user.name = safe_name_from_source(source_id, user_name, specialization, city)
                existing_user.phone = phone or existing_user.phone

>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326
                existing_profile = db.query(LawyerProfile).filter(
                    LawyerProfile.user_id == existing_user.id
                ).first()

                if existing_profile:
                    existing_profile.specialization = specialization or existing_profile.specialization
                    existing_profile.city = city or existing_profile.city
<<<<<<< HEAD
                    existing_profile.experience_years = experience_years if experience_years is not None else existing_profile.experience_years
                    existing_profile.rating = int(round(rating)) if rating is not None else existing_profile.rating
                    existing_profile.is_available = int(is_available) if is_available is not None else existing_profile.is_available

                    skipped += 1
                    continue

            # ✅ Use user_name directly
            user = User(
                email=email,
                name=name if name else f"Lawyer #{source_id}",  # fallback
=======
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
>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326
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
<<<<<<< HEAD
                experience_years=experience_years or 0,
=======
                experience_years=experience_years if experience_years is not None else 0,
>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326
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
<<<<<<< HEAD
            "updated_existing": skipped,
            "default_password": DEFAULT_PASSWORD,
            "note": "address not imported unless schema updated"
=======
            "updated_existing": updated_existing,
            "default_password": DEFAULT_PASSWORD,
            "note": "address is not imported because current schema has no address column"
>>>>>>> 60af5fed4f5f7a7fbbef0934424950b9be1ab326
        })

    finally:
        db.close()
        src.close()


if __name__ == "__main__":
    main()
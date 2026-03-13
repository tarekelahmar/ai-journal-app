"""Repository for UserProfile CRUD operations."""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.domain.models.user_profile import UserProfile


class UserProfileRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, user_id: int) -> Optional[UserProfile]:
        """Get the profile for a user."""
        return self.db.query(UserProfile).filter(
            UserProfile.user_id == user_id
        ).first()

    def upsert(self, user_id: int, **fields) -> UserProfile:
        """Create or update the user profile."""
        existing = self.get(user_id)
        if existing:
            for key, value in fields.items():
                setattr(existing, key, value)
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        obj = UserProfile(user_id=user_id, **fields)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def mark_completed(self, user_id: int) -> Optional[UserProfile]:
        """Mark the diagnostic as completed."""
        profile = self.get(user_id)
        if profile:
            profile.diagnostic_completed = True
            profile.diagnostic_completed_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(profile)
        return profile

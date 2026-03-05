"""Shared dependencies for FastAPI routes"""
from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domain.repositories import UserRepository


def get_user_repo(db: Session = Depends(get_db)) -> UserRepository:
    """Dependency to get UserRepository instance"""
    return UserRepository(db)

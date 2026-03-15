"""Authentication endpoints"""
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm

from app.domain.models.user import User
from app.domain.schemas.user import UserCreate, UserResponse
from app.dependencies import get_user_repo
from app.domain.repositories import UserRepository
from app.config.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from app.config.rate_limiting import rate_limit_ip
from app.config.settings import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    user: UserCreate,
    user_repo: UserRepository = Depends(get_user_repo),
):
    """
    Public registration endpoint — no auth required.
    Creates a new user account with name, email, and password.
    """
    existing = user_repo.get_by_email(user.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    hashed = hash_password(user.password)
    db_user = user_repo.create(
        name=user.name,
        email=user.email,
        hashed_password=hashed,
    )

    # Create default preferences for the new user
    from app.domain.models.user_preference import UserPreference
    db = user_repo.db
    pref = UserPreference(
        user_id=db_user.id,
        preferred_depth_level=2,
        journal_onboarded=False,
        diagnostic_completed=False,
    )
    db.add(pref)
    db.commit()

    return db_user


@router.post("/login")
@rate_limit_ip(settings.RATE_LIMIT_AUTH if settings.ENABLE_RATE_LIMITING else "1000/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    user_repo: UserRepository = Depends(get_user_repo)
) -> Dict[str, Any]:
    """
    User login endpoint.
    
    Returns JWT access token on successful authentication.
    """
    user = user_repo.get_by_email(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(user.id)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """Get current authenticated user's profile"""
    return current_user


"""Repository for Action CRUD operations."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.domain.models.action import Action


class ActionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id: int, **fields) -> Action:
        obj = Action(user_id=user_id, **fields)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def get_by_id(self, action_id: int, user_id: int) -> Optional[Action]:
        return (
            self.db.query(Action)
            .filter(Action.id == action_id, Action.user_id == user_id)
            .first()
        )

    def list_by_user(
        self,
        user_id: int,
        status: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> List[Action]:
        q = self.db.query(Action).filter(Action.user_id == user_id)
        if status:
            q = q.filter(Action.status == status)
        if domain:
            q = q.filter(Action.primary_domain == domain)
        return q.order_by(Action.sort_order, Action.created_at.desc()).all()

    def update(self, action: Action, **fields) -> Action:
        for k, v in fields.items():
            if v is not None:
                setattr(action, k, v)
        action.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(action)
        return action

    def delete(self, action: Action) -> None:
        self.db.delete(action)
        self.db.commit()

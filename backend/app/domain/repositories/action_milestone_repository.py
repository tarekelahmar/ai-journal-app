"""Repository for ActionMilestone CRUD operations."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.domain.models.action_milestone import ActionMilestone


class ActionMilestoneRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, action_id: int, **fields) -> ActionMilestone:
        obj = ActionMilestone(action_id=action_id, **fields)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def list_by_action(self, action_id: int) -> List[ActionMilestone]:
        return (
            self.db.query(ActionMilestone)
            .filter(ActionMilestone.action_id == action_id)
            .order_by(ActionMilestone.sort_order)
            .all()
        )

    def get_by_id(self, milestone_id: int) -> Optional[ActionMilestone]:
        return self.db.query(ActionMilestone).filter(ActionMilestone.id == milestone_id).first()

    def toggle_complete(self, milestone: ActionMilestone) -> ActionMilestone:
        milestone.is_completed = not milestone.is_completed
        milestone.completed_at = datetime.utcnow() if milestone.is_completed else None
        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def delete(self, milestone: ActionMilestone) -> None:
        self.db.delete(milestone)
        self.db.commit()

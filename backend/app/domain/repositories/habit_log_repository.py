"""Repository for HabitLog CRUD operations."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.domain.models.habit_log import HabitLog


class HabitLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def log(self, action_id: int, user_id: int, log_date: str, completed: bool = True) -> HabitLog:
        """Log a habit completion for a date. Upserts if already exists."""
        existing = (
            self.db.query(HabitLog)
            .filter(HabitLog.action_id == action_id, HabitLog.log_date == log_date)
            .first()
        )
        if existing:
            existing.completed = completed
            self.db.commit()
            self.db.refresh(existing)
            return existing

        obj = HabitLog(action_id=action_id, user_id=user_id, log_date=log_date, completed=completed)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def get_logs(self, action_id: int, start_date: str, end_date: str) -> List[HabitLog]:
        return (
            self.db.query(HabitLog)
            .filter(
                HabitLog.action_id == action_id,
                HabitLog.log_date >= start_date,
                HabitLog.log_date <= end_date,
            )
            .order_by(HabitLog.log_date)
            .all()
        )

    def get_user_logs(self, user_id: int, log_date: str) -> List[HabitLog]:
        """Get all habit logs for a user on a specific date."""
        return (
            self.db.query(HabitLog)
            .filter(HabitLog.user_id == user_id, HabitLog.log_date == log_date)
            .all()
        )

    def delete(self, log: HabitLog) -> None:
        self.db.delete(log)
        self.db.commit()

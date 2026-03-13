"""Repository for DiagnosticResponse CRUD operations."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.domain.models.diagnostic_response import DiagnosticResponse


class DiagnosticResponseRepository:
    def __init__(self, db: Session):
        self.db = db

    def upsert(
        self,
        user_id: int,
        question_id: str,
        layer: int,
        section: str,
        response_type: str,
        response_json: dict,
    ) -> DiagnosticResponse:
        """Create or update a response. Uses unique constraint on (user_id, question_id)."""
        existing = self.db.query(DiagnosticResponse).filter(
            DiagnosticResponse.user_id == user_id,
            DiagnosticResponse.question_id == question_id,
        ).first()

        if existing:
            existing.response_json = response_json
            existing.response_type = response_type
            existing.layer = layer
            existing.section = section
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        obj = DiagnosticResponse(
            user_id=user_id,
            question_id=question_id,
            layer=layer,
            section=section,
            response_type=response_type,
            response_json=response_json,
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def get_all(self, user_id: int) -> List[DiagnosticResponse]:
        """Get all responses for a user, ordered by layer then question_id."""
        return self.db.query(DiagnosticResponse).filter(
            DiagnosticResponse.user_id == user_id
        ).order_by(DiagnosticResponse.layer, DiagnosticResponse.question_id).all()

    def get_by_layer(self, user_id: int, layer: int) -> List[DiagnosticResponse]:
        """Get all responses for a specific layer."""
        return self.db.query(DiagnosticResponse).filter(
            DiagnosticResponse.user_id == user_id,
            DiagnosticResponse.layer == layer,
        ).all()

    def get_by_question(self, user_id: int, question_id: str) -> Optional[DiagnosticResponse]:
        """Get a specific response by question_id."""
        return self.db.query(DiagnosticResponse).filter(
            DiagnosticResponse.user_id == user_id,
            DiagnosticResponse.question_id == question_id,
        ).first()

    def delete_by_question(self, user_id: int, question_id: str) -> bool:
        """Delete a specific response. Returns True if deleted."""
        obj = self.get_by_question(user_id, question_id)
        if obj:
            self.db.delete(obj)
            self.db.commit()
            return True
        return False

    def get_progress(self, user_id: int) -> dict:
        """Return completion counts per layer and section."""
        responses = self.get_all(user_id)
        progress = {"layer_1": 0, "layer_2": 0, "layer_3": 0, "sections": {}}
        for r in responses:
            key = f"layer_{r.layer}"
            progress[key] = progress.get(key, 0) + 1
            progress["sections"][r.section] = progress["sections"].get(r.section, 0) + 1
        return progress

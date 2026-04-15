from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException

from app.db.postgres import get_db_connection


class JobRepository:
    def create_job(
        self,
        *,
        job_type: str,
        input_payload: dict[str, Any],
        progress_stage: Optional[str] = None,
        progress_message: Optional[str] = None,
    ) -> dict[str, Any]:
        query = """
            insert into generation_jobs (
                job_type,
                status,
                progress_stage,
                progress_message,
                input_payload
            )
            values (
                %(job_type)s,
                'queued',
                %(progress_stage)s,
                %(progress_message)s,
                %(input_payload)s::jsonb
            )
            returning
                id,
                job_type,
                status,
                progress_stage,
                progress_message,
                input_payload,
                result_payload,
                error_message,
                created_at,
                updated_at,
                completed_at
        """
        params = {
            "job_type": job_type,
            "progress_stage": progress_stage,
            "progress_message": progress_message,
            "input_payload": json.dumps(input_payload),
        }
        return self._fetch_one_required(query, params)

    def get_job(self, job_id: str) -> Optional[dict[str, Any]]:
        query = """
            select
                id,
                job_type,
                status,
                progress_stage,
                progress_message,
                input_payload,
                result_payload,
                error_message,
                created_at,
                updated_at,
                completed_at
            from generation_jobs
            where id = %(job_id)s
            limit 1
        """
        return self._fetch_one(query, {"job_id": job_id})

    def update_job(
        self,
        *,
        job_id: str,
        status: str,
        progress_stage: Optional[str] = None,
        progress_message: Optional[str] = None,
        result_payload: Optional[dict[str, Any]] = None,
        error_message: Optional[str] = None,
        completed_at: Optional[datetime] = None,
    ) -> dict[str, Any]:
        query = """
            update generation_jobs
            set
                status = %(status)s,
                progress_stage = %(progress_stage)s,
                progress_message = %(progress_message)s,
                result_payload = coalesce(%(result_payload)s::jsonb, result_payload),
                error_message = %(error_message)s,
                completed_at = %(completed_at)s
            where id = %(job_id)s
            returning
                id,
                job_type,
                status,
                progress_stage,
                progress_message,
                input_payload,
                result_payload,
                error_message,
                created_at,
                updated_at,
                completed_at
        """
        params = {
            "job_id": job_id,
            "status": status,
            "progress_stage": progress_stage,
            "progress_message": progress_message,
            "result_payload": json.dumps(result_payload) if result_payload is not None else None,
            "error_message": error_message,
            "completed_at": completed_at,
        }
        return self._fetch_one_required(query, params)

    def _fetch_one_required(self, query: str, params: dict[str, Any]) -> dict[str, Any]:
        row = self._fetch_one(query, params)
        if row is None:
            raise RuntimeError("Expected a database row but none was returned.")
        return row

    def _fetch_one(self, query: str, params: dict[str, Any]) -> Optional[dict[str, Any]]:
        try:
            with get_db_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query, params)
                    return cursor.fetchone()
        except HTTPException:
            raise

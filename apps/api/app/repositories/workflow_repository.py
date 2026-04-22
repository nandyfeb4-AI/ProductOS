from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import HTTPException

from app.db.postgres import get_db_connection


class WorkflowRepository:
    def count_workflows(self, status_filter: list[str] | None = None) -> int:
        query = """
            select count(*)::int as count
            from workflow_runs
            where (
                %(status_filter)s::text[] is null
                or status = any(%(status_filter)s::text[])
            )
        """
        row = self._fetch_one_required(query, {"status_filter": status_filter})
        return int(row["count"])

    def create_workflow(
        self,
        *,
        workflow_type: str,
        workflow_definition_key: str | None,
        workflow_definition_label: str | None,
        project_id: str | None,
        workshop_id: str | None,
        title: Optional[str],
        source_provider: Optional[str],
        source_resource_id: Optional[str],
        source_resource_name: Optional[str],
        current_step: str,
        status: str,
        state_payload: dict[str, Any],
    ) -> dict[str, Any]:
        query = """
            insert into workflow_runs (
                workflow_type,
                workflow_definition_key,
                workflow_definition_label,
                project_id,
                workshop_id,
                title,
                source_provider,
                source_resource_id,
                source_resource_name,
                current_step,
                status,
                state_payload
            )
            values (
                %(workflow_type)s,
                %(workflow_definition_key)s,
                %(workflow_definition_label)s,
                %(project_id)s::uuid,
                %(workshop_id)s::uuid,
                %(title)s,
                %(source_provider)s,
                %(source_resource_id)s,
                %(source_resource_name)s,
                %(current_step)s,
                %(status)s,
                %(state_payload)s::jsonb
            )
            returning
                id,
                workflow_type,
                workflow_definition_key,
                workflow_definition_label,
                project_id,
                workshop_id,
                title,
                source_provider,
                source_resource_id,
                source_resource_name,
                current_step,
                status,
                state_payload,
                created_at,
                updated_at
        """
        params = {
            "workflow_type": workflow_type,
            "workflow_definition_key": workflow_definition_key,
            "workflow_definition_label": workflow_definition_label,
            "project_id": project_id,
            "workshop_id": workshop_id,
            "title": title,
            "source_provider": source_provider,
            "source_resource_id": source_resource_id,
            "source_resource_name": source_resource_name,
            "current_step": current_step,
            "status": status,
            "state_payload": json.dumps(state_payload or {}),
        }
        return self._fetch_one_required(query, params)

    def list_workflows(
        self,
        workflow_type: Optional[str] = None,
        workflow_definition_key: Optional[str] = None,
        project_id: Optional[str] = None,
        workshop_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        query = """
            select
                id,
                workflow_type,
                workflow_definition_key,
                workflow_definition_label,
                project_id,
                workshop_id,
                title,
                source_provider,
                source_resource_id,
                source_resource_name,
                current_step,
                status,
                state_payload,
                created_at,
                updated_at
            from workflow_runs
            where (%(workflow_type)s::text is null or workflow_type = %(workflow_type)s::text)
              and (%(workflow_definition_key)s::text is null or workflow_definition_key = %(workflow_definition_key)s::text)
              and (%(project_id)s::uuid is null or project_id = %(project_id)s::uuid)
              and (%(workshop_id)s::uuid is null or workshop_id = %(workshop_id)s::uuid)
            order by updated_at desc
        """
        return self._fetch_all(
            query,
            {
                "workflow_type": workflow_type,
                "workflow_definition_key": workflow_definition_key,
                "project_id": project_id,
                "workshop_id": workshop_id,
            },
        )

    def get_workflow(self, workflow_id: str) -> Optional[dict[str, Any]]:
        query = """
            select
                id,
                workflow_type,
                workflow_definition_key,
                workflow_definition_label,
                project_id,
                workshop_id,
                title,
                source_provider,
                source_resource_id,
                source_resource_name,
                current_step,
                status,
                state_payload,
                created_at,
                updated_at
            from workflow_runs
            where id = %(workflow_id)s
            limit 1
        """
        return self._fetch_one(query, {"workflow_id": workflow_id})

    def update_workflow(
        self,
        workflow_id: str,
        *,
        workflow_definition_key: str | None = None,
        workflow_definition_label: str | None = None,
        project_id: str | None = None,
        workshop_id: str | None = None,
        title: Optional[str] = None,
        current_step: Optional[str] = None,
        status: Optional[str] = None,
        state_payload: Optional[dict[str, Any]] = None,
        source_provider: Optional[str] = None,
        source_resource_id: Optional[str] = None,
        source_resource_name: Optional[str] = None,
    ) -> dict[str, Any]:
        query = """
            update workflow_runs
            set
                project_id = coalesce(%(project_id)s::uuid, project_id),
                workshop_id = coalesce(%(workshop_id)s::uuid, workshop_id),
                workflow_definition_key = coalesce(%(workflow_definition_key)s, workflow_definition_key),
                workflow_definition_label = coalesce(%(workflow_definition_label)s, workflow_definition_label),
                title = coalesce(%(title)s, title),
                current_step = coalesce(%(current_step)s, current_step),
                status = coalesce(%(status)s, status),
                source_provider = coalesce(%(source_provider)s, source_provider),
                source_resource_id = coalesce(%(source_resource_id)s, source_resource_id),
                source_resource_name = coalesce(%(source_resource_name)s, source_resource_name),
                state_payload = coalesce(%(state_payload)s::jsonb, state_payload)
            where id = %(workflow_id)s
            returning
                id,
                workflow_type,
                workflow_definition_key,
                workflow_definition_label,
                project_id,
                workshop_id,
                title,
                source_provider,
                source_resource_id,
                source_resource_name,
                current_step,
                status,
                state_payload,
                created_at,
                updated_at
        """
        params = {
            "workflow_id": workflow_id,
            "workflow_definition_key": workflow_definition_key,
            "workflow_definition_label": workflow_definition_label,
            "project_id": project_id,
            "workshop_id": workshop_id,
            "title": title,
            "current_step": current_step,
            "status": status,
            "source_provider": source_provider,
            "source_resource_id": source_resource_id,
            "source_resource_name": source_resource_name,
            "state_payload": json.dumps(state_payload) if state_payload is not None else None,
        }
        return self._fetch_one_required(query, params)

    def _fetch_one_required(self, query: str, params: dict[str, Any]) -> dict[str, Any]:
        row = self._fetch_one(query, params)
        if row is None:
            raise RuntimeError("Expected a workflow row but none was returned.")
        return row

    def _fetch_one(self, query: str, params: dict[str, Any]) -> Optional[dict[str, Any]]:
        try:
            with get_db_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query, params)
                    return cursor.fetchone()
        except HTTPException:
            raise

    def _fetch_all(self, query: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        try:
            with get_db_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query, params)
                    return list(cursor.fetchall())
        except HTTPException:
            raise

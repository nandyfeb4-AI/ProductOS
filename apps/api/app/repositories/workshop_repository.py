from __future__ import annotations

import json
from typing import Any, Optional

from app.db.postgres import get_db_connection


class WorkshopRepository:
    def count_workshops(self) -> int:
        query = "select count(*)::int as count from workshops"
        row = self._fetch_one_required(query, {})
        return int(row["count"])

    def create_workshop(
        self,
        *,
        project_id: str,
        title: str,
        status: str,
        source_provider: str | None,
        source_resource_id: str | None,
        source_resource_name: str | None,
        source_url: str | None,
        transcript: str | None,
        notes: str | None,
        source_payload: dict[str, Any],
        insights_payload: dict[str, Any],
        journey_payload: dict[str, Any],
        import_meta: dict[str, Any],
    ) -> dict[str, Any]:
        query = """
            insert into workshops (
                project_id,
                title,
                status,
                source_provider,
                source_resource_id,
                source_resource_name,
                source_url,
                transcript,
                notes,
                source_payload,
                insights_payload,
                journey_payload,
                import_meta
            )
            values (
                %(project_id)s::uuid,
                %(title)s,
                %(status)s,
                %(source_provider)s,
                %(source_resource_id)s,
                %(source_resource_name)s,
                %(source_url)s,
                %(transcript)s,
                %(notes)s,
                %(source_payload)s::jsonb,
                %(insights_payload)s::jsonb,
                %(journey_payload)s::jsonb,
                %(import_meta)s::jsonb
            )
            returning id
        """
        created = self._fetch_one_required(query, {
            "project_id": project_id,
            "title": title,
            "status": status,
            "source_provider": source_provider,
            "source_resource_id": source_resource_id,
            "source_resource_name": source_resource_name,
            "source_url": source_url,
            "transcript": transcript,
            "notes": notes,
            "source_payload": json.dumps(source_payload or {}),
            "insights_payload": json.dumps(insights_payload or {}),
            "journey_payload": json.dumps(journey_payload or {}),
            "import_meta": json.dumps(import_meta or {}),
        })
        row = self.get_workshop(str(created["id"]))
        if row is None:
            raise RuntimeError("Workshop lookup failed after create.")
        return row

    def list_workshops(
        self,
        project_id: str | None = None,
        status: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        query = self._select_base() + """
            where (%(project_id)s::uuid is null or w.project_id = %(project_id)s::uuid)
              and (%(status)s::text is null or w.status = %(status)s::text)
            group by w.id
            order by w.updated_at desc, w.created_at desc
        """
        return self._fetch_all(query, {"project_id": project_id, "status": status})

    def get_workshop(self, workshop_id: str) -> Optional[dict[str, Any]]:
        query = self._select_base() + """
            where w.id = %(workshop_id)s::uuid
            group by w.id
            limit 1
        """
        return self._fetch_one(query, {"workshop_id": workshop_id})

    def update_workshop(
        self,
        workshop_id: str,
        *,
        title: str | None = None,
        status: str | None = None,
        source_provider: str | None = None,
        source_resource_id: str | None = None,
        source_resource_name: str | None = None,
        source_url: str | None = None,
        transcript: str | None = None,
        notes: str | None = None,
        source_payload: dict[str, Any] | None = None,
        insights_payload: dict[str, Any] | None = None,
        journey_payload: dict[str, Any] | None = None,
        import_meta: dict[str, Any] | None = None,
        current_workflow_id: str | None = None,
        latest_workflow_step: str | None = None,
        latest_workflow_status: str | None = None,
    ) -> dict[str, Any]:
        query = """
            update workshops
            set
                title = coalesce(%(title)s, title),
                status = coalesce(%(status)s, status),
                source_provider = coalesce(%(source_provider)s, source_provider),
                source_resource_id = coalesce(%(source_resource_id)s, source_resource_id),
                source_resource_name = coalesce(%(source_resource_name)s, source_resource_name),
                source_url = coalesce(%(source_url)s, source_url),
                transcript = coalesce(%(transcript)s, transcript),
                notes = coalesce(%(notes)s, notes),
                source_payload = coalesce(%(source_payload)s::jsonb, source_payload),
                insights_payload = coalesce(%(insights_payload)s::jsonb, insights_payload),
                journey_payload = coalesce(%(journey_payload)s::jsonb, journey_payload),
                import_meta = coalesce(%(import_meta)s::jsonb, import_meta),
                current_workflow_id = coalesce(%(current_workflow_id)s::uuid, current_workflow_id),
                latest_workflow_step = coalesce(%(latest_workflow_step)s, latest_workflow_step),
                latest_workflow_status = coalesce(%(latest_workflow_status)s, latest_workflow_status)
            where id = %(workshop_id)s::uuid
            returning id
        """
        updated = self._fetch_one(query, {
            "workshop_id": workshop_id,
            "title": title,
            "status": status,
            "source_provider": source_provider,
            "source_resource_id": source_resource_id,
            "source_resource_name": source_resource_name,
            "source_url": source_url,
            "transcript": transcript,
            "notes": notes,
            "source_payload": json.dumps(source_payload) if source_payload is not None else None,
            "insights_payload": json.dumps(insights_payload) if insights_payload is not None else None,
            "journey_payload": json.dumps(journey_payload) if journey_payload is not None else None,
            "import_meta": json.dumps(import_meta) if import_meta is not None else None,
            "current_workflow_id": current_workflow_id,
            "latest_workflow_step": latest_workflow_step,
            "latest_workflow_status": latest_workflow_status,
        })
        if updated is None:
            raise RuntimeError("Expected a workshop row but none was returned.")
        row = self.get_workshop(workshop_id)
        if row is None:
            raise RuntimeError("Workshop lookup failed after update.")
        return row

    def _select_base(self) -> str:
        return """
            select
                w.id,
                w.project_id,
                w.title,
                w.status,
                w.source_provider,
                w.source_resource_id,
                w.source_resource_name,
                w.source_url,
                w.transcript,
                w.notes,
                w.source_payload,
                w.insights_payload,
                w.journey_payload,
                w.import_meta,
                w.current_workflow_id,
                w.latest_workflow_step,
                w.latest_workflow_status,
                w.created_at,
                w.updated_at,
                count(wr.id)::int as workflow_count
            from workshops w
            left join workflow_runs wr on wr.workshop_id = w.id
        """

    def _fetch_one_required(self, query: str, params: dict[str, Any]) -> dict[str, Any]:
        row = self._fetch_one(query, params)
        if row is None:
            raise RuntimeError("Expected a workshop row but none was returned.")
        return row

    def _fetch_one(self, query: str, params: dict[str, Any]) -> Optional[dict[str, Any]]:
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.fetchone()

    def _fetch_all(self, query: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                return list(cursor.fetchall())

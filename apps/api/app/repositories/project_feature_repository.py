from __future__ import annotations

import json
from typing import Any, Optional

from app.db.postgres import get_db_connection


class ProjectFeatureRepository:
    def create_feature(
        self,
        *,
        project_id: str,
        source_type: str,
        source_title: str,
        source_summary: str,
        source_details: str,
        desired_outcome: str,
        constraints: list[str],
        supporting_context: list[str],
        status: str,
        generator_type: str,
        skill_id: str | None,
        skill_name: str | None,
        title: str,
        summary: str,
        body: dict[str, Any],
        prioritization: dict[str, Any] | None = None,
        jira_issue_key: str | None = None,
        jira_issue_url: str | None = None,
        jira_issue_type: str | None = None,
    ) -> dict[str, Any]:
        query = """
            insert into project_features (
                project_id,
                source_type,
                source_title,
                source_summary,
                source_details,
                desired_outcome,
                constraints,
                supporting_context,
                status,
                generator_type,
                skill_id,
                skill_name,
                title,
                summary,
                body,
                prioritization,
                jira_issue_key,
                jira_issue_url,
                jira_issue_type
            )
            values (
                %(project_id)s::uuid,
                %(source_type)s,
                %(source_title)s,
                %(source_summary)s,
                %(source_details)s,
                %(desired_outcome)s,
                %(constraints)s::jsonb,
                %(supporting_context)s::jsonb,
                %(status)s,
                %(generator_type)s,
                %(skill_id)s::uuid,
                %(skill_name)s,
                %(title)s,
                %(summary)s,
                %(body)s::jsonb,
                %(prioritization)s::jsonb,
                %(jira_issue_key)s,
                %(jira_issue_url)s,
                %(jira_issue_type)s
            )
            returning id
        """
        created = self._fetch_one_required(
            query,
            {
                "project_id": project_id,
                "source_type": source_type,
                "source_title": source_title,
                "source_summary": source_summary,
                "source_details": source_details,
                "desired_outcome": desired_outcome,
                "constraints": json.dumps(constraints or []),
                "supporting_context": json.dumps(supporting_context or []),
                "status": status,
                "generator_type": generator_type,
                "skill_id": skill_id,
                "skill_name": skill_name,
                "title": title,
                "summary": summary,
                "body": json.dumps(body or {}),
                "prioritization": json.dumps(prioritization or {}),
                "jira_issue_key": jira_issue_key,
                "jira_issue_url": jira_issue_url,
                "jira_issue_type": jira_issue_type,
            },
        )
        row = self.get_feature(str(created["id"]))
        if row is None:
            raise RuntimeError("Project feature lookup failed after create.")
        return row

    def list_features(self, project_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
        query = self._select_base() + """
            where (%(project_id)s::uuid is null or pf.project_id = %(project_id)s::uuid)
              and (%(status)s::text is null or pf.status = %(status)s::text)
            order by pf.updated_at desc, pf.created_at desc
        """
        return self._fetch_all(query, {"project_id": project_id, "status": status})

    def get_feature(self, feature_id: str) -> Optional[dict[str, Any]]:
        query = self._select_base() + """
            where pf.id = %(feature_id)s::uuid
            limit 1
        """
        return self._fetch_one(query, {"feature_id": feature_id})

    def update_feature(
        self,
        feature_id: str,
        *,
        source_type: str | None = None,
        source_title: str | None = None,
        source_summary: str | None = None,
        source_details: str | None = None,
        desired_outcome: str | None = None,
        constraints: list[str] | None = None,
        supporting_context: list[str] | None = None,
        status: str | None = None,
        generator_type: str | None = None,
        skill_id: str | None = None,
        skill_name: str | None = None,
        title: str | None = None,
        summary: str | None = None,
        body: dict[str, Any] | None = None,
        prioritization: dict[str, Any] | None = None,
        jira_issue_key: str | None = None,
        jira_issue_url: str | None = None,
        jira_issue_type: str | None = None,
    ) -> dict[str, Any]:
        query = """
            update project_features
            set
                source_type = coalesce(%(source_type)s, source_type),
                source_title = coalesce(%(source_title)s, source_title),
                source_summary = coalesce(%(source_summary)s, source_summary),
                source_details = coalesce(%(source_details)s, source_details),
                desired_outcome = coalesce(%(desired_outcome)s, desired_outcome),
                constraints = coalesce(%(constraints)s::jsonb, constraints),
                supporting_context = coalesce(%(supporting_context)s::jsonb, supporting_context),
                status = coalesce(%(status)s, status),
                generator_type = coalesce(%(generator_type)s, generator_type),
                skill_id = coalesce(%(skill_id)s::uuid, skill_id),
                skill_name = coalesce(%(skill_name)s, skill_name),
                title = coalesce(%(title)s, title),
                summary = coalesce(%(summary)s, summary),
                body = coalesce(%(body)s::jsonb, body),
                prioritization = coalesce(%(prioritization)s::jsonb, prioritization),
                jira_issue_key = coalesce(%(jira_issue_key)s, jira_issue_key),
                jira_issue_url = coalesce(%(jira_issue_url)s, jira_issue_url),
                jira_issue_type = coalesce(%(jira_issue_type)s, jira_issue_type)
            where id = %(feature_id)s::uuid
            returning id
        """
        updated = self._fetch_one(
            query,
            {
                "feature_id": feature_id,
                "source_type": source_type,
                "source_title": source_title,
                "source_summary": source_summary,
                "source_details": source_details,
                "desired_outcome": desired_outcome,
                "constraints": json.dumps(constraints) if constraints is not None else None,
                "supporting_context": json.dumps(supporting_context) if supporting_context is not None else None,
                "status": status,
                "generator_type": generator_type,
                "skill_id": skill_id,
                "skill_name": skill_name,
                "title": title,
                "summary": summary,
                "body": json.dumps(body) if body is not None else None,
                "prioritization": json.dumps(prioritization) if prioritization is not None else None,
                "jira_issue_key": jira_issue_key,
                "jira_issue_url": jira_issue_url,
                "jira_issue_type": jira_issue_type,
            },
        )
        if updated is None:
            raise RuntimeError("Expected a project feature row but none was returned.")
        row = self.get_feature(feature_id)
        if row is None:
            raise RuntimeError("Project feature lookup failed after update.")
        return row

    def _select_base(self) -> str:
        return """
            select
                pf.id,
                pf.project_id,
                pf.source_type,
                pf.source_title,
                pf.source_summary,
                pf.source_details,
                pf.desired_outcome,
                pf.constraints,
                pf.supporting_context,
                pf.status,
                pf.generator_type,
                pf.skill_id,
                pf.skill_name,
                pf.title,
                pf.summary,
                pf.body,
                pf.prioritization,
                pf.jira_issue_key,
                pf.jira_issue_url,
                pf.jira_issue_type,
                pf.created_at,
                pf.updated_at
            from project_features pf
        """

    def _fetch_one_required(self, query: str, params: dict[str, Any]) -> dict[str, Any]:
        row = self._fetch_one(query, params)
        if row is None:
            raise RuntimeError("Expected a project feature row but none was returned.")
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

from __future__ import annotations

import json
from typing import Any, Optional

from app.db.postgres import get_db_connection


class ProjectStoryRepository:
    def create_story(
        self,
        *,
        project_id: str,
        source_type: str,
        source_feature_id: str | None,
        source_story_id: str | None,
        status: str,
        generator_type: str,
        skill_id: str | None,
        skill_name: str | None,
        title: str,
        user_story: str,
        as_a: str,
        i_want: str,
        so_that: str,
        description: str,
        acceptance_criteria: list[str],
        edge_cases: list[str],
        dependencies: list[str],
        priority: str,
        jira_issue_key: str | None = None,
        jira_issue_url: str | None = None,
        jira_issue_type: str | None = None,
    ) -> dict[str, Any]:
        query = """
            insert into project_stories (
                project_id,
                source_type,
                source_feature_id,
                source_story_id,
                status,
                generator_type,
                skill_id,
                skill_name,
                title,
                user_story,
                as_a,
                i_want,
                so_that,
                description,
                acceptance_criteria,
                edge_cases,
                dependencies,
                priority,
                jira_issue_key,
                jira_issue_url,
                jira_issue_type
            )
            values (
                %(project_id)s::uuid,
                %(source_type)s,
                %(source_feature_id)s::uuid,
                %(source_story_id)s::uuid,
                %(status)s,
                %(generator_type)s,
                %(skill_id)s::uuid,
                %(skill_name)s,
                %(title)s,
                %(user_story)s,
                %(as_a)s,
                %(i_want)s,
                %(so_that)s,
                %(description)s,
                %(acceptance_criteria)s::jsonb,
                %(edge_cases)s::jsonb,
                %(dependencies)s::jsonb,
                %(priority)s,
                %(jira_issue_key)s,
                %(jira_issue_url)s,
                %(jira_issue_type)s
            )
            returning id
        """
        created = self._fetch_one_required(query, {
            "project_id": project_id,
            "source_type": source_type,
            "source_feature_id": source_feature_id,
            "source_story_id": source_story_id,
            "status": status,
            "generator_type": generator_type,
            "skill_id": skill_id,
            "skill_name": skill_name,
            "title": title,
            "user_story": user_story,
            "as_a": as_a,
            "i_want": i_want,
            "so_that": so_that,
            "description": description,
            "acceptance_criteria": json.dumps(acceptance_criteria or []),
            "edge_cases": json.dumps(edge_cases or []),
            "dependencies": json.dumps(dependencies or []),
            "priority": priority,
            "jira_issue_key": jira_issue_key,
            "jira_issue_url": jira_issue_url,
            "jira_issue_type": jira_issue_type,
        })
        row = self.get_story(str(created["id"]))
        if row is None:
            raise RuntimeError("Project story lookup failed after create.")
        return row

    def list_stories(
        self,
        project_id: str | None = None,
        source_feature_id: str | None = None,
        source_story_id: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        query = self._select_base() + """
            where (%(project_id)s::uuid is null or ps.project_id = %(project_id)s::uuid)
              and (%(source_feature_id)s::uuid is null or ps.source_feature_id = %(source_feature_id)s::uuid)
              and (%(source_story_id)s::uuid is null or ps.source_story_id = %(source_story_id)s::uuid)
              and (%(status)s::text is null or ps.status = %(status)s::text)
            order by ps.updated_at desc, ps.created_at desc
        """
        return self._fetch_all(query, {
            "project_id": project_id,
            "source_feature_id": source_feature_id,
            "source_story_id": source_story_id,
            "status": status,
        })

    def get_story(self, story_id: str) -> Optional[dict[str, Any]]:
        query = self._select_base() + """
            where ps.id = %(story_id)s::uuid
            limit 1
        """
        return self._fetch_one(query, {"story_id": story_id})

    def update_story(
        self,
        story_id: str,
        *,
        source_type: str | None = None,
        source_feature_id: str | None = None,
        source_story_id: str | None = None,
        status: str | None = None,
        generator_type: str | None = None,
        skill_id: str | None = None,
        skill_name: str | None = None,
        title: str | None = None,
        user_story: str | None = None,
        as_a: str | None = None,
        i_want: str | None = None,
        so_that: str | None = None,
        description: str | None = None,
        acceptance_criteria: list[str] | None = None,
        edge_cases: list[str] | None = None,
        dependencies: list[str] | None = None,
        priority: str | None = None,
        jira_issue_key: str | None = None,
        jira_issue_url: str | None = None,
        jira_issue_type: str | None = None,
    ) -> dict[str, Any]:
        query = """
            update project_stories
            set
                source_type = coalesce(%(source_type)s, source_type),
                source_feature_id = coalesce(%(source_feature_id)s::uuid, source_feature_id),
                source_story_id = coalesce(%(source_story_id)s::uuid, source_story_id),
                status = coalesce(%(status)s, status),
                generator_type = coalesce(%(generator_type)s, generator_type),
                skill_id = coalesce(%(skill_id)s::uuid, skill_id),
                skill_name = coalesce(%(skill_name)s, skill_name),
                title = coalesce(%(title)s, title),
                user_story = coalesce(%(user_story)s, user_story),
                as_a = coalesce(%(as_a)s, as_a),
                i_want = coalesce(%(i_want)s, i_want),
                so_that = coalesce(%(so_that)s, so_that),
                description = coalesce(%(description)s, description),
                acceptance_criteria = coalesce(%(acceptance_criteria)s::jsonb, acceptance_criteria),
                edge_cases = coalesce(%(edge_cases)s::jsonb, edge_cases),
                dependencies = coalesce(%(dependencies)s::jsonb, dependencies),
                priority = coalesce(%(priority)s, priority),
                jira_issue_key = coalesce(%(jira_issue_key)s, jira_issue_key),
                jira_issue_url = coalesce(%(jira_issue_url)s, jira_issue_url),
                jira_issue_type = coalesce(%(jira_issue_type)s, jira_issue_type)
            where id = %(story_id)s::uuid
            returning id
        """
        updated = self._fetch_one(query, {
            "story_id": story_id,
            "source_type": source_type,
            "source_feature_id": source_feature_id,
            "source_story_id": source_story_id,
            "status": status,
            "generator_type": generator_type,
            "skill_id": skill_id,
            "skill_name": skill_name,
            "title": title,
            "user_story": user_story,
            "as_a": as_a,
            "i_want": i_want,
            "so_that": so_that,
            "description": description,
            "acceptance_criteria": json.dumps(acceptance_criteria) if acceptance_criteria is not None else None,
            "edge_cases": json.dumps(edge_cases) if edge_cases is not None else None,
            "dependencies": json.dumps(dependencies) if dependencies is not None else None,
            "priority": priority,
            "jira_issue_key": jira_issue_key,
            "jira_issue_url": jira_issue_url,
            "jira_issue_type": jira_issue_type,
        })
        if updated is None:
            raise RuntimeError("Expected a project story row but none was returned.")
        row = self.get_story(story_id)
        if row is None:
            raise RuntimeError("Project story lookup failed after update.")
        return row

    def _select_base(self) -> str:
        return """
            select
                ps.id,
                ps.project_id,
                ps.source_type,
                ps.source_feature_id,
                ps.source_story_id,
                ps.status,
                ps.generator_type,
                ps.skill_id,
                ps.skill_name,
                ps.title,
                ps.user_story,
                ps.as_a,
                ps.i_want,
                ps.so_that,
                ps.description,
                ps.acceptance_criteria,
                ps.edge_cases,
                ps.dependencies,
                ps.priority,
                ps.jira_issue_key,
                ps.jira_issue_url,
                ps.jira_issue_type,
                ps.created_at,
                ps.updated_at
            from project_stories ps
        """

    def _fetch_one_required(self, query: str, params: dict[str, Any]) -> dict[str, Any]:
        row = self._fetch_one(query, params)
        if row is None:
            raise RuntimeError("Expected a project story row but none was returned.")
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

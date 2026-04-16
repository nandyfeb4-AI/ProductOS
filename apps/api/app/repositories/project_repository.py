from __future__ import annotations

from typing import Any, Optional

from app.db.postgres import get_db_connection


class ProjectRepository:
    def create_project(
        self,
        *,
        name: str,
        slug: str,
        description: str | None,
        status: str,
    ) -> dict[str, Any]:
        query = """
            insert into projects (
                name,
                slug,
                description,
                status
            )
            values (
                %(name)s,
                %(slug)s,
                %(description)s,
                %(status)s
            )
            returning *
        """
        return self._fetch_one_required(
            query,
            {
                "name": name,
                "slug": slug,
                "description": description,
                "status": status,
            },
        )

    def list_projects(self, status: Optional[str] = None) -> list[dict[str, Any]]:
        query = self._project_summary_select() + """
            where (%(status)s::text is null or p.status = %(status)s::text)
            order by p.updated_at desc, p.created_at desc
        """
        return self._fetch_all(query, {"status": status})

    def get_project(self, project_id: str) -> Optional[dict[str, Any]]:
        query = self._project_summary_select() + """
            where p.id = %(project_id)s::uuid
            limit 1
        """
        return self._fetch_one(query, {"project_id": project_id})

    def update_project(
        self,
        project_id: str,
        *,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        update_query = """
            update projects
            set
                name = coalesce(%(name)s, name),
                slug = coalesce(%(slug)s, slug),
                description = coalesce(%(description)s, description),
                status = coalesce(%(status)s, status)
            where id = %(project_id)s::uuid
            returning id
        """
        updated = self._fetch_one(update_query, {
            "project_id": project_id,
            "name": name,
            "slug": slug,
            "description": description,
            "status": status,
        })
        if updated is None:
            raise RuntimeError("Expected a project row but none was returned.")
        row = self.get_project(project_id)
        if row is None:
            raise RuntimeError("Project lookup failed after update.")
        return row

    def _project_summary_select(self) -> str:
        return """
            select
                p.id,
                p.name,
                p.slug,
                p.description,
                p.status,
                p.created_at,
                p.updated_at,
                (
                    select count(*)
                    from workshops ws
                    where ws.project_id = p.id
                )::int as workshop_count,
                (
                    select count(*)
                    from workflow_runs wr
                    where wr.project_id = p.id
                )::int as workflow_count,
                (
                    select count(*)
                    from workflow_runs wr
                    where wr.project_id = p.id
                      and wr.status in ('active', 'draft')
                )::int as active_workflow_count,
                (
                    select coalesce(sum(
                        (
                            select count(*)
                            from jsonb_array_elements(
                                coalesce((wr.state_payload -> 'artifact_pipeline_data' -> 'artifacts'), '[]'::jsonb)
                            ) artifact
                            where lower(coalesce(artifact ->> 'artifact_type', '')) = 'feature'
                        )
                    ), 0)
                    from workflow_runs wr
                    where wr.project_id = p.id
                )::int
                +
                (
                    select count(*)
                    from project_features pf
                    where pf.project_id = p.id
                )::int as feature_count,
                (
                    select coalesce(sum(
                        (
                            select count(*)
                            from jsonb_array_elements(
                                coalesce((wr.state_payload -> 'artifact_pipeline_data' -> 'artifacts'), '[]'::jsonb)
                            ) artifact
                            where lower(coalesce(artifact ->> 'artifact_type', '')) = 'initiative'
                        )
                    ), 0)
                    from workflow_runs wr
                    where wr.project_id = p.id
                )::int as initiative_count,
                (
                    select coalesce(sum(
                        jsonb_array_length(
                            coalesce((wr.state_payload -> 'stories_pipeline_data' -> 'stories'), '[]'::jsonb)
                        )
                    ), 0)
                    from workflow_runs wr
                    where wr.project_id = p.id
                )::int
                +
                (
                    select count(*)
                    from project_stories ps
                    where ps.project_id = p.id
                )::int as story_count
            from projects p
        """

    def _fetch_one_required(self, query: str, params: dict[str, Any]) -> dict[str, Any]:
        row = self._fetch_one(query, params)
        if row is None:
            raise RuntimeError("Expected a project row but none was returned.")
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

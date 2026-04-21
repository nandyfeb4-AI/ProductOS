from __future__ import annotations

from typing import Any

from app.db.postgres import get_db_connection


class ProjectTeamRepository:
    def list_members(self, project_id: str) -> list[dict[str, Any]]:
        query = """
            select
                id,
                project_id,
                full_name,
                role_key,
                role_label,
                discipline,
                seniority,
                allocation_pct,
                created_at,
                updated_at
            from project_team_members
            where project_id = %(project_id)s::uuid
            order by created_at asc, full_name asc
        """
        return self._fetch_all(query, {"project_id": project_id})

    def create_default_members(self, project_id: str) -> None:
        query = """
            insert into project_team_members (
                project_id,
                full_name,
                role_key,
                role_label,
                discipline,
                seniority,
                allocation_pct
            )
            values
                (%(project_id)s::uuid, 'Ava Patel', 'pm', 'Product Manager', 'product', 'senior', 100),
                (%(project_id)s::uuid, 'Noah Kim', 'design', 'Product Designer', 'design', 'senior', 100),
                (%(project_id)s::uuid, 'Mia Chen', 'frontend', 'Frontend Engineer', 'engineering', 'senior', 100),
                (%(project_id)s::uuid, 'Ethan Brooks', 'backend', 'Backend Engineer', 'engineering', 'senior', 100),
                (%(project_id)s::uuid, 'Priya Nair', 'fullstack', 'Full Stack Engineer', 'engineering', 'mid', 100),
                (%(project_id)s::uuid, 'Liam Rivera', 'qa', 'QA Engineer', 'quality', 'mid', 100),
                (%(project_id)s::uuid, 'Sofia Martinez', 'devops', 'DevOps Engineer', 'platform', 'senior', 100),
                (%(project_id)s::uuid, 'Lucas Johnson', 'data', 'Data Analyst', 'data', 'mid', 75),
                (%(project_id)s::uuid, 'Grace Walker', 'techlead', 'Tech Lead', 'engineering', 'staff', 50)
        """
        self._execute(query, {"project_id": project_id})

    def ensure_default_members(self, project_id: str) -> None:
        query = """
            select exists(
                select 1
                from project_team_members
                where project_id = %(project_id)s::uuid
            ) as has_members
        """
        row = self._fetch_one(query, {"project_id": project_id})
        if row and row.get("has_members"):
            return
        self.create_default_members(project_id)

    def _fetch_one(self, query: str, params: dict[str, Any]) -> dict[str, Any] | None:
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.fetchone()

    def _fetch_all(self, query: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)
                return list(cursor.fetchall())

    def _execute(self, query: str, params: dict[str, Any]) -> None:
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)

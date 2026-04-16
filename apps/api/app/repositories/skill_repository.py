from __future__ import annotations

import json
from typing import Any, Optional

from app.db.postgres import get_db_connection


class SkillRepository:
    def create_skill(
        self,
        *,
        name: str,
        slug: str,
        skill_type: str,
        description: str | None,
        is_active: bool,
        instructions: str,
        required_sections: list[str],
        quality_bar: list[str],
        integration_notes: list[str],
    ) -> dict[str, Any]:
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                if is_active:
                    cursor.execute(
                        """
                        update skills
                        set is_active = false
                        where skill_type = %(skill_type)s
                        """,
                        {"skill_type": skill_type},
                    )
                cursor.execute(
                    """
                    insert into skills (
                        name,
                        slug,
                        skill_type,
                        description,
                        is_active,
                        instructions,
                        required_sections,
                        quality_bar,
                        integration_notes
                    )
                    values (
                        %(name)s,
                        %(slug)s,
                        %(skill_type)s,
                        %(description)s,
                        %(is_active)s,
                        %(instructions)s,
                        %(required_sections)s::jsonb,
                        %(quality_bar)s::jsonb,
                        %(integration_notes)s::jsonb
                    )
                    returning *
                    """,
                    {
                        "name": name,
                        "slug": slug,
                        "skill_type": skill_type,
                        "description": description,
                        "is_active": is_active,
                        "instructions": instructions,
                        "required_sections": json.dumps(required_sections or []),
                        "quality_bar": json.dumps(quality_bar or []),
                        "integration_notes": json.dumps(integration_notes or []),
                    },
                )
                row = cursor.fetchone()
                if row is None:
                    raise RuntimeError("Expected a skill row but none was returned.")
                return row

    def list_skills(
        self,
        skill_type: str | None = None,
        active_only: bool | None = None,
    ) -> list[dict[str, Any]]:
        query = """
            select
                id,
                name,
                slug,
                skill_type,
                description,
                is_active,
                instructions,
                required_sections,
                quality_bar,
                integration_notes,
                created_at,
                updated_at
            from skills
            where (%(skill_type)s::text is null or skill_type = %(skill_type)s::text)
              and (%(active_only)s::boolean is null or is_active = %(active_only)s::boolean)
            order by
              is_active desc,
              updated_at desc,
              created_at desc
        """
        return self._fetch_all(query, {"skill_type": skill_type, "active_only": active_only})

    def get_skill(self, skill_id: str) -> Optional[dict[str, Any]]:
        query = """
            select
                id,
                name,
                slug,
                skill_type,
                description,
                is_active,
                instructions,
                required_sections,
                quality_bar,
                integration_notes,
                created_at,
                updated_at
            from skills
            where id = %(skill_id)s::uuid
            limit 1
        """
        return self._fetch_one(query, {"skill_id": skill_id})

    def get_active_skill(self, skill_type: str) -> Optional[dict[str, Any]]:
        query = """
            select
                id,
                name,
                slug,
                skill_type,
                description,
                is_active,
                instructions,
                required_sections,
                quality_bar,
                integration_notes,
                created_at,
                updated_at
            from skills
            where skill_type = %(skill_type)s::text
              and is_active = true
            order by updated_at desc, created_at desc
            limit 1
        """
        return self._fetch_one(query, {"skill_type": skill_type})

    def update_skill(
        self,
        skill_id: str,
        *,
        name: str | None = None,
        slug: str | None = None,
        skill_type: str | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        instructions: str | None = None,
        required_sections: list[str] | None = None,
        quality_bar: list[str] | None = None,
        integration_notes: list[str] | None = None,
    ) -> dict[str, Any]:
        current = self.get_skill(skill_id)
        if current is None:
            raise RuntimeError("Skill not found.")

        next_skill_type = skill_type or current["skill_type"]
        next_is_active = current["is_active"] if is_active is None else is_active

        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                if next_is_active:
                    cursor.execute(
                        """
                        update skills
                        set is_active = false
                        where skill_type = %(skill_type)s
                          and id <> %(skill_id)s::uuid
                        """,
                        {"skill_type": next_skill_type, "skill_id": skill_id},
                    )
                cursor.execute(
                    """
                    update skills
                    set
                        name = coalesce(%(name)s, name),
                        slug = coalesce(%(slug)s, slug),
                        skill_type = coalesce(%(skill_type)s, skill_type),
                        description = coalesce(%(description)s, description),
                        is_active = coalesce(%(is_active)s, is_active),
                        instructions = coalesce(%(instructions)s, instructions),
                        required_sections = coalesce(%(required_sections)s::jsonb, required_sections),
                        quality_bar = coalesce(%(quality_bar)s::jsonb, quality_bar),
                        integration_notes = coalesce(%(integration_notes)s::jsonb, integration_notes)
                    where id = %(skill_id)s::uuid
                    returning *
                    """,
                    {
                        "skill_id": skill_id,
                        "name": name,
                        "slug": slug,
                        "skill_type": skill_type,
                        "description": description,
                        "is_active": is_active,
                        "instructions": instructions,
                        "required_sections": json.dumps(required_sections) if required_sections is not None else None,
                        "quality_bar": json.dumps(quality_bar) if quality_bar is not None else None,
                        "integration_notes": json.dumps(integration_notes) if integration_notes is not None else None,
                    },
                )
                row = cursor.fetchone()
                if row is None:
                    raise RuntimeError("Expected a skill row but none was returned.")
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

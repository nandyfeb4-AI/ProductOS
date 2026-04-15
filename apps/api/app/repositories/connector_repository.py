from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from fastapi import HTTPException

from app.db.postgres import get_db_connection


class ConnectorRepository:
    def save_connection(
        self,
        *,
        provider: str,
        state: str,
        external_user_id: Optional[str],
        username: Optional[str],
        full_name: Optional[str],
        access_token: Optional[str],
        refresh_token: Optional[str],
        scopes: list[str],
        token_expires_at: Optional[datetime],
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        query = """
            insert into integration_connections (
                provider,
                state,
                external_user_id,
                username,
                full_name,
                access_token,
                refresh_token,
                scopes,
                token_expires_at,
                metadata
            )
            values (
                %(provider)s,
                %(state)s,
                %(external_user_id)s,
                %(username)s,
                %(full_name)s,
                %(access_token)s,
                %(refresh_token)s,
                %(scopes)s::jsonb,
                %(token_expires_at)s,
                %(metadata)s::jsonb
            )
            on conflict (state) do update set
                provider = excluded.provider,
                external_user_id = excluded.external_user_id,
                username = excluded.username,
                full_name = excluded.full_name,
                access_token = excluded.access_token,
                refresh_token = excluded.refresh_token,
                scopes = excluded.scopes,
                token_expires_at = excluded.token_expires_at,
                metadata = excluded.metadata
        """
        params = {
            "provider": provider,
            "state": state,
            "external_user_id": external_user_id,
            "username": username,
            "full_name": full_name,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "scopes": json.dumps(scopes),
            "token_expires_at": token_expires_at,
            "metadata": json.dumps(metadata or {}),
        }
        self._execute(query, params)

    def get_connection_by_state(self, state: str) -> Optional[dict[str, Any]]:
        query = """
            select
                provider,
                state,
                external_user_id,
                username,
                full_name,
                access_token,
                refresh_token,
                scopes,
                token_expires_at,
                metadata,
                created_at,
                updated_at
            from integration_connections
            where state = %(state)s
            limit 1
        """
        return self._fetch_one(query, {"state": state})

    def get_latest_connection(self, provider: str) -> Optional[dict[str, Any]]:
        query = """
            select
                provider,
                state,
                external_user_id,
                username,
                full_name,
                access_token,
                refresh_token,
                scopes,
                token_expires_at,
                metadata,
                created_at,
                updated_at
            from integration_connections
            where provider = %(provider)s
              and access_token is not null
            order by updated_at desc
            limit 1
        """
        return self._fetch_one(query, {"provider": provider})

    def list_connector_overview(self) -> list[dict[str, Any]]:
        query = """
            select distinct on (ic.provider)
                ic.provider,
                ic.state,
                ic.external_user_id,
                ic.username,
                ic.full_name,
                ic.scopes,
                ic.token_expires_at,
                ic.metadata,
                ic.created_at,
                ic.updated_at,
                (
                    select csr.created_at
                    from connector_sync_runs csr
                    where csr.provider = ic.provider
                    order by csr.created_at desc
                    limit 1
                ) as last_synced_at,
                (
                    select csr.external_resource_name
                    from connector_sync_runs csr
                    where csr.provider = ic.provider
                    order by csr.created_at desc
                    limit 1
                ) as last_synced_resource_name
            from integration_connections ic
            where ic.access_token is not null
            order by ic.provider, ic.updated_at desc
        """
        return self._fetch_all(query, {})

    def delete_connections_by_provider(self, provider: str) -> None:
        query = "delete from integration_connections where provider = %(provider)s"
        self._execute(query, {"provider": provider})

    def save_sync_run(
        self,
        *,
        provider: str,
        connection_state: str,
        external_resource_id: str,
        external_resource_name: Optional[str],
        imported_widget_count: int,
        extracted_text: list[str],
        insights: dict[str, Any],
    ) -> None:
        query = """
            insert into connector_sync_runs (
                provider,
                connection_state,
                external_resource_id,
                external_resource_name,
                imported_widget_count,
                extracted_text,
                insights
            )
            values (
                %(provider)s,
                %(connection_state)s,
                %(external_resource_id)s,
                %(external_resource_name)s,
                %(imported_widget_count)s,
                %(extracted_text)s::jsonb,
                %(insights)s::jsonb
            )
        """
        params = {
            "provider": provider,
            "connection_state": connection_state,
            "external_resource_id": external_resource_id,
            "external_resource_name": external_resource_name,
            "imported_widget_count": imported_widget_count,
            "extracted_text": json.dumps(extracted_text),
            "insights": json.dumps(insights),
        }
        self._execute(query, params)

    def _execute(self, query: str, params: dict[str, Any]) -> None:
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, params)

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

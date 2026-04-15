from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Iterator

from fastapi import HTTPException, status

from app.core.config import settings

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - dependency availability is environment-specific
    psycopg = None
    dict_row = None


CONNECT_RETRY_ATTEMPTS = 3
CONNECT_RETRY_DELAY_SECONDS = 0.35


@contextmanager
def get_db_connection() -> Iterator["psycopg.Connection"]:
    if not settings.supabase_db_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_DB_URL is not configured.",
        )
    if psycopg is None or dict_row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="psycopg is not installed in the current environment.",
        )

    connection = None
    last_error = None
    for attempt in range(CONNECT_RETRY_ATTEMPTS):
        try:
            connection = psycopg.connect(
                settings.supabase_db_url,
                row_factory=dict_row,
                connect_timeout=10,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=3,
            )
            break
        except psycopg.OperationalError as exc:
            last_error = exc
            if attempt == CONNECT_RETRY_ATTEMPTS - 1:
                raise
            time.sleep(CONNECT_RETRY_DELAY_SECONDS * (attempt + 1))

    if connection is None:
        raise RuntimeError("Failed to establish a Postgres connection.") from last_error

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

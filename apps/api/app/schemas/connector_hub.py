from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ConnectorSummary(BaseModel):
    provider: str
    label: str
    category: str
    connected: bool
    display_name: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    base_url: Optional[str] = None
    account_id: Optional[str] = None
    state: Optional[str] = None
    last_connected_at: Optional[datetime] = None
    last_synced_at: Optional[datetime] = None
    last_synced_resource_name: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class ConnectorListResponse(BaseModel):
    connectors: list[ConnectorSummary] = Field(default_factory=list)

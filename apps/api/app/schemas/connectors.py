from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.schemas.common import InsightBundle


class ConnectorAuthorizationResponse(BaseModel):
    provider: str
    authorization_url: str
    state: str


class MuralConnectionStatus(BaseModel):
    provider: str = "mural"
    connected: bool
    state: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    scopes: list[str] = []


class MuralWorkspace(BaseModel):
    id: str
    name: str
    member_count: Optional[int] = None


class MuralRoom(BaseModel):
    id: str
    name: str
    workspace_id: str


class MuralBoard(BaseModel):
    id: str
    name: str
    workspace_id: str
    room_id: Optional[str] = None
    last_modified: Optional[str] = None


class MuralWidget(BaseModel):
    id: str
    type: str
    text: Optional[str] = None
    title: Optional[str] = None
    parent_id: Optional[str] = None
    raw: dict


class JourneyCategoryItems(BaseModel):
    experience_steps: list[str] = []
    interactions: list[str] = []
    goals_and_motivations: list[str] = []
    positive_moments: list[str] = []
    negative_moments: list[str] = []
    areas_of_opportunity: list[str] = []


class JourneyStageData(BaseModel):
    stage: str
    categories: JourneyCategoryItems


class JourneyExtraction(BaseModel):
    stages: list[JourneyStageData] = []
    uncategorized: list[str] = []


class MuralImportResponse(BaseModel):
    provider: str = "mural"
    mural_id: str
    mural_name: Optional[str] = None
    imported_widget_count: int
    extracted_text_count: int
    extracted_text: list[str]
    insights: InsightBundle
    journey: JourneyExtraction

from pydantic import BaseModel, Field


class APIError(BaseModel):
    detail: str = Field(..., examples=["Something went wrong"])


class ArtifactBase(BaseModel):
    title: str
    description: str = ""


class InsightBundle(BaseModel):
    action_items: list[str] = []
    decisions: list[str] = []
    pain_points: list[str] = []
    opportunities: list[str] = []


class StoryArtifact(ArtifactBase):
    acceptance_criteria: list[str] = []
    edge_cases: list[str] = []
    priority: str = "medium"
    dependencies: list[str] = []


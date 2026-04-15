from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    workshops: int
    initiatives: int
    features: int
    ready_stories: int
    active_flows: int

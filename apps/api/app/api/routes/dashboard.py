from fastapi import APIRouter, Depends

from app.api.deps import get_pipeline_service
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    service: PipelineService = Depends(get_pipeline_service),
) -> DashboardSummaryResponse:
    return service.get_dashboard_summary()

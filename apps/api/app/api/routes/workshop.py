from fastapi import APIRouter, Depends

from app.api.deps import get_pipeline_service
from app.schemas.workshop import WorkshopAnalyzeRequest, WorkshopAnalyzeResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/analyze", response_model=WorkshopAnalyzeResponse)
async def analyze_workshop(
    payload: WorkshopAnalyzeRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> WorkshopAnalyzeResponse:
    return service.analyze_workshop(payload)


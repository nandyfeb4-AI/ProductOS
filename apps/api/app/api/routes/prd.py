from fastapi import APIRouter, Depends

from app.api.deps import get_pipeline_service
from app.schemas.prd import PRDGenerateRequest, PRDGenerateResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/generate", response_model=PRDGenerateResponse)
async def generate_prd(
    payload: PRDGenerateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> PRDGenerateResponse:
    return service.generate_prd(payload)


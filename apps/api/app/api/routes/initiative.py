from fastapi import APIRouter, Depends

from app.api.deps import get_pipeline_service
from app.schemas.initiative import InitiativeGenerateRequest, InitiativeGenerateResponse
from app.services.pipeline_service import PipelineService

router = APIRouter()


@router.post("/generate", response_model=InitiativeGenerateResponse)
async def generate_initiatives(
    payload: InitiativeGenerateRequest,
    service: PipelineService = Depends(get_pipeline_service),
) -> InitiativeGenerateResponse:
    return service.generate_initiatives(payload)


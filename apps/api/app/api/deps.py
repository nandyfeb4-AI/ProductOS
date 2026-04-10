from functools import lru_cache

from app.services.pipeline_service import PipelineService


@lru_cache
def get_pipeline_service() -> PipelineService:
    return PipelineService()


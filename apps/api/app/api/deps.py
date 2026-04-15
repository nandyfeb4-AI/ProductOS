from functools import lru_cache

from app.services.pipeline_service import PipelineService
from app.services.job_service import JobService


@lru_cache
def get_pipeline_service() -> PipelineService:
    return PipelineService()


@lru_cache
def get_job_service() -> JobService:
    return JobService()

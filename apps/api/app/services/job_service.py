from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from fastapi import HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from app.repositories.job_repository import JobRepository
from app.schemas.jobs import GenerationJob


logger = logging.getLogger(__name__)


class JobSocketManager:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, job_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._subscribers[job_id].add(websocket)

    def disconnect(self, job_id: str, websocket: WebSocket) -> None:
        subscribers = self._subscribers.get(job_id)
        if subscribers is None:
            return
        subscribers.discard(websocket)
        if not subscribers:
            self._subscribers.pop(job_id, None)

    async def broadcast(self, job: GenerationJob) -> None:
        subscribers = list(self._subscribers.get(job.id, set()))
        payload = {"event": "job.updated", "job": job.model_dump(mode="json")}
        stale: list[WebSocket] = []
        for websocket in subscribers:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(job.id, websocket)


class JobService:
    def __init__(self) -> None:
        self.repository = JobRepository()
        self.socket_manager = JobSocketManager()
        self._tasks: dict[str, asyncio.Task[None]] = {}

    def get_job(self, job_id: str) -> GenerationJob:
        row = self.repository.get_job(job_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
        return GenerationJob(**row)

    def enqueue(
        self,
        *,
        job_type: str,
        input_payload: dict[str, Any],
        project_id: str | None = None,
        agent_key: str | None = None,
        agent_label: str | None = None,
        queued_stage: str,
        queued_message: str,
        running_stage: str,
        running_message: str,
        runner: Callable[[], Any],
    ) -> GenerationJob:
        row = self.repository.create_job(
            job_type=job_type,
            input_payload=input_payload,
            project_id=project_id,
            agent_key=agent_key,
            agent_label=agent_label,
            progress_stage=queued_stage,
            progress_message=queued_message,
        )
        job = GenerationJob(**row)
        self._tasks[job.id] = asyncio.create_task(
            self._run_job(
                job_id=job.id,
                running_stage=running_stage,
                running_message=running_message,
                runner=runner,
            )
        )
        return job

    async def stream(self, job_id: str, websocket: WebSocket) -> None:
        try:
            job = self.get_job(job_id)
        except HTTPException:
            await websocket.close(code=4404)
            return
        await self.socket_manager.connect(job_id, websocket)
        try:
            await websocket.send_json({"event": "job.updated", "job": job.model_dump(mode="json")})
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            self.socket_manager.disconnect(job_id, websocket)
        except Exception:
            self.socket_manager.disconnect(job_id, websocket)

    async def _run_job(
        self,
        *,
        job_id: str,
        running_stage: str,
        running_message: str,
        runner: Callable[[], Any],
    ) -> None:
        try:
            job = await self._update_and_broadcast(
                job_id=job_id,
                status="running",
                progress_stage=running_stage,
                progress_message=running_message,
                error_message=None,
            )
            result = await asyncio.to_thread(runner)
            result_payload = self._serialize(result)
            await self._update_and_broadcast(
                job_id=job.id,
                status="completed",
                progress_stage="completed",
                progress_message="Generation completed.",
                result_payload=result_payload,
                completed_at=datetime.now(timezone.utc),
                error_message=None,
            )
        except Exception as exc:
            logger.exception("Async generation job %s failed", job_id)
            await self._update_and_broadcast(
                job_id=job_id,
                status="failed",
                progress_stage="failed",
                progress_message="Generation failed.",
                error_message=str(exc),
                completed_at=datetime.now(timezone.utc),
            )
        finally:
            self._tasks.pop(job_id, None)

    async def _update_and_broadcast(
        self,
        *,
        job_id: str,
        status: str,
        progress_stage: str | None = None,
        progress_message: str | None = None,
        result_payload: dict[str, Any] | None = None,
        error_message: str | None = None,
        completed_at: datetime | None = None,
    ) -> GenerationJob:
        row = await asyncio.to_thread(
            self.repository.update_job,
            job_id=job_id,
            status=status,
            progress_stage=progress_stage,
            progress_message=progress_message,
            result_payload=result_payload,
            error_message=error_message,
            completed_at=completed_at,
        )
        job = GenerationJob(**row)
        await self.socket_manager.broadcast(job)
        return job

    def _serialize(self, value: Any) -> dict[str, Any]:
        if isinstance(value, BaseModel):
            return value.model_dump(mode="json")
        if isinstance(value, dict):
            return value
        raise TypeError(f"Unsupported job result type: {type(value)!r}")

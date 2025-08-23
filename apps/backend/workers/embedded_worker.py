"""
Embedded Worker System - Runs as background tasks within the main process.

This approach is better for indie hackers because:
1. No subprocess complexity
2. Shared database connections
3. Better error handling and logging
4. Easier debugging
5. Automatic cleanup on shutdown
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime

from loguru import logger
from redis import Redis
from sqlalchemy.orm import Session

from db import ai_crud
from db.models import JobStatus, ModelBackend
from db.session import get_session
from runners.mlx import MLXRunner
from runners.ollama import OllamaRunner

# Runner mapping
RUNNERS = {
    ModelBackend.ollama: OllamaRunner,
    ModelBackend.mlx: MLXRunner,
}


class EmbeddedWorkerManager:
    """Manages background task workers within the main process."""

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis_url = redis_url
        self.redis_conn: Redis | None = None
        self.job_queue_key = "job_processing"
        self.running = False
        self.worker_tasks: list[asyncio.Task] = []

    async def start(self, num_workers: int = 1) -> bool:
        """Start embedded workers."""
        try:
            # Test Redis connection
            self.redis_conn = Redis.from_url(self.redis_url, decode_responses=True)
            self.redis_conn.ping()

            logger.info(f"Redis connection successful at {self.redis_url}")

            # Start worker tasks
            self.running = True
            for i in range(num_workers):
                task = asyncio.create_task(self._worker_loop(i + 1))
                self.worker_tasks.append(task)
                logger.info(f"Started embedded worker {i + 1}")

            return True

        except Exception as e:
            logger.warning(f"Could not start Redis workers: {e}")
            return False

    async def stop(self) -> None:
        """Stop all workers gracefully."""
        logger.info("Stopping embedded workers...")
        self.running = False

        # Cancel all worker tasks
        for task in self.worker_tasks:
            task.cancel()

        # Wait for tasks to complete
        if self.worker_tasks:
            await asyncio.gather(*self.worker_tasks, return_exceptions=True)

        self.worker_tasks.clear()
        logger.info("All embedded workers stopped")

    async def _worker_loop(self, worker_id: int) -> None:
        """Main worker loop - polls for jobs and processes them."""
        logger.info(f"Worker {worker_id} started")

        while self.running:
            try:
                # Pop job from Redis list (blocking with timeout)
                job_data = self.redis_conn.blpop([self.job_queue_key], timeout=1)

                if job_data is not None:
                    # job_data is a tuple: (queue_name, job_id)
                    job_id_str = job_data[1]
                    logger.info(f"Worker {worker_id} processing job {job_id_str}")
                    await self._process_job_direct(job_id_str, worker_id)
                else:
                    # No jobs available, continue loop
                    await asyncio.sleep(0.1)

            except asyncio.CancelledError:
                logger.info(f"Worker {worker_id} cancelled")
                break
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}")
                await asyncio.sleep(5)  # Wait before retrying

        logger.info(f"Worker {worker_id} stopped")

    async def _process_job_direct(self, job_id_str: str, worker_id: int) -> None:
        """Process a single job directly."""
        try:
            job_id = uuid.UUID(job_id_str)

            # Get database session
            db = next(get_session())
            try:
                result = await self._execute_job(job_id, db, worker_id)
                logger.info(f"Worker {worker_id}: Job {job_id} completed successfully")

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Worker {worker_id}: Job processing failed: {e}")

    async def _execute_job(self, job_id: uuid.UUID, db: Session, worker_id: int) -> dict:
        """Execute the actual AI job."""
        job = ai_crud.get_job(db, job_id=job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        logger.info(f"Worker {worker_id}: Executing job {job_id} for model {job.model_name}")

        # Update job status to running
        ai_crud.update_job_status(
            db,
            job_id=job_id,
            status=JobStatus.running,
            started_at=datetime.utcnow(),
        )

        try:
            # Get the appropriate runner
            runner_class = RUNNERS.get(job.backend)
            if not runner_class:
                raise ValueError(f"No runner available for backend: {job.backend}")

            # Initialize runner based on backend type
            if job.backend == ModelBackend.ollama:
                runner = runner_class(job.model_name)
            elif job.backend == ModelBackend.mlx:
                # For MLX, we might need model path from config
                model = ai_crud.get_model_by_name(db, name=job.model_name)
                if model and model.config and "model_path" in model.config:
                    path_value = model.config["model_path"]
                    if path_value is not None:
                        runner = runner_class(job.model_name, str(path_value))
                    else:
                        runner = runner_class(job.model_name)
                else:
                    runner = runner_class(job.model_name)
            else:
                runner = runner_class(job.model_name)

            # Execute the job
            result = await runner.run(job.prompt, job.parameters)

            # Update job with result
            if result.success:
                ai_crud.update_job_status(
                    db,
                    job_id=job_id,
                    status=JobStatus.completed,
                    result=result.to_dict(),
                    execution_time_ms=result.execution_time_ms,
                    completed_at=datetime.utcnow(),
                )
                logger.info(f"Worker {worker_id}: Job {job_id} completed successfully")
                return result.to_dict()
            else:
                ai_crud.update_job_status(
                    db,
                    job_id=job_id,
                    status=JobStatus.failed,
                    error_message=result.error,
                    execution_time_ms=result.execution_time_ms,
                    completed_at=datetime.utcnow(),
                )
                raise Exception(f"Job execution failed: {result.error}")

        except Exception as e:
            error_msg = f"Unexpected error executing job: {str(e)}"
            ai_crud.update_job_status(
                db,
                job_id=job_id,
                status=JobStatus.failed,
                error_message=error_msg,
                completed_at=datetime.utcnow(),
            )
            logger.error(f"Worker {worker_id}: Job {job_id} failed: {error_msg}")
            raise e

        finally:
            # Clean up runner resources if needed
            if "runner" in locals() and hasattr(runner, "__aexit__"):
                await runner.__aexit__(None, None, None)

    def enqueue_job(self, job_id: uuid.UUID) -> str | None:
        """Add a job to the processing queue."""
        if not self.redis_conn:
            return None

        try:
            # Push job ID to Redis list
            self.redis_conn.rpush(self.job_queue_key, str(job_id))
            logger.info(f"Enqueued job {job_id} to Redis queue")
            return str(job_id)
        except Exception as e:
            logger.error(f"Failed to enqueue job {job_id}: {e}")
            return None

    def get_queue_status(self) -> dict:
        """Get queue statistics."""
        if not self.redis_conn:
            return {
                "error": "Queue not available",
                "queued_jobs": 0,
                "failed_jobs": 0,
                "workers": 0,
            }

        try:
            queued_jobs = self.redis_conn.llen(self.job_queue_key)
            return {
                "queued_jobs": queued_jobs,
                "failed_jobs": 0,  # We don't track failed jobs separately yet
                "workers": len(self.worker_tasks),
            }
        except Exception as e:
            return {"error": str(e), "queued_jobs": 0, "failed_jobs": 0, "workers": 0}

    def get_worker_status(self) -> dict:
        """Get worker status."""
        active_workers = []

        for i, task in enumerate(self.worker_tasks):
            if not task.done():
                active_workers.append(
                    {"worker_id": i + 1, "status": "running", "task_name": task.get_name()}
                )
            else:
                active_workers.append(
                    {
                        "worker_id": i + 1,
                        "status": "dead",
                        "exception": str(task.exception()) if task.exception() else None,
                    }
                )

        return {
            "total_workers": len(self.worker_tasks),
            "active_workers": len([w for w in active_workers if w["status"] == "running"]),
            "dead_workers": len([w for w in active_workers if w["status"] == "dead"]),
            "workers": active_workers,
        }


# Global instance
embedded_worker_manager: EmbeddedWorkerManager | None = None

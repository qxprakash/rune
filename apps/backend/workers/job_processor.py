from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime

from loguru import logger
from redis import Redis
from rq import Queue, Worker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db import ai_crud
from db.models import JobStatus, ModelBackend
from runners.mlx import MLXRunner
from runners.ollama import OllamaRunner

# Redis connection
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_conn = Redis.from_url(REDIS_URL)
job_queue = Queue("job_processing", connection=redis_conn)

# Database setup for worker
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://rune:rune@localhost:5432/rune")
engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

# Runner mapping
RUNNERS = {
    ModelBackend.ollama: OllamaRunner,
    ModelBackend.mlx: MLXRunner,
}


def process_job(job_id_str: str) -> dict:
    """Process a job from the queue."""
    job_id = uuid.UUID(job_id_str)
    logger.info(f"Processing job {job_id}")

    db = SessionLocal()
    try:
        # Run the job synchronously (asyncio.run handles the async parts)
        result = asyncio.run(_execute_job_sync(job_id, db))
        return {"success": True, "job_id": job_id_str, "result": result}
    except Exception as e:
        logger.error(f"Job {job_id} failed with error: {e}")
        # Update job status to failed
        ai_crud.update_job_status(
            db,
            job_id=job_id,
            status=JobStatus.failed,
            error_message=str(e),
            completed_at=datetime.utcnow(),
        )
        return {"success": False, "job_id": job_id_str, "error": str(e)}
    finally:
        db.close()


async def _execute_job_sync(job_id: uuid.UUID, db) -> dict:
    """Execute a job using the appropriate runner (async version for worker)."""
    job = ai_crud.get_job(db, job_id=job_id)
    if not job:
        raise ValueError(f"Job {job_id} not found")

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
                model_path = str(path_value) if path_value is not None else None
                runner = runner_class(job.model_name, model_path)
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
            logger.info(f"Job {job_id} completed successfully")
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
        raise e

    finally:
        # Clean up runner resources if needed
        if hasattr(runner, "__aexit__"):
            await runner.__aexit__(None, None, None)


def enqueue_job(job_id: uuid.UUID) -> str:
    """Add a job to the processing queue."""
    job = job_queue.enqueue(process_job, str(job_id), job_timeout="10m")
    logger.info(f"Enqueued job {job_id} with queue job ID: {job.id}")
    return job.id


def get_queue_status() -> dict:
    """Get queue statistics."""
    return {
        "queued_jobs": len(job_queue),
        "failed_jobs": len(job_queue.failed_job_registry),
        "workers": len(Worker.all(connection=redis_conn)),
    }


if __name__ == "__main__":
    # Run worker
    logger.info("Starting job worker...")
    worker = Worker([job_queue], connection=redis_conn)
    worker.work()

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy.orm import Session

from db import ai_crud
from db.models import JobStatus, ModelBackend
from db.session import get_session
from runners.ollama import OllamaRunner
from schemas import (
    HealthResponse,
    JobBase,
    JobCreateResponse,
    JobResponse,
    JobsListResponse,
    ModelCreate,
    ModelResponse,
    ModelsListResponse,
    ModelUpdate,
)

router = APIRouter()

# Runner mapping
RUNNERS = {
    ModelBackend.ollama: OllamaRunner,
}


@router.get("/health", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_session)) -> HealthResponse:
    """Health check endpoint."""
    try:
        # Test database connection
        from sqlalchemy import text

        db.execute(text("SELECT 1"))
        database_ok = True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        database_ok = False

    # Check runner availability
    runners_status = {}
    for backend, runner_class in RUNNERS.items():
        try:
            # For Ollama, create a temporary instance to check
            if backend == ModelBackend.ollama:
                runner = runner_class("test")
                runners_status[backend.value] = runner.is_available()
            else:
                runners_status[backend.value] = False
        except Exception as e:
            logger.error(f"Runner {backend} health check failed: {e}")
            runners_status[backend.value] = False

    return HealthResponse(
        status="ok" if database_ok else "degraded",
        database=database_ok,
        runners=runners_status,
    )


# Model Management Routes


@router.post("/models", response_model=ModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(
    model_data: ModelCreate,
    db: Session = Depends(get_session),
) -> ModelResponse:
    """Create a new model."""
    # Check if model with same name already exists
    existing = ai_crud.get_model_by_name(db, name=model_data.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Model with name '{model_data.name}' already exists",
        )

    model = ai_crud.create_model(
        db,
        name=model_data.name,
        backend=model_data.backend,
        config=model_data.config,
        description=model_data.description,
    )

    logger.info(f"Created model: {model.name} ({model.backend})")
    return ModelResponse.model_validate(model)


@router.get("/models", response_model=ModelsListResponse)
async def list_models(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_session),
) -> ModelsListResponse:
    """List all models."""
    models = ai_crud.get_models(db, skip=skip, limit=limit, active_only=active_only)
    total = len(models)  # For now, simple count

    return ModelsListResponse(
        models=[ModelResponse.model_validate(model) for model in models],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/models/{model_id}", response_model=ModelResponse)
async def get_model(
    model_id: uuid.UUID,
    db: Session = Depends(get_session),
) -> ModelResponse:
    """Get a specific model by ID."""
    model = ai_crud.get_model(db, model_id=model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with ID {model_id} not found",
        )
    return ModelResponse.model_validate(model)


@router.put("/models/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: uuid.UUID,
    model_data: ModelUpdate,
    db: Session = Depends(get_session),
) -> ModelResponse:
    """Update a model."""
    model = ai_crud.update_model(
        db,
        model_id=model_id,
        name=model_data.name,
        config=model_data.config,
        description=model_data.description,
        is_active=model_data.is_active,
    )

    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with ID {model_id} not found",
        )

    logger.info(f"Updated model: {model.name}")
    return ModelResponse.model_validate(model)


@router.delete("/models/{model_id}")
async def delete_model(
    model_id: uuid.UUID,
    db: Session = Depends(get_session),
) -> dict[str, str]:
    """Delete a model (soft delete)."""
    success = ai_crud.delete_model(db, model_id=model_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with ID {model_id} not found",
        )

    return {"message": "Model deleted successfully"}


# Job Management Routes


@router.post("/run/{model_name}", response_model=JobCreateResponse)
async def create_job(
    model_name: str,
    job_data: JobBase,  # Changed from JobCreate to JobBase
    db: Session = Depends(get_session),
) -> JobCreateResponse:
    """Create and queue a job for a model."""
    # Get the model
    model = ai_crud.get_model_by_name(db, name=model_name)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_name}' not found",
        )

    if not model.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model '{model_name}' is not active",
        )

    # Create job record
    job = ai_crud.create_job(
        db,
        model_name=model_name,
        backend=model.backend,
        prompt=job_data.prompt,
        parameters=job_data.parameters,
    )

    logger.info(f"Created job {job.id} for model {model_name}")

    # For MVP, we'll run synchronously (later we'll add queue processing)
    await _execute_job(job.id, db)

    return JobCreateResponse(
        job_id=job.id,
        message="Job created and processing",
    )


@router.get("/jobs", response_model=JobsListResponse)
async def list_jobs(
    skip: int = 0,
    limit: int = 100,
    model_name: str | None = None,
    status_filter: JobStatus | None = None,
    db: Session = Depends(get_session),
) -> JobsListResponse:
    """List jobs with optional filtering."""
    jobs = ai_crud.get_jobs(
        db,
        skip=skip,
        limit=limit,
        model_name=model_name,
        status=status_filter,
    )
    total = len(jobs)  # Simple count for now

    return JobsListResponse(
        jobs=[JobResponse.model_validate(job) for job in jobs],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_session),
) -> JobResponse:
    """Get a specific job by ID."""
    job = ai_crud.get_job(db, job_id=job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with ID {job_id} not found",
        )
    return JobResponse.model_validate(job)


# Helper Functions


async def _execute_job(job_id: uuid.UUID, db: Session) -> None:
    """Execute a job using the appropriate runner."""
    job = ai_crud.get_job(db, job_id=job_id)
    if not job:
        logger.error(f"Job {job_id} not found")
        return

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

        # For Ollama, we need to pass the model name
        if job.backend == ModelBackend.ollama:
            runner = runner_class(job.model_name)
        else:
            runner = runner_class()

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
        else:
            ai_crud.update_job_status(
                db,
                job_id=job_id,
                status=JobStatus.failed,
                error_message=result.error,
                execution_time_ms=result.execution_time_ms,
                completed_at=datetime.utcnow(),
            )
            logger.error(f"Job {job_id} failed: {result.error}")

    except Exception as e:
        error_msg = f"Unexpected error executing job: {str(e)}"
        ai_crud.update_job_status(
            db,
            job_id=job_id,
            status=JobStatus.failed,
            error_message=error_msg,
            completed_at=datetime.utcnow(),
        )
        logger.error(f"Job {job_id} failed: {error_msg}")

    finally:
        # Clean up runner resources if needed
        if hasattr(runner, "__aexit__"):
            await runner.__aexit__(None, None, None)

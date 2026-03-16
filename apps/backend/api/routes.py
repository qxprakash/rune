from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from loguru import logger
from sqlalchemy.orm import Session

from db import ai_crud
from db.models import JobStatus, ModelBackend
from db.session import get_session
from runners.mlx import MLXRunner
from runners.ollama import OllamaRunner
from runners.pytorch import PyTorchRunner
from runners.whisper import WhisperRunner
from schemas import (
    BatchJobCreate,
    BatchJobResponse,
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
from utils.system_monitor import SystemMonitor

router = APIRouter()

# Runner mapping
RUNNERS = {
    ModelBackend.ollama: OllamaRunner,
    ModelBackend.mlx: MLXRunner,
    ModelBackend.pytorch: PyTorchRunner,
    ModelBackend.whisper: WhisperRunner,
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

    runners_status = {}
    for backend, runner_class in RUNNERS.items():
        try:
            # Create temporary instance to check availability
            if backend == ModelBackend.ollama:
                runner = runner_class("test")
                runners_status[backend.value] = runner.is_available()
            elif backend == ModelBackend.mlx:
                runner = runner_class("test")
                runners_status[backend.value] = runner.is_available()
            elif backend == ModelBackend.pytorch:
                runner = runner_class("test")
                runners_status[backend.value] = runner.is_available()
            elif backend == ModelBackend.whisper:
                runner = runner_class("openai/whisper-tiny")
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


@router.get("/models/discover", response_model=dict[str, list[str]])
async def discover_models() -> dict[str, list[str]]:
    discovered = {}

    if ModelBackend.ollama in RUNNERS:
        runner_class = RUNNERS[ModelBackend.ollama]
        try:
            runner = runner_class("test")
            if runner.is_available():
                discovered["ollama"] = runner_class.list_available_models()
            else:
                discovered["ollama"] = []
        except Exception as e:
            logger.error(f"Failed to discover Ollama models: {e}")
            discovered["ollama"] = []

    if ModelBackend.mlx in RUNNERS:
        runner_class = RUNNERS[ModelBackend.mlx]
        try:
            runner = runner_class("test")
            if runner.is_available():
                discovered["mlx"] = runner_class.list_available_models()
            else:
                discovered["mlx"] = []
        except Exception as e:
            logger.error(f"Failed to discover MLX models: {e}")
            discovered["mlx"] = []

    if ModelBackend.pytorch in RUNNERS:
        runner_class = RUNNERS[ModelBackend.pytorch]
        try:
            runner = runner_class("test")
            if runner.is_available():
                discovered["pytorch"] = runner_class.list_available_models()
            else:
                discovered["pytorch"] = []
        except Exception as e:
            logger.error(f"Failed to discover PyTorch models: {e}")
            discovered["pytorch"] = []

    if ModelBackend.whisper in RUNNERS:
        runner_class = RUNNERS[ModelBackend.whisper]
        try:
            runner = runner_class("openai/whisper-tiny")
            if runner.is_available():
                discovered["whisper"] = runner_class.list_available_models()
            else:
                discovered["whisper"] = []
        except Exception as e:
            logger.error(f"Failed to discover Whisper models: {e}")
            discovered["whisper"] = []

    return discovered


@router.post("/models/register-discovered", response_model=list[ModelResponse])
async def register_discovered_models(
    backend: ModelBackend,
    model_names: list[str],
    db: Session = Depends(get_session),
) -> list[ModelResponse]:
    """Register multiple discovered models at once."""
    registered_models = []

    for model_name in model_names:
        # Check if model already exists
        existing = ai_crud.get_model_by_name(db, name=model_name)
        if existing:
            logger.info(f"Model {model_name} already exists, skipping")
            continue

        # Create default config based on backend
        config = {}
        if backend == ModelBackend.mlx:
            config = {
                "model_path": f"mlx-community/{model_name}",
                "temperature": 0.7,
                "max_tokens": 512,
            }
        elif backend == ModelBackend.ollama:
            config = {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40,
            }
        elif backend == ModelBackend.pytorch:
            config = {
                "temperature": 0.7,
                "max_new_tokens": 512,
                "top_p": 0.9,
                "top_k": 50,
                "do_sample": True,
                "repetition_penalty": 1.1,
            }
        elif backend == ModelBackend.whisper:
            config = {
                "language": None,
                "task": "transcribe",
                "return_timestamps": False,
            }

        try:
            model = ai_crud.create_model(
                db,
                name=model_name,
                backend=backend,
                config=config,
                description=f"Auto-discovered {backend.value} model",
            )
            registered_models.append(ModelResponse.model_validate(model))
            logger.info(f"Registered model: {model_name} ({backend.value})")
        except Exception as e:
            logger.error(f"Failed to register model {model_name}: {e}")

    return registered_models


@router.get("/models/{model_id}", response_model=ModelResponse)
async def get_model(
    model_id: uuid.UUID,
    db: Session = Depends(get_session),
) -> ModelResponse:
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


@router.delete("/models/{model_id}/deregister")
async def deregister_model(
    model_id: uuid.UUID,
    force: bool = False,
    db: Session = Depends(get_session),
) -> dict[str, Any]:
    """
    Deregister a model completely from the system.

    This endpoint:
    - Removes the model record from the database (hard delete)
    - Validates no active jobs are using the model (unless force=True)
    - Cancels running/queued jobs if force=True
    - Clears model cache
    - Provides detailed cleanup information

    Args:
        model_id: UUID of the model to deregister
        force: If True, force deregistration even with active jobs

    Returns:
        Deregistration results with cleanup details
    """
    # Get the model first to check if it exists and get its name
    model = ai_crud.get_model(db, model_id=model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with ID {model_id} not found",
        )

    logger.info(f"Attempting to deregister model: {model.name} (ID: {model_id}, force: {force})")

    # Perform deregistration
    result = ai_crud.deregister_model(db, model_id=model_id, force=force)

    if not result["success"]:
        # Check if it's a validation error (active jobs) or system error
        if "active jobs" in result.get("error", ""):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": result["error"],
                    "details": result.get("details", {}),
                    "model_name": model.name,
                },
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result["error"]
            )

    # If we have running/queued jobs and force=True, also clear them from the queue
    if force and result.get("cleanup", {}).get("jobs_affected", 0) > 0:
        try:
            from main import embedded_worker_manager

            if embedded_worker_manager:
                # Clear any queued jobs for this model from Redis
                # Note: This is a best-effort cleanup since we can't easily filter by model name
                queue_status = embedded_worker_manager.get_queue_status()
                logger.info(f"Queue status during model deregistration: {queue_status}")
        except Exception as e:
            logger.warning(f"Could not clear queue during model deregistration: {e}")

    logger.info(f"Successfully deregistered model: {model.name}")

    return {
        "message": result["message"],
        "model_name": model.name,
        "model_id": str(model_id),
        "deregistration_details": result["cleanup"],
        "forced": force,
    }


@router.post("/models/deregister-bulk")
async def deregister_models_bulk(
    model_data: dict[str, Any],
    db: Session = Depends(get_session),
) -> dict[str, Any]:
    """
    Deregister multiple models in bulk.

    Request body:
    {
        "model_ids": ["uuid1", "uuid2", ...],
        "force": false,
        "inactive_only": true  // Only deregister inactive models
    }
    """
    model_ids = model_data.get("model_ids", [])
    force = model_data.get("force", False)
    inactive_only = model_data.get("inactive_only", True)

    if not model_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No model IDs provided")

    results = {
        "successful": [],
        "failed": [],
        "skipped": [],
        "total_requested": len(model_ids),
        "summary": {},
    }

    for model_id_str in model_ids:
        try:
            model_id = uuid.UUID(model_id_str)
            model = ai_crud.get_model(db, model_id=model_id)

            if not model:
                results["failed"].append({"model_id": model_id_str, "error": "Model not found"})
                continue

            # Skip active models if inactive_only is True
            if inactive_only and model.is_active:
                results["skipped"].append(
                    {
                        "model_id": model_id_str,
                        "model_name": model.name,
                        "reason": "Model is active (use inactive_only=false to include)",
                    }
                )
                continue

            # Attempt deregistration
            result = ai_crud.deregister_model(db, model_id=model_id, force=force)

            if result["success"]:
                results["successful"].append(
                    {
                        "model_id": model_id_str,
                        "model_name": model.name,
                        "cleanup": result["cleanup"],
                    }
                )
            else:
                results["failed"].append(
                    {"model_id": model_id_str, "model_name": model.name, "error": result["error"]}
                )

        except ValueError:
            results["failed"].append({"model_id": model_id_str, "error": "Invalid UUID format"})
        except Exception as e:
            results["failed"].append(
                {"model_id": model_id_str, "error": f"Unexpected error: {str(e)}"}
            )

    # Generate summary
    success_rate = (
        f"{len(results['successful']) / len(model_ids) * 100:.1f}%" if model_ids else "0%"
    )
    results["summary"] = {
        "successful_count": len(results["successful"]),
        "failed_count": len(results["failed"]),
        "skipped_count": len(results["skipped"]),
        "success_rate": success_rate,
    }

    logger.info(f"Bulk deregistration completed: {results['summary']}")

    return results


@router.post("/models/validate")
async def validate_model_name(
    model_data: dict[str, str],
    db: Session = Depends(get_session),
) -> dict[str, str | bool]:
    """Validate a model name and suggest corrections if invalid."""
    from runners.pytorch import PyTorchRunner

    model_name = model_data.get("name", "")
    if not model_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Model name is required",
        )

    # Check if model is valid
    pytorch_runner = PyTorchRunner("", {})
    is_valid = pytorch_runner.validate_model_name(model_name)

    response = {
        "is_valid": is_valid,
        "model_name": model_name,
    }

    if not is_valid:
        suggestion = pytorch_runner.suggest_model_name(model_name)
        if suggestion:
            response["suggestion"] = suggestion
            response["message"] = f"Model '{model_name}' is not valid. Did you mean '{suggestion}'?"
        else:
            response["message"] = f"Model '{model_name}' is not a valid model identifier."
    else:
        response["message"] = f"Model '{model_name}' is valid."

    return response


# Job Management Routes


@router.post("/run/{model_name:path}", response_model=JobCreateResponse)
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
        task_type=job_data.task_type,
        input_files=job_data.input_files,
        parameters=job_data.parameters,
    )

    logger.info(f"Created job {job.id} for model {model_name}")

    # Try to use embedded worker queue first, fallback to synchronous processing
    try:
        from main import embedded_worker_manager

        if embedded_worker_manager:
            queue_job_id = embedded_worker_manager.enqueue_job(job.id)
            if queue_job_id:
                return JobCreateResponse(
                    job_id=job.id,
                    message=f"Job created and queued (queue ID: {queue_job_id})",
                )
            else:
                logger.warning("Failed to enqueue job, falling back to synchronous processing")
        else:
            logger.info("No embedded workers available, using synchronous processing")

        # Synchronous fallback processing
        await _execute_job(job.id, db)
        return JobCreateResponse(
            job_id=job.id,
            message="Job created and processed synchronously",
        )

    except Exception as e:
        # If all processing fails, update job status to failed
        ai_crud.update_job_status(
            db,
            job_id=job.id,
            status=JobStatus.failed,
            error_message=f"Failed to process job: {str(e)}",
            completed_at=datetime.utcnow(),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process job: {str(e)}",
        )


@router.post("/run/{model_name:path}/audio", response_model=JobCreateResponse)
async def create_audio_job(
    model_name: str,
    audio: UploadFile = File(..., description="Audio file to process"),
    task_type: str = Form(default="speech_to_text", description="Type of AI task"),
    parameters: str = Form(default="{}", description="Model parameters as JSON string"),
    db: Session = Depends(get_session),
) -> JobCreateResponse:
    """Create and queue a job for a model with audio file input."""
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

    # Validate audio file
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be an audio file",
        )

    # Parse parameters
    try:
        params_dict = json.loads(parameters)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parameters must be valid JSON",
        )

    # Save audio file temporarily
    os.makedirs("tmp", exist_ok=True)
    temp_file_path = f"tmp/{uuid.uuid4()}_{audio.filename}"

    try:
        # Read and save the audio file
        audio_content = await audio.read()
        with open(temp_file_path, "wb") as temp_file:
            temp_file.write(audio_content)

        # Create job record with file path
        job = ai_crud.create_job(
            db,
            model_name=model_name,
            backend=model.backend,
            prompt="",  # Empty prompt for audio tasks
            task_type=task_type,
            input_files=[temp_file_path],
            parameters=params_dict,
        )

        logger.info(f"Created audio job {job.id} for model {model_name} with file {temp_file_path}")

        # Try to use embedded worker queue first, fallback to synchronous processing
        try:
            from main import embedded_worker_manager

            if embedded_worker_manager:
                queue_job_id = embedded_worker_manager.enqueue_job(job.id)
                if queue_job_id:
                    return JobCreateResponse(
                        job_id=job.id,
                        message=f"Audio job created and queued (queue ID: {queue_job_id})",
                    )
                else:
                    logger.warning("Failed to enqueue job, falling back to synchronous processing")
            else:
                logger.info("No embedded workers available, using synchronous processing")

            # Synchronous fallback processing
            await _execute_job(job.id, db)
            return JobCreateResponse(
                job_id=job.id,
                message="Audio job created and processed synchronously",
            )

        except Exception as e:
            # Clean up temp file on error
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)

            # If all processing fails, update job status to failed
            ai_crud.update_job_status(
                db,
                job_id=job.id,
                status=JobStatus.failed,
                error_message=f"Failed to process audio job: {str(e)}",
                completed_at=datetime.utcnow(),
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process audio job: {str(e)}",
            )

    except Exception as e:
        # Clean up temp file on any error
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        logger.error(f"Error processing audio job: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing audio file: {str(e)}",
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


@router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_session),
) -> dict[str, str]:
    """Cancel a queued or running job."""
    job = ai_crud.get_job(db, job_id=job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with ID {job_id} not found",
        )

    if job.status in [JobStatus.completed, JobStatus.failed]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job with status: {job.status}",
        )

    # Try to cancel the job
    from main import embedded_worker_manager

    if embedded_worker_manager:
        success = embedded_worker_manager.cancel_job(job_id)
        if success:
            # Update job status in database
            ai_crud.update_job_status(
                db, job_id, JobStatus.failed, error_message="Job cancelled by user"
            )
            logger.info(f"Successfully cancelled job {job_id}")
            return {"message": f"Job {job_id} cancelled successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to cancel job from queue",
            )
    else:
        # If no worker manager, just update status in database
        ai_crud.update_job_status(
            db, job_id, JobStatus.failed, error_message="Job cancelled by user"
        )
        logger.warning(f"Cancelled job {job_id} in database (no worker manager available)")
        return {"message": f"Job {job_id} cancelled in database"}


@router.post("/jobs/cancel-all")
async def cancel_all_jobs(
    db: Session = Depends(get_session),
) -> dict[str, str | int]:
    """Cancel all queued and running jobs."""
    from main import embedded_worker_manager

    cancelled_count = 0

    if embedded_worker_manager:
        # Clear the entire queue
        cancelled_count = embedded_worker_manager.clear_queue()

        # Update all queued/running jobs in database to failed status
        queued_jobs = ai_crud.get_jobs(db, status=JobStatus.queued, limit=1000)
        running_jobs = ai_crud.get_jobs(db, status=JobStatus.running, limit=1000)

        for job in queued_jobs + running_jobs:
            ai_crud.update_job_status(
                db, job.id, JobStatus.failed, error_message="Job cancelled by user (bulk cancel)"
            )
            cancelled_count += 1

        logger.info(f"Cancelled {cancelled_count} jobs in bulk operation")
        return {"message": f"Cancelled {cancelled_count} jobs", "cancelled_count": cancelled_count}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Worker manager not available",
        )


@router.post("/batch", response_model=BatchJobResponse)
async def create_batch_jobs(
    batch_data: BatchJobCreate,
    db: Session = Depends(get_session),
) -> BatchJobResponse:
    """Create multiple jobs in batch."""
    import time

    batch_id = f"batch_{int(time.time())}"
    created_jobs: list[uuid.UUID] = []
    failed_jobs: list[str] = []

    logger.info(f"Creating batch {batch_id} with {len(batch_data.jobs)} jobs")

    for i, job_data in enumerate(batch_data.jobs):
        try:
            # Get the model
            model = ai_crud.get_model_by_name(db, name=job_data.model_name)
            if not model:
                failed_jobs.append(f"Job {i}: Model '{job_data.model_name}' not found")
                continue

            if not model.is_active:
                failed_jobs.append(f"Job {i}: Model '{job_data.model_name}' is not active")
                continue

            # Create job record
            job = ai_crud.create_job(
                db,
                model_name=job_data.model_name,
                backend=model.backend,
                prompt=job_data.prompt,
                task_type=job_data.task_type,
                input_files=job_data.input_files,
                parameters=job_data.parameters,
            )

            # Enqueue the job
            from main import embedded_worker_manager

            if embedded_worker_manager:
                embedded_worker_manager.enqueue_job(job.id)

            created_jobs.append(job.id)
            logger.info(f"Batch {batch_id}: Created job {job.id} for model {job_data.model_name}")

        except Exception as e:
            error_msg = f"Job {i}: Failed to create - {str(e)}"
            failed_jobs.append(error_msg)
            logger.error(error_msg)

    # Prepare response message
    message = f"Batch created with {len(created_jobs)} jobs"
    if failed_jobs:
        message += f", {len(failed_jobs)} failed"

    if failed_jobs:
        logger.warning(f"Batch {batch_id} had failures: {failed_jobs}")

    return BatchJobResponse(
        batch_id=batch_id,
        job_ids=created_jobs,
        total_jobs=len(created_jobs),
        message=message,
    )


@router.get("/queue/status")
async def get_queue_status_endpoint() -> dict:
    """Get job queue status and statistics."""
    try:
        from main import embedded_worker_manager

        if embedded_worker_manager:
            return embedded_worker_manager.get_queue_status()
        else:
            return {
                "error": "No embedded workers available",
                "queued_jobs": 0,
                "failed_jobs": 0,
                "workers": 0,
            }
    except Exception as e:
        logger.error(f"Failed to get queue status: {e}")
        return {
            "error": f"Queue not available: {str(e)}",
            "queued_jobs": 0,
            "failed_jobs": 0,
            "workers": 0,
        }


@router.get("/system/stats")
async def get_system_stats() -> dict:
    """Get comprehensive system resource statistics."""
    return SystemMonitor.get_system_stats()


@router.get("/system/process")
async def get_process_info() -> dict:
    """Get information about the current backend process."""
    return SystemMonitor.get_process_info()


@router.get("/system/dependencies")
async def check_dependencies() -> dict:
    """Check availability of AI/ML dependencies and tools."""
    return SystemMonitor.check_dependencies()


@router.get("/workers/status")
async def get_workers_status_endpoint() -> dict:
    """Get status of embedded worker processes."""
    try:
        from main import embedded_worker_manager

        if embedded_worker_manager:
            return embedded_worker_manager.get_worker_status()
        else:
            return {
                "total_workers": 0,
                "active_workers": 0,
                "dead_workers": 0,
                "workers": [],
                "error": "No embedded workers available",
            }
    except Exception as e:
        return {
            "total_workers": 0,
            "active_workers": 0,
            "dead_workers": 0,
            "workers": [],
            "error": str(e),
        }


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
        elif job.backend == ModelBackend.pytorch:
            # For PyTorch, support custom model_path and device configuration
            model = ai_crud.get_model_by_name(db, name=job.model_name)
            if model and model.config:
                model_path = model.config.get("model_path")
                device = model.config.get("device")
                max_memory_gb = model.config.get("max_memory_gb", 3.0)

                runner = runner_class(
                    job.model_name,
                    model_path=model_path,
                    device=device,
                    max_memory_gb=max_memory_gb,
                )
            else:
                runner = runner_class(job.model_name)
        elif job.backend == ModelBackend.whisper:
            # For Whisper, use model name directly
            runner = runner_class(job.model_name)
        else:
            runner = runner_class(job.model_name)

        # Execute the job
        result = await runner.run(
            prompt=job.prompt,
            task_type=job.task_type,
            input_files=job.input_files,
            parameters=job.parameters,
        )

        # Update job with result
        if result.success:
            ai_crud.update_job_status(
                db,
                job_id=job_id,
                status=JobStatus.completed,
                result=result.to_dict(),
                output_files=result.output_files,
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

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .models import Job, JobStatus, Model, ModelBackend

# Models CRUD


def create_model(
    db: Session,
    *,
    name: str,
    backend: ModelBackend,
    config: dict[str, Any],
    description: str | None = None,
) -> Model:
    """Create a new model record."""
    model = Model(
        name=name,
        backend=backend,
        config=config,
        description=description,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def get_model(db: Session, *, model_id: uuid.UUID) -> Model | None:
    """Get a model by ID."""
    stmt = select(Model).where(Model.id == model_id)
    return db.execute(stmt).scalar_one_or_none()


def get_model_by_name(db: Session, *, name: str) -> Model | None:
    """Get a model by name."""
    stmt = select(Model).where(Model.name == name)
    return db.execute(stmt).scalar_one_or_none()


def get_models(
    db: Session, *, skip: int = 0, limit: int = 100, active_only: bool = True
) -> list[Model]:
    """Get all models with pagination."""
    stmt = select(Model)
    if active_only:
        stmt = stmt.where(Model.is_active)
    stmt = stmt.offset(skip).limit(limit).order_by(desc(Model.created_at))
    return list(db.execute(stmt).scalars().all())


def update_model(
    db: Session,
    *,
    model_id: uuid.UUID,
    name: str | None = None,
    config: dict[str, Any] | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> Model | None:
    """Update a model."""
    model = get_model(db, model_id=model_id)
    if not model:
        return None

    if name is not None:
        model.name = name
    if config is not None:
        model.config = config
    if description is not None:
        model.description = description
    if is_active is not None:
        model.is_active = is_active

    db.commit()
    db.refresh(model)
    return model


def delete_model(db: Session, *, model_id: uuid.UUID) -> bool:
    """Delete a model (soft delete by setting is_active=False)."""
    model = get_model(db, model_id=model_id)
    if not model:
        return False

    model.is_active = False
    db.commit()
    return True


# Jobs CRUD


def create_job(
    db: Session,
    *,
    model_name: str,
    backend: ModelBackend,
    prompt: str,
    parameters: dict[str, Any] | None = None,
) -> Job:
    """Create a new job record."""
    job = Job(
        model_name=model_name,
        backend=backend,
        prompt=prompt,
        parameters=parameters or {},
        status=JobStatus.queued,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, *, job_id: uuid.UUID) -> Job | None:
    """Get a job by ID."""
    stmt = select(Job).where(Job.id == job_id)
    return db.execute(stmt).scalar_one_or_none()


def get_jobs(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    model_name: str | None = None,
    status: JobStatus | None = None,
) -> list[Job]:
    """Get jobs with pagination and filtering."""
    stmt = select(Job)

    if model_name:
        stmt = stmt.where(Job.model_name == model_name)
    if status:
        stmt = stmt.where(Job.status == status)

    stmt = stmt.offset(skip).limit(limit).order_by(desc(Job.created_at))
    return list(db.execute(stmt).scalars().all())


def update_job_status(
    db: Session,
    *,
    job_id: uuid.UUID,
    status: JobStatus,
    result: dict[str, Any] | None = None,
    error_message: str | None = None,
    execution_time_ms: int | None = None,
    started_at: Any = None,
    completed_at: Any = None,
) -> Job | None:
    """Update a job's status and result."""
    job = get_job(db, job_id=job_id)
    if not job:
        return None

    job.status = status
    if result is not None:
        job.result = result
    if error_message is not None:
        job.error_message = error_message
    if execution_time_ms is not None:
        job.execution_time_ms = execution_time_ms
    if started_at is not None:
        job.started_at = started_at
    if completed_at is not None:
        job.completed_at = completed_at

    db.commit()
    db.refresh(job)
    return job

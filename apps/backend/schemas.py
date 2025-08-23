from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from db.models import JobStatus, ModelBackend


# Model schemas
class ModelBase(BaseModel):
    name: str = Field(..., description="Model name")
    backend: ModelBackend = Field(..., description="Backend type")
    config: dict[str, Any] = Field(default_factory=dict, description="Model configuration")
    description: str | None = Field(None, description="Optional description")


class ModelCreate(ModelBase):
    pass


class ModelUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None
    description: str | None = None
    is_active: bool | None = None


class ModelResponse(ModelBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Job schemas
class JobBase(BaseModel):
    prompt: str = Field(..., description="Input prompt for the model")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Model parameters")


class JobCreate(JobBase):
    model_name: str = Field(..., description="Name of the model to run")


class JobResponse(JobBase):
    id: uuid.UUID
    model_name: str
    backend: ModelBackend
    status: JobStatus
    result: dict[str, Any] | None = None
    error_message: str | None = None
    execution_time_ms: int | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


# API response schemas
class JobCreateResponse(BaseModel):
    job_id: uuid.UUID = Field(..., description="ID of the created job")
    message: str = Field(..., description="Status message")


class ModelsListResponse(BaseModel):
    models: list[ModelResponse]
    total: int
    skip: int
    limit: int


class JobsListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int
    skip: int
    limit: int


class HealthResponse(BaseModel):
    status: str
    version: str = "0.1.0"
    database: bool
    runners: dict[str, bool]

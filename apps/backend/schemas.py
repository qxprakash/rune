from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from db.models import JobStatus, JobType, ModelBackend


# Model schemas
class ModelBase(BaseModel):
    name: str = Field(..., description="Model name")
    backend: ModelBackend = Field(..., description="Backend type")
    supported_tasks: list[JobType] = Field(
        default=[JobType.text_generation], description="Supported task types"
    )
    config: dict[str, Any] = Field(default_factory=dict, description="Model configuration")
    description: str | None = Field(None, description="Optional description")


class ModelCreate(ModelBase):
    pass


class ModelUpdate(BaseModel):
    name: str | None = None
    supported_tasks: list[JobType] | None = None
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
    task_type: JobType = Field(default=JobType.text_generation, description="Type of AI task")
    prompt: str = Field(..., description="Input prompt/description for the model")
    input_files: list[str] = Field(
        default_factory=list, description="Input file paths for multi-modal tasks"
    )
    parameters: dict[str, Any] = Field(default_factory=dict, description="Model parameters")


class JobCreate(JobBase):
    model_name: str = Field(..., description="Name of the model to run")


class JobResponse(JobBase):
    id: uuid.UUID
    model_name: str
    backend: ModelBackend
    status: JobStatus
    output_files: list[str] = Field(default_factory=list, description="Generated output file paths")
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


# Batch job schemas
class BatchJobCreate(BaseModel):
    jobs: list[JobCreate] = Field(..., description="List of jobs to create")
    run_sequential: bool = Field(default=False, description="Whether to run jobs sequentially")


class BatchJobResponse(BaseModel):
    batch_id: str = Field(..., description="Batch identifier")
    job_ids: list[uuid.UUID] = Field(..., description="List of created job IDs")
    total_jobs: int = Field(..., description="Total number of jobs in batch")
    message: str = Field(..., description="Status message")


# Multi-modal specific schemas
class SpeechToTextRequest(BaseModel):
    """Request for speech-to-text conversion."""

    model_name: str = Field(..., description="Speech-to-text model name")
    input_files: list[str] = Field(..., description="Audio file paths to transcribe")
    language: str | None = Field(None, description="Expected language (optional)")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Transcription parameters")


class TextToSpeechRequest(BaseModel):
    """Request for text-to-speech conversion."""

    model_name: str = Field(..., description="Text-to-speech model name")
    text: str = Field(..., description="Text to convert to speech")
    voice: str | None = Field(None, description="Voice to use (optional)")
    parameters: dict[str, Any] = Field(default_factory=dict, description="TTS parameters")


class ImageGenerationRequest(BaseModel):
    """Request for image generation."""

    model_name: str = Field(..., description="Image generation model name")
    prompt: str = Field(..., description="Image description/prompt")
    width: int = Field(default=512, description="Image width")
    height: int = Field(default=512, description="Image height")
    num_images: int = Field(default=1, description="Number of images to generate")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Generation parameters")


class ImageToTextRequest(BaseModel):
    """Request for image analysis/captioning."""

    model_name: str = Field(..., description="Vision model name")
    input_files: list[str] = Field(..., description="Image file paths to analyze")
    prompt: str = Field(default="", description="Analysis prompt/question")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Analysis parameters")


class EmbeddingsRequest(BaseModel):
    """Request for text embeddings."""

    model_name: str = Field(..., description="Embedding model name")
    texts: list[str] = Field(..., description="Texts to embed")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Embedding parameters")


# File handling schemas
class FileUploadResponse(BaseModel):
    """Response for file upload."""

    filename: str = Field(..., description="Original filename")
    file_path: str = Field(..., description="Server file path")
    file_size: int = Field(..., description="File size in bytes")
    content_type: str = Field(..., description="MIME content type")
    upload_id: str = Field(..., description="Unique upload identifier")

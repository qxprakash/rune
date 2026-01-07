from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from db.models import JobType


class RunResult:
    def __init__(
        self,
        success: bool,
        output: Any = None,
        output_files: list[str] | None = None,
        error: str | None = None,
        execution_time_ms: int | None = None,
    ):
        self.success = success
        self.output = output
        self.output_files = output_files or []
        self.error = error
        self.execution_time_ms = execution_time_ms

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "output": self.output,
            "output_files": self.output_files,
            "error": self.error,
            "execution_time_ms": self.execution_time_ms,
        }


class ModelRunner(ABC):
    """Abstract base class for model runners."""

    @abstractmethod
    async def run(
        self,
        prompt: str,
        task_type: JobType = JobType.text_generation,
        input_files: list[str] | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> RunResult:
        pass

    @abstractmethod
    def is_available(self) -> bool:
        pass

    @classmethod
    @abstractmethod
    def list_available_models(cls) -> list[str]:
        pass

    @classmethod
    def get_supported_tasks(cls) -> list[JobType]:
        return [JobType.text_generation]

    async def run_text_generation(
        self, prompt: str, parameters: dict[str, Any] | None = None
    ) -> RunResult:
        return await self.run(prompt, JobType.text_generation, None, parameters)

    async def run_speech_to_text(
        self, input_files: list[str], prompt: str = "", parameters: dict[str, Any] | None = None
    ) -> RunResult:
        return await self.run(prompt, JobType.speech_to_text, input_files, parameters)

    async def run_text_to_speech(
        self, prompt: str, parameters: dict[str, Any] | None = None
    ) -> RunResult:
        return await self.run(prompt, JobType.text_to_speech, None, parameters)

    async def run_image_generation(
        self, prompt: str, parameters: dict[str, Any] | None = None
    ) -> RunResult:
        """Generate image from prompt."""
        return await self.run(prompt, JobType.image_generation, None, parameters)

    async def run_image_to_text(
        self, input_files: list[str], prompt: str = "", parameters: dict[str, Any] | None = None
    ) -> RunResult:
        """Analyze/describe images."""
        return await self.run(prompt, JobType.image_to_text, input_files, parameters)

    async def run_embeddings(
        self, prompt: str, parameters: dict[str, Any] | None = None
    ) -> RunResult:
        """Generate embeddings for text."""
        return await self.run(prompt, JobType.embeddings, None, parameters)

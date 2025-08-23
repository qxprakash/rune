from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class RunResult:
    """Result of a model run."""

    def __init__(
        self,
        success: bool,
        output: Any = None,
        error: str | None = None,
        execution_time_ms: int | None = None,
    ):
        self.success = success
        self.output = output
        self.error = error
        self.execution_time_ms = execution_time_ms

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "success": self.success,
            "output": self.output,
            "error": self.error,
            "execution_time_ms": self.execution_time_ms,
        }


class ModelRunner(ABC):
    """Abstract base class for model runners."""

    @abstractmethod
    async def run(self, prompt: str, parameters: dict[str, Any] | None = None) -> RunResult:
        """Run inference on a model.

        Args:
            prompt: Input prompt/text for the model
            parameters: Optional parameters for the model (temperature, max_tokens, etc.)

        Returns:
            RunResult with the model output
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this runner is available on the system."""
        pass

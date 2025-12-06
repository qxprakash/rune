from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
from loguru import logger

from db.models import JobType

from .base import ModelRunner, RunResult


class OllamaRunner(ModelRunner):
    def __init__(self, model_name: str, base_url: str = "http://localhost:11434"):
        self.model_name = model_name
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=120.0)

    async def run(
        self,
        prompt: str,
        task_type: JobType = JobType.text_generation,
        input_files: list[str] | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> RunResult:
        """Run inference using Ollama API."""
        start_time = time.time()

        if task_type != JobType.text_generation:
            return RunResult(
                success=False,
                error=f"Ollama runner does not support task type: {task_type}",
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

        try:
            # Default parameters for Ollama
            params = {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40,
                **(parameters or {}),
            }

            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": params,
            }

            logger.info(f"Running Ollama model {self.model_name} with prompt: {prompt[:100]}...")

            response = await self.client.post(
                f"{self.base_url}/api/generate",
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                error_msg = f"Ollama API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return RunResult(
                    success=False,
                    error=error_msg,
                    execution_time_ms=int((time.time() - start_time) * 1000),
                )

            result = response.json()
            output_text = result.get("response", "")

            execution_time = int((time.time() - start_time) * 1000)
            logger.info(f"Ollama inference completed in {execution_time}ms")

            return RunResult(
                success=True,
                output=output_text,
                execution_time_ms=execution_time,
            )

        except httpx.RequestError as e:
            error_msg = f"Connection error to Ollama: {str(e)}"
            logger.error(error_msg)
            return RunResult(
                success=False,
                error=error_msg,
                execution_time_ms=int((time.time() - start_time) * 1000),
            )
        except Exception as e:
            error_msg = f"Unexpected error running Ollama: {str(e)}"
            logger.error(error_msg)
            return RunResult(
                success=False,
                error=error_msg,
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

    def is_available(self) -> bool:
        """Check if Ollama is available."""
        try:
            # Try to reach Ollama API
            import httpx

            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception as e:
            logger.debug(f"Ollama not available: {e}")
            return False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    @classmethod
    def list_available_models(cls) -> list[str]:
        """List available Ollama models."""
        try:
            import httpx

            with httpx.Client(timeout=10.0) as client:
                response = client.get("http://localhost:11434/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    models = [model["name"] for model in data.get("models", [])]
                    return models
                return []
        except Exception as e:
            logger.debug(f"Failed to get Ollama models: {e}")
            return []

    def __del__(self):
        # Ensure the client is closed
        try:
            if hasattr(self, "client"):
                asyncio.create_task(self.client.aclose())
        except Exception:
            pass

from __future__ import annotations

import asyncio
import subprocess
import time
from typing import Any

from loguru import logger

from db.models import JobType

from .base import ModelRunner, RunResult


class MLXRunner(ModelRunner):
    """Runner for MLX models on Apple Silicon."""

    def __init__(self, model_name: str, model_path: str | None = None):
        self.model_name = model_name
        # Default to mlx-community format if no path specified
        self.model_path = model_path or f"mlx-community/{model_name}"

    async def run(
        self,
        prompt: str,
        task_type: JobType = JobType.text_generation,
        input_files: list[str] | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> RunResult:
        """Run inference using MLX."""
        start_time = time.time()

        # MLX currently only supports text generation
        if task_type != JobType.text_generation:
            return RunResult(
                success=False,
                error=f"MLX runner does not support task type: {task_type}",
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

        try:
            # Default parameters for MLX
            params = {
                "temp": parameters.get("temperature", 0.7) if parameters else 0.7,
                "max_tokens": parameters.get("max_tokens", 512) if parameters else 512,
                "top_p": parameters.get("top_p", 0.9) if parameters else 0.9,
                "seed": parameters.get("seed", 42) if parameters else 42,
            }

            # Build MLX command
            cmd = [
                "python",
                "-m",
                "mlx_lm.generate",
                "--model",
                self.model_path,
                "--prompt",
                prompt,
                "--temp",
                str(params["temp"]),
                "--max-tokens",
                str(params["max_tokens"]),
                "--top-p",
                str(params["top_p"]),
                "--seed",
                str(params["seed"]),
            ]

            logger.info(f"Running MLX model {self.model_name} with prompt: {prompt[:100]}...")

            # Run MLX in subprocess
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = f"MLX execution failed: {stderr.decode()}"
                logger.error(error_msg)
                return RunResult(
                    success=False,
                    error=error_msg,
                    execution_time_ms=int((time.time() - start_time) * 1000),
                )

            output_text = stdout.decode().strip()
            execution_time = int((time.time() - start_time) * 1000)

            logger.info(f"MLX inference completed in {execution_time}ms")

            return RunResult(
                success=True,
                output=output_text,
                execution_time_ms=execution_time,
            )

        except FileNotFoundError:
            error_msg = "MLX not found. Please install mlx-lm: pip install mlx-lm"
            logger.error(error_msg)
            return RunResult(
                success=False,
                error=error_msg,
                execution_time_ms=int((time.time() - start_time) * 1000),
            )
        except Exception as e:
            error_msg = f"MLX execution error: {str(e)}"
            logger.error(error_msg)
            return RunResult(
                success=False,
                error=error_msg,
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

    def is_available(self) -> bool:
        """Check if MLX is available."""
        try:
            # Check if mlx_lm is installed
            result = subprocess.run(
                ["python", "-c", "import mlx_lm; print('available')"],
                capture_output=True,
                timeout=5,
                text=True,
            )
            return result.returncode == 0 and "available" in result.stdout
        except Exception as e:
            logger.debug(f"MLX not available: {e}")
            return False

    @classmethod
    def list_available_models(cls) -> list[str]:
        """List available MLX models."""
        try:
            # Try to get available models from mlx_lm
            result = subprocess.run(
                ["python", "-c", "import mlx_lm.models; print('Check HuggingFace mlx-community')"],
                capture_output=True,
                timeout=10,
                text=True,
            )
            # For now, return some common MLX models
            # In the future, this could query HuggingFace API
            return [
                "Llama-3.2-3B-Instruct-4bit",
                "Llama-3.2-1B-Instruct-4bit",
                "Qwen2.5-7B-Instruct-4bit",
                "gemma-2-2b-it-4bit",
                "phi-3.5-mini-instruct-4bit",
            ]
        except Exception:
            return []

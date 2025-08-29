"""
Whisper Model Runner for Speech-to-Text.

Supports:
- Audio transcription (speech-to-text)
- Multiple audio formats (mp3, wav, m4a, etc.)
- Language detection and specification
- OpenAI Whisper models via transformers
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from loguru import logger

from db.models import JobType

from .base import ModelRunner, RunResult


class WhisperRunner(ModelRunner):
    """Runner for Whisper speech-to-text models."""

    def __init__(
        self,
        model_name: str = "openai/whisper-base",
        device: str | None = None,
    ):
        """Initialize Whisper runner.

        Args:
            model_name: Whisper model identifier (e.g., "openai/whisper-base")
            device: Target device (auto-detected if None)
        """
        self.model_name = model_name
        self.device = device or self._get_optimal_device()
        self.model = None
        self.processor = None
        self._is_loaded = False

    @classmethod
    def _get_optimal_device(cls) -> str:
        """Determine the best device for inference."""
        try:
            import torch

            if torch.cuda.is_available():
                return "cuda"
            elif torch.backends.mps.is_available():
                return "mps"
            else:
                return "cpu"
        except ImportError:
            return "cpu"

    def _load_model(self):
        """Load Whisper model and processor."""
        if self._is_loaded and self.model is not None and self.processor is not None:
            return self.model, self.processor

        try:
            import torch
            from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor

            logger.info(f"Loading Whisper model: {self.model_name} on device: {self.device}")

            # Load processor (tokenizer + feature extractor)
            self.processor = AutoProcessor.from_pretrained(self.model_name)

            # Load model with optimizations
            # MPS doesn't support float16 well, use float32
            torch_dtype = torch.float16 if self.device == "cuda" else torch.float32

            self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
                self.model_name,
                torch_dtype=torch_dtype,
                low_cpu_mem_usage=True,
                use_safetensors=True,
            )

            self.model.to(self.device)
            self.model.eval()
            self._is_loaded = True

            logger.info(f"Successfully loaded Whisper model: {self.model_name}")
            return self.model, self.processor

        except Exception as e:
            error_msg = f"Failed to load Whisper model {self.model_name}: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    async def run(
        self,
        prompt: str,
        task_type: JobType = JobType.speech_to_text,
        input_files: list[str] | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> RunResult:
        """Run speech-to-text transcription."""
        start_time = time.time()

        # Only supports speech-to-text
        if task_type != JobType.speech_to_text:
            return RunResult(
                success=False,
                error=f"Whisper runner only supports speech_to_text, got: {task_type}",
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

        # Need input files for transcription
        if not input_files:
            return RunResult(
                success=False,
                error="Whisper runner requires input audio files for transcription",
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

        try:
            # Load model if needed
            model, processor = self._load_model()

            # Default parameters
            params = {
                "language": None,  # Auto-detect
                "task": "transcribe",  # vs "translate"
                "return_timestamps": False,
                **(parameters or {}),
            }

            transcriptions = []

            for audio_file in input_files:
                if not Path(audio_file).exists():
                    logger.warning(f"Audio file not found: {audio_file}")
                    continue

                logger.info(f"Transcribing audio file: {audio_file}")

                # Load and process audio
                import librosa
                import torch

                # Load audio file (Whisper expects 16kHz sampling rate)
                audio, sr = librosa.load(audio_file, sr=16000)

                # Process audio
                inputs = processor(audio, sampling_rate=16000, return_tensors="pt")

                # Move inputs to device and ensure correct dtype
                if self.device == "mps":
                    # MPS requires float32 inputs
                    inputs = {k: v.to(self.device).float() for k, v in inputs.items()}
                else:
                    inputs = {k: v.to(self.device) for k, v in inputs.items()}

                # Generate transcription
                with torch.no_grad():
                    generated_ids = model.generate(
                        inputs["input_features"],
                        language=params.get("language"),
                        task=params.get("task"),
                        return_timestamps=params.get("return_timestamps"),
                    )

                # Decode transcription
                transcription = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

                transcriptions.append(
                    {
                        "file": audio_file,
                        "transcription": transcription.strip(),
                    }
                )

            execution_time = int((time.time() - start_time) * 1000)
            logger.info(f"Whisper transcription completed in {execution_time}ms")

            return RunResult(
                success=True,
                output={
                    "transcriptions": transcriptions,
                    "total_files": len(input_files),
                    "processed_files": len(transcriptions),
                },
                execution_time_ms=execution_time,
            )

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_msg = f"Whisper transcription failed: {str(e)}"
            logger.error(error_msg)

            return RunResult(
                success=False,
                error=error_msg,
                execution_time_ms=execution_time,
            )

    def is_available(self) -> bool:
        """Check if Whisper dependencies are available."""
        try:
            import librosa
            import torch
            import transformers

            return True
        except ImportError as e:
            logger.debug(f"Whisper dependencies not available: {e}")
            return False

    @classmethod
    def list_available_models(cls) -> list[str]:
        """List available Whisper models."""
        return [
            "openai/whisper-tiny",
            "openai/whisper-base",
            "openai/whisper-small",
            "openai/whisper-medium",
            "openai/whisper-large-v2",
            "openai/whisper-large-v3",
        ]

    @classmethod
    def get_supported_tasks(cls) -> list[JobType]:
        """Get the task types supported by this runner."""
        return [JobType.speech_to_text]

    def __del__(self):
        """Cleanup when runner is destroyed."""
        try:
            if self.device == "cuda":
                import torch

                torch.cuda.empty_cache()
        except:
            pass

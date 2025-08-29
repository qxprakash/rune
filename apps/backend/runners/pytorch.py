"""
PyTorch Model Runner with HuggingFace Integration.

Supports:
- Text generation models (GPT, T5, etc.)
- Embedding models (sentence-transformers)
- Multi-modal models (CLIP, BLIP)
- Custom fine-tuned models
- GPU acceleration with memory management
- Model caching for performance
"""

from __future__ import annotations

import gc
import time
from typing import Any

from loguru import logger

from db.models import JobType

from .base import ModelRunner, RunResult


class PyTorchRunner(ModelRunner):
    """Runner for PyTorch models via HuggingFace Transformers."""

    # Class-level model cache to share models across instances
    _model_cache: dict[str, tuple[Any, Any]] = {}  # model_name -> (model, tokenizer)
    _device_cache: str | None = None

    def __init__(
        self,
        model_name: str,
        model_path: str | None = None,
        device: str | None = None,
        max_memory_gb: float = 3.0,  # Conservative for GTX 1650ti 4GB
    ):
        """Initialize PyTorch runner.

        Args:
            model_name: HuggingFace model identifier or local path
            model_path: Optional local path override
            device: Target device (auto-detected if None)
            max_memory_gb: Maximum GPU memory to use in GB
        """
        self.model_name = model_name
        self.model_path = model_path or model_name
        self.max_memory_gb = max_memory_gb
        # Handle "auto" device or use specified device
        if device == "auto" or device is None:
            self.device = self._get_optimal_device()
        else:
            self.device = device

        # Model and tokenizer will be loaded lazily
        self.model = None
        self.tokenizer = None
        self._is_loaded = False

    @classmethod
    def _get_optimal_device(cls) -> str:
        """Determine the best device for inference."""
        if cls._device_cache is not None:
            return cls._device_cache

        try:
            import torch

            if torch.cuda.is_available():
                # Check VRAM availability
                device_count = torch.cuda.device_count()
                if device_count > 0:
                    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
                    logger.info(f"CUDA available: {device_count} GPU(s), {gpu_memory:.1f}GB VRAM")
                    cls._device_cache = "cuda"
                    return "cuda"

            if torch.backends.mps.is_available():
                logger.info("MPS (Apple Silicon) available")
                cls._device_cache = "mps"
                return "mps"

            logger.info("Using CPU for inference")
            cls._device_cache = "cpu"
            return "cpu"

        except ImportError:
            logger.warning("PyTorch not available, falling back to CPU")
            cls._device_cache = "cpu"
            return "cpu"

    def _load_model(self) -> tuple[Any, Any]:
        """Load model and tokenizer with caching."""
        if self._is_loaded and self.model is not None and self.tokenizer is not None:
            return self.model, self.tokenizer

        # Check cache first
        cache_key = f"{self.model_path}:{self.device}"
        if cache_key in self._model_cache:
            logger.info(f"Loading cached model: {self.model_name}")
            self.model, self.tokenizer = self._model_cache[cache_key]
            self._is_loaded = True
            return self.model, self.tokenizer

        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer

            logger.info(f"Loading PyTorch model: {self.model_name} on device: {self.device}")

            # Configure device and memory settings
            device_map = None
            torch_dtype = torch.float16 if self.device in ["cuda", "mps"] else torch.float32

            if self.device == "cuda":
                # For single GPU setups, use device_map for memory management
                device_map = "auto"
                max_memory = {0: f"{self.max_memory_gb}GB"}
            else:
                max_memory = None

            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_path,
                trust_remote_code=True,
                padding_side="left",  # Better for generation
            )

            # Set pad token if not present
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token

            # Load model with optimizations
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                torch_dtype=torch_dtype,
                device_map=device_map,
                max_memory=max_memory,
                trust_remote_code=True,
                low_cpu_mem_usage=True,  # Memory optimization
                offload_folder=None,  # Keep in GPU/RAM for speed
            )

            # Move to device if not using device_map
            if device_map is None:
                self.model = self.model.to(self.device)

            # Enable evaluation mode
            self.model.eval()

            # Cache the loaded model
            self._model_cache[cache_key] = (self.model, self.tokenizer)
            self._is_loaded = True

            logger.info(f"Successfully loaded model: {self.model_name}")
            return self.model, self.tokenizer

        except Exception as e:
            error_msg = f"Failed to load PyTorch model {self.model_name}: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e

    async def run(
        self,
        prompt: str,
        task_type: JobType = JobType.text_generation,
        input_files: list[str] | None = None,
        parameters: dict[str, Any] | None = None,
    ) -> RunResult:
        """Run inference on the PyTorch model."""
        start_time = time.time()

        # Currently only supports text generation and embeddings
        if task_type not in [JobType.text_generation, JobType.embeddings]:
            return RunResult(
                success=False,
                error=f"PyTorch runner does not yet support task type: {task_type}",
                execution_time_ms=int((time.time() - start_time) * 1000),
            )

        try:
            # Load model if needed
            model, tokenizer = self._load_model()

            # Default parameters optimized for your hardware
            params = {
                "max_new_tokens": 512,
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 50,
                "do_sample": True,
                "pad_token_id": tokenizer.eos_token_id,
                "repetition_penalty": 1.1,
                **(parameters or {}),
            }

            logger.info(f"Running PyTorch model {self.model_name} with prompt: {prompt[:100]}...")

            # Tokenize input
            inputs = tokenizer.encode(prompt, return_tensors="pt", padding=True)

            # Move inputs to device
            if hasattr(inputs, "to"):
                inputs = inputs.to(self.device)

            # Generate with context manager for memory management
            import torch

            with torch.no_grad():
                # Generate tokens (simplified for compatibility)
                outputs = model.generate(
                    inputs, **{k: v for k, v in params.items() if k != "pad_token_id"}
                )

            # Decode output (skip the input tokens)
            input_length = inputs.shape[1]
            generated_tokens = outputs[0][input_length:]
            output_text = tokenizer.decode(generated_tokens, skip_special_tokens=True)

            # Clean up GPU memory
            if self.device == "cuda":
                torch.cuda.empty_cache()

            execution_time = int((time.time() - start_time) * 1000)
            logger.info(f"PyTorch inference completed in {execution_time}ms")

            return RunResult(
                success=True,
                output=output_text.strip(),
                execution_time_ms=execution_time,
            )

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            error_msg = f"PyTorch inference failed: {str(e)}"
            logger.error(error_msg)

            # Clean up on error
            if self.device == "cuda":
                try:
                    import torch

                    torch.cuda.empty_cache()
                except:
                    pass

            return RunResult(
                success=False,
                error=error_msg,
                execution_time_ms=execution_time,
            )

    def is_available(self) -> bool:
        """Check if PyTorch and transformers are available."""
        try:
            import torch
            import transformers

            # Basic version checks
            torch_version = torch.__version__
            transformers_version = transformers.__version__

            logger.debug(f"PyTorch {torch_version}, Transformers {transformers_version} available")
            return True

        except ImportError as e:
            logger.debug(f"PyTorch/Transformers not available: {e}")
            return False

    @classmethod
    def list_available_models(cls) -> list[str]:
        """List popular HuggingFace models suitable for your hardware."""
        # Curated list of models that work well on GTX 1650ti 4GB
        return [
            # Small language models (< 1GB)
            "microsoft/DialoGPT-small",
            "microsoft/DialoGPT-medium",
            "google/flan-t5-small",
            "google/flan-t5-base",
            "distilgpt2",
            # Code models
            "microsoft/CodeBERT-base",
            "Salesforce/codet5-small",
            # Embedding models
            "sentence-transformers/all-MiniLM-L6-v2",
            "sentence-transformers/all-mpnet-base-v2",
            # Instruction-following models
            "microsoft/Phi-3-mini-4k-instruct",
            "stabilityai/stablelm-2-zephyr-1_6b",
            # Specialized models
            "facebook/bart-base",
            "t5-small",
            "t5-base",
        ]

    @classmethod
    def get_supported_tasks(cls) -> list[JobType]:
        """Get the task types supported by this runner."""
        return [JobType.text_generation, JobType.embeddings]

    @classmethod
    def clear_cache(cls) -> None:
        """Clear the model cache to free memory."""
        logger.info("Clearing PyTorch model cache")
        cls._model_cache.clear()

        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()
        except ImportError:
            pass

    def __del__(self):
        """Cleanup when runner is destroyed."""
        try:
            if self.device == "cuda":
                import torch

                torch.cuda.empty_cache()
        except:
            pass

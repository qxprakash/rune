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
        """

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
            # Validate model name before attempting to load
            if not self.validate_model_name(self.model_path):
                suggestion = self.suggest_model_name(self.model_path)
                error_msg = f"Model '{self.model_path}' is not a valid model identifier."
                if suggestion:
                    error_msg += f" Did you mean '{suggestion}'?"
                raise ValueError(error_msg)

            import torch
            from transformers import (
                AutoConfig,
                AutoModelForCausalLM,
                AutoModelForSeq2SeqLM,
                AutoTokenizer,
            )

            logger.info(f"Loading PyTorch model: {self.model_name} on device: {self.device}")

            # First, get the model config to determine the model architecture
            config = AutoConfig.from_pretrained(self.model_path, trust_remote_code=True)

            # Determine which AutoModel class to use based on the model architecture
            model_class = AutoModelForCausalLM  # Default

            # Check if it's a sequence-to-sequence model
            if hasattr(config, "is_encoder_decoder") and config.is_encoder_decoder:
                model_class = AutoModelForSeq2SeqLM
                logger.info("Detected encoder-decoder model, using AutoModelForSeq2SeqLM")
            elif config.model_type in ["t5", "bart", "pegasus", "mbart", "marian", "blenderbot"]:
                model_class = AutoModelForSeq2SeqLM
                logger.info(f"Detected {config.model_type} model, using AutoModelForSeq2SeqLM")
            else:
                logger.info(f"Using AutoModelForCausalLM for {config.model_type} model")

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

            # Load model with the appropriate class
            self.model = model_class.from_pretrained(
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

            # Check if it's a model not found error and suggest corrections
            if "is not a local folder and is not a valid model identifier" in str(e):
                suggested_name = self.suggest_model_name(self.model_name)
                if suggested_name:
                    error_msg += f"\nDid you mean '{suggested_name}'?"
                else:
                    available_models = ", ".join(self.list_available_models()[:5])
                    error_msg += f"\nAvailable models: {available_models}..."

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
            default_params = {
                "max_new_tokens": 512,
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 50,
                "do_sample": True,
                "repetition_penalty": 1.1,
            }

            # Add pad_token_id if available
            if tokenizer.eos_token_id is not None:
                default_params["pad_token_id"] = tokenizer.eos_token_id

            # Merge with user parameters
            params = {**default_params, **(parameters or {})}

            # Filter out invalid generation parameters
            valid_generate_params = {
                "max_length",
                "max_new_tokens",
                "min_length",
                "min_new_tokens",
                "do_sample",
                "early_stopping",
                "num_beams",
                "num_beam_groups",
                "diversity_penalty",
                "temperature",
                "top_k",
                "top_p",
                "typical_p",
                "epsilon_cutoff",
                "eta_cutoff",
                "repetition_penalty",
                "no_repeat_ngram_size",
                "encoder_no_repeat_ngram_size",
                "bad_words_ids",
                "force_words_ids",
                "renormalize_logits",
                "constraints",
                "forced_bos_token_id",
                "forced_eos_token_id",
                "remove_invalid_values",
                "exponential_decay_length_penalty",
                "suppress_tokens",
                "begin_suppress_tokens",
                "forced_decoder_ids",
                "sequence_bias",
                "guidance_scale",
                "low_memory",
                "num_return_sequences",
                "output_attentions",
                "output_hidden_states",
                "output_scores",
                "pad_token_id",
                "eos_token_id",
                "use_cache",
                "generation_config",
            }

            # Filter parameters to only include valid generation parameters
            filtered_params = {k: v for k, v in params.items() if k in valid_generate_params}

            # Log filtered out parameters for debugging
            filtered_out = {k: v for k, v in params.items() if k not in valid_generate_params}
            if filtered_out:
                logger.debug(
                    f"Filtered out invalid generation parameters: {list(filtered_out.keys())}"
                )

            logger.info(f"Running PyTorch model {self.model_name} with prompt: {prompt[:100]}...")

            # Check if this is a seq2seq model
            is_seq2seq = (
                hasattr(model.config, "is_encoder_decoder") and model.config.is_encoder_decoder
            )

            # Tokenize input
            if is_seq2seq:
                # For seq2seq models, use encoder inputs
                inputs = tokenizer.encode(prompt, return_tensors="pt", padding=True)
            else:
                # For causal LM models, use the standard approach
                inputs = tokenizer.encode(prompt, return_tensors="pt", padding=True)

            # Move inputs to device
            if hasattr(inputs, "to"):
                inputs = inputs.to(self.device)

            # Generate with context manager for memory management
            import torch

            with torch.no_grad():
                if is_seq2seq:
                    # For seq2seq models, generate from encoder outputs
                    outputs = model.generate(
                        input_ids=inputs,
                        **{k: v for k, v in filtered_params.items() if k != "pad_token_id"},
                    )
                else:
                    # For causal LM models, generate continuing from input
                    outputs = model.generate(
                        inputs, **{k: v for k, v in filtered_params.items() if k != "pad_token_id"}
                    )

            # Decode output
            if is_seq2seq:
                # For seq2seq models, decode the entire output (no input skipping needed)
                output_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
            else:
                # For causal LM models, skip the input tokens
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
                except Exception:
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
    def validate_model_name(cls, model_name: str) -> bool:
        """Validate if a model name exists on HuggingFace Hub."""
        try:
            from transformers import AutoConfig

            # Try to load the config to check if model exists
            AutoConfig.from_pretrained(model_name, _from_pipeline=True)
            return True
        except Exception as e:
            logger.warning(f"Model validation failed for '{model_name}': {str(e)}")
            return False

    @classmethod
    def suggest_model_name(cls, invalid_name: str) -> str | None:
        """Suggest a correct model name based on invalid input."""
        # Common corrections for misnamed models
        corrections = {
            "distilgpt2-fixed": "distilgpt2",
            "gpt2-small": "gpt2",
            "gpt2-medium": "gpt2-medium",
            "gpt2-large": "gpt2-large",
            "t5-tiny": "t5-small",
            "flan-t5-tiny": "google/flan-t5-small",
            "whisper-tiny": "openai/whisper-tiny",
            "whisper-base": "openai/whisper-base",
            "whisper-small": "openai/whisper-small",
        }

        # Direct correction if available
        if invalid_name in corrections:
            return corrections[invalid_name]

        # Try to find similar names in available models
        available_models = cls.list_available_models()
        for model in available_models:
            if invalid_name.lower() in model.lower() or model.lower() in invalid_name.lower():
                return model

        return None

    @classmethod
    def list_available_models(cls) -> list[str]:
        """List popular HuggingFace models suitable for your hardware."""
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
        try:
            if self.device == "cuda":
                import torch

                torch.cuda.empty_cache()
        except Exception:
            pass

from __future__ import annotations

import platform
import shutil
import subprocess
from typing import Any

import psutil
from loguru import logger


class SystemMonitor:
    """System resource monitoring utilities."""

    @staticmethod
    def get_system_stats() -> dict[str, Any]:
        """Get comprehensive system statistics."""
        try:
            # Basic system info
            system_info = {
                "platform": platform.system(),
                "architecture": platform.machine(),
                "python_version": platform.python_version(),
            }

            # CPU stats
            cpu_stats = {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "cpu_count": psutil.cpu_count(),
                "cpu_count_logical": psutil.cpu_count(logical=True),
                "cpu_freq": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None,
            }

            # Memory stats
            memory = psutil.virtual_memory()
            memory_stats = {
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2),
                "used_gb": round(memory.used / (1024**3), 2),
                "percent": memory.percent,
            }

            # Disk stats
            disk = psutil.disk_usage("/")
            disk_stats = {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
                "percent": round((disk.used / disk.total) * 100, 2),
            }

            # GPU stats (try multiple methods)
            gpu_stats = SystemMonitor._get_gpu_stats()

            # Process stats
            process_stats = {
                "total_processes": len(psutil.pids()),
                "python_processes": len(
                    [
                        p
                        for p in psutil.process_iter(["name"])
                        if p.info["name"] and "python" in p.info["name"].lower()
                    ]
                ),
            }

            return {
                "system": system_info,
                "cpu": cpu_stats,
                "memory": memory_stats,
                "disk": disk_stats,
                "gpu": gpu_stats,
                "processes": process_stats,
                "timestamp": psutil.boot_time(),
            }

        except Exception as e:
            logger.error(f"Error getting system stats: {e}")
            return {"error": str(e)}

    @staticmethod
    def _get_gpu_stats() -> dict[str, Any]:
        """Get GPU statistics using multiple detection methods."""
        gpu_stats = {
            "nvidia": SystemMonitor._get_nvidia_stats(),
            "amd": SystemMonitor._get_amd_stats(),
            "apple_silicon": SystemMonitor._get_apple_silicon_stats(),
            "available": False,
        }

        # Determine if any GPU is available
        gpu_stats["available"] = any(
            [
                gpu_stats["nvidia"]["available"],
                gpu_stats["amd"]["available"],
                gpu_stats["apple_silicon"]["available"],
            ]
        )

        return gpu_stats

    @staticmethod
    def _get_nvidia_stats() -> dict[str, Any]:
        """Get NVIDIA GPU stats using nvidia-smi."""
        try:
            if not shutil.which("nvidia-smi"):
                return {"available": False, "reason": "nvidia-smi not found"}

            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode != 0:
                return {"available": False, "reason": f"nvidia-smi error: {result.stderr}"}

            gpus = []
            for line in result.stdout.strip().split("\n"):
                if line.strip():
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) >= 6:
                        gpus.append(
                            {
                                "name": parts[0],
                                "memory_total_mb": int(parts[1]),
                                "memory_used_mb": int(parts[2]),
                                "memory_free_mb": int(parts[3]),
                                "temperature_c": int(parts[4])
                                if parts[4] != "[Not Supported]"
                                else None,
                                "utilization_percent": int(parts[5])
                                if parts[5] != "[Not Supported]"
                                else None,
                            }
                        )

            return {"available": True, "gpus": gpus, "count": len(gpus)}

        except Exception as e:
            return {"available": False, "reason": f"Error: {str(e)}"}

    @staticmethod
    def _get_amd_stats() -> dict[str, Any]:
        """Get AMD GPU stats using rocm-smi."""
        try:
            if not shutil.which("rocm-smi"):
                return {"available": False, "reason": "rocm-smi not found"}

            result = subprocess.run(
                ["rocm-smi", "--showmeminfo", "vram", "--csv"],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode != 0:
                return {"available": False, "reason": f"rocm-smi error: {result.stderr}"}

            # Basic parsing for AMD GPU info
            return {"available": True, "info": "AMD GPU detected (basic support)"}

        except Exception as e:
            return {"available": False, "reason": f"Error: {str(e)}"}

    @staticmethod
    def _get_apple_silicon_stats() -> dict[str, Any]:
        """Get Apple Silicon GPU stats."""
        try:
            # Check if we're on macOS with Apple Silicon
            if platform.system() != "Darwin":
                return {"available": False, "reason": "Not macOS"}

            # Try to get system info
            result = subprocess.run(
                ["system_profiler", "SPDisplaysDataType"],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode != 0:
                return {"available": False, "reason": "system_profiler error"}

            # Look for Apple GPU in output
            output = result.stdout
            if "Apple" in output and (
                "M1" in output or "M2" in output or "M3" in output or "M4" in output
            ):
                # Try to get memory info
                vm_stat_result = subprocess.run(
                    ["vm_stat"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )

                return {
                    "available": True,
                    "type": "Apple Silicon",
                    "unified_memory": True,
                    "info": "Apple Silicon GPU with unified memory",
                }

            return {"available": False, "reason": "No Apple Silicon GPU detected"}

        except Exception as e:
            return {"available": False, "reason": f"Error: {str(e)}"}

    @staticmethod
    def get_process_info() -> dict[str, Any]:
        """Get information about current process."""
        try:
            process = psutil.Process()
            return {
                "pid": process.pid,
                "memory_mb": round(process.memory_info().rss / (1024**2), 2),
                "cpu_percent": process.cpu_percent(),
                "num_threads": process.num_threads(),
                "create_time": process.create_time(),
            }
        except Exception as e:
            logger.error(f"Error getting process info: {e}")
            return {"error": str(e)}

    @staticmethod
    def check_dependencies() -> dict[str, bool]:
        """Check availability of various AI/ML dependencies."""
        dependencies = {}

        # Check Python packages
        packages_to_check = [
            "torch",
            "torchvision",
            "torchaudio",  # PyTorch
            "transformers",
            "accelerate",  # HuggingFace
            "mlx",
            "mlx_lm",  # MLX
            "whisper",
            "openai-whisper",  # Whisper
            "diffusers",
            "compel",  # Diffusion
            "opencv-python",
            "PIL",  # Image processing
        ]

        for package in packages_to_check:
            try:
                __import__(package.replace("-", "_"))
                dependencies[package] = True
            except ImportError:
                dependencies[package] = False

        # Check system tools
        tools_to_check = ["ollama", "ffmpeg", "git", "curl", "wget"]

        for tool in tools_to_check:
            dependencies[tool] = shutil.which(tool) is not None

        return dependencies

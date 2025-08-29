"""
File handling utilities for multi-modal AI tasks.

Handles:
- File uploads and storage
- File validation and type checking
- Temporary file cleanup
- File serving for downloads
"""

import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from loguru import logger


class FileHandler:
    """Handles file operations for multi-modal AI tasks."""

    def __init__(
        self, upload_dir: str = "uploads", max_file_size: int = 100 * 1024 * 1024
    ):  # 100MB
        """Initialize file handler.

        Args:
            upload_dir: Directory to store uploaded files
            max_file_size: Maximum file size in bytes
        """
        self.upload_dir = Path(upload_dir)
        self.max_file_size = max_file_size

        # Create upload directory if it doesn't exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)

        # Supported file types for different tasks
        self.audio_extensions = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}
        self.image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff"}
        self.video_extensions = {".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm"}

    def get_file_type(self, filename: str) -> str:
        """Determine the file type based on extension."""
        ext = Path(filename).suffix.lower()

        if ext in self.audio_extensions:
            return "audio"
        elif ext in self.image_extensions:
            return "image"
        elif ext in self.video_extensions:
            return "video"
        else:
            return "unknown"

    def validate_file(self, file: UploadFile, allowed_types: list[str] | None = None) -> None:
        """Validate uploaded file.

        Args:
            file: Uploaded file
            allowed_types: List of allowed file types (audio, image, video)

        Raises:
            HTTPException: If file is invalid
        """
        # Check file size
        if file.size and file.size > self.max_file_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {self.max_file_size // (1024 * 1024)}MB",
            )

        # Check file type if specified
        if allowed_types:
            file_type = self.get_file_type(file.filename or "")
            if file_type not in allowed_types:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}",
                )

    async def save_file(self, file: UploadFile, subdirectory: str = "") -> dict[str, Any]:
        """Save uploaded file to disk.

        Args:
            file: Uploaded file
            subdirectory: Optional subdirectory within upload_dir

        Returns:
            Dictionary with file information
        """
        # Generate unique filename
        file_id = str(uuid.uuid4())
        original_filename = file.filename or "unknown"
        file_extension = Path(original_filename).suffix
        new_filename = f"{file_id}{file_extension}"

        # Create full path
        if subdirectory:
            save_dir = self.upload_dir / subdirectory
            save_dir.mkdir(parents=True, exist_ok=True)
            file_path = save_dir / new_filename
        else:
            file_path = self.upload_dir / new_filename

        try:
            # Save file
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)

            logger.info(f"Saved file: {original_filename} -> {file_path}")

            return {
                "file_id": file_id,
                "original_filename": original_filename,
                "saved_filename": new_filename,
                "file_path": str(file_path),
                "file_size": len(content),
                "file_type": self.get_file_type(original_filename),
                "content_type": file.content_type or "application/octet-stream",
            }

        except Exception as e:
            logger.error(f"Failed to save file {original_filename}: {e}")
            # Clean up if file was partially created
            if file_path.exists():
                file_path.unlink()
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    def delete_file(self, file_path: str) -> bool:
        """Delete a file from disk.

        Args:
            file_path: Path to file to delete

        Returns:
            True if file was deleted, False otherwise
        """
        try:
            path = Path(file_path)
            if path.exists() and path.is_file():
                path.unlink()
                logger.info(f"Deleted file: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {e}")
            return False

    def cleanup_temp_files(self, max_age_hours: int = 24) -> int:
        """Clean up temporary files older than specified age.

        Args:
            max_age_hours: Maximum age of files to keep in hours

        Returns:
            Number of files deleted
        """
        import time

        deleted_count = 0
        max_age_seconds = max_age_hours * 3600
        current_time = time.time()

        try:
            for file_path in self.upload_dir.rglob("*"):
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > max_age_seconds:
                        try:
                            file_path.unlink()
                            deleted_count += 1
                            logger.debug(f"Cleaned up old file: {file_path}")
                        except Exception as e:
                            logger.warning(f"Failed to delete old file {file_path}: {e}")

            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} old files")

        except Exception as e:
            logger.error(f"Error during file cleanup: {e}")

        return deleted_count

    def get_file_info(self, file_path: str) -> dict[str, Any] | None:
        """Get information about a file.

        Args:
            file_path: Path to file

        Returns:
            File information dictionary or None if file doesn't exist
        """
        try:
            path = Path(file_path)
            if not path.exists():
                return None

            stat = path.stat()
            return {
                "file_path": str(path),
                "filename": path.name,
                "file_size": stat.st_size,
                "file_type": self.get_file_type(path.name),
                "created_at": stat.st_ctime,
                "modified_at": stat.st_mtime,
            }
        except Exception as e:
            logger.error(f"Failed to get file info for {file_path}: {e}")
            return None


# Global file handler instance
file_handler = FileHandler()

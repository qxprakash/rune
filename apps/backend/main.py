from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from api.routes import router
from db.session import engine

# Global worker manager
embedded_worker_manager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting AI Playground Backend")

    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")

    try:
        import os

        from workers.embedded_worker import EmbeddedWorkerManager

        global embedded_worker_manager

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        num_workers = int(os.getenv("NUM_WORKERS", "1"))

        embedded_worker_manager = EmbeddedWorkerManager(redis_url)
        success = await embedded_worker_manager.start(num_workers)

        if success:
            logger.info(f"Started {num_workers} embedded worker(s)")
        else:
            logger.warning("Redis workers not available, will use fallback processing")

    except Exception as e:
        logger.warning(f"Failed to start embedded workers: {e}")
        logger.info("Jobs will use fallback processing")

    yield

    try:
        if "embedded_worker_manager" in globals() and embedded_worker_manager:
            await embedded_worker_manager.stop()
            logger.info("Stopped embedded workers")
    except Exception as e:
        logger.error(f"Error stopping embedded workers: {e}")

    logger.info("Shutting down AI Playground Backend")


app = FastAPI(
    title="AI Playground Backend",
    description="Self-hosted AI inference platform with support for multiple model backends",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root() -> dict[str, Any]:
    return {"message": "AI Playground Backend", "version": "0.1.0"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

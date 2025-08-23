from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Read from env; default matches docker-compose service names
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://rune:rune@db:5432/rune")
ECHO = os.getenv("SQLALCHEMY_ECHO", "0").lower() in {"1", "true", "yes"}

engine = create_engine(DATABASE_URL, future=True, echo=ECHO)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

Base = declarative_base()


def get_session():
    """FastAPI-friendly dependency for DB sessions.

    Usage:
        from fastapi import Depends
        from .db.session import get_session
        def route(db: Session = Depends(get_session)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Conversation, Message, RoleEnum, User

# Users


def create_user(db: Session, *, email: str) -> User:
    user = User(email=email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_email(db: Session, *, email: str) -> User | None:
    stmt = select(User).where(User.email == email)
    return db.execute(stmt).scalar_one_or_none()


# Conversations


def create_conversation(
    db: Session, *, user_id: UUID | None = None, title: str | None = None
) -> Conversation:
    conv = Conversation(user_id=user_id, title=title)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(db: Session, *, conversation_id: UUID) -> Conversation | None:
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    return db.execute(stmt).scalar_one_or_none()


# Messages


def add_message(
    db: Session,
    *,
    conversation_id: UUID,
    role: RoleEnum,
    content: str,
) -> Message:
    msg = Message(conversation_id=conversation_id, role=role, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_conversation_history(
    db: Session, *, conversation_id: UUID, limit: int = 200
) -> Iterable[Message]:
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    return (row[0] for row in db.execute(stmt).all())

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from ..database import get_db
from ..models.message import Message
from ..schemas.message import MessageResponse, UnreadCountResponse
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/messages", tags=["Messages"])

@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    count = await db.scalar(
        select(func.count(Message.id)).where(
            Message.user_id == current_user.id,
            Message.is_read == False
        )
    )
    return UnreadCountResponse(count=count or 0)

@router.get("/", response_model=List[MessageResponse])
async def get_messages(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(Message)
        .where(Message.user_id == current_user.id)
        .order_by(Message.created_at.desc())
        .limit(50)
    )
    messages = result.scalars().all()
    return messages

@router.put("/{message_id}/read")
async def mark_as_read(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(Message).where(
            Message.id == message_id,
            Message.user_id == current_user.id
        )
    )
    message = result.scalar_one_or_none()
    if message:
        message.is_read = True
        await db.commit()
    return {"status": "ok"}

@router.put("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(Message).where(
            Message.user_id == current_user.id,
            Message.is_read == False
        )
    )
    messages = result.scalars().all()
    for message in messages:
        message.is_read = True
    await db.commit()
    return {"status": "ok", "updated": len(messages)}
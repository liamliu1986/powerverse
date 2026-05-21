from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..models.message import MessageType

class MessageBase(BaseModel):
    type: MessageType
    title: str
    content: Optional[str] = None

class MessageCreate(MessageBase):
    user_id: int

class MessageResponse(MessageBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UnreadCountResponse(BaseModel):
    count: int

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..models.reservation import ReservationStatus

class ReservationBase(BaseModel):
    gpu_id: int
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None

class ReservationCreate(ReservationBase):
    pass

class ReservationUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    purpose: Optional[str] = None

class ReservationResponse(ReservationBase):
    id: int
    user_id: int
    status: ReservationStatus
    approved_by: Optional[int] = None
    template_id: Optional[int] = None
    conflict_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ReservationWithUserResponse(ReservationResponse):
    user: "UserResponse"
    gpu: "GPUDetailResponse"

class ReservationApproval(BaseModel):
    approved: bool
    reason: Optional[str] = None

class ReservationCalendarResponse(BaseModel):
    id: int
    gpu_id: int
    gpu_name: str
    model_name: Optional[str]
    user_name: str
    start_time: datetime
    end_time: datetime
    purpose: Optional[str]
    status: str

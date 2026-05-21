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
    created_at: datetime

    class Config:
        from_attributes = True

class ReservationWithUserResponse(ReservationResponse):
    user: "UserResponse"
    gpu: "GPUDetailResponse"

class ReservationApproval(BaseModel):
    approved: bool
    reason: Optional[str] = None

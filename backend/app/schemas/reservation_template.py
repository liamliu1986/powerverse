from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from ..models.reservation_template import RecurrenceType
from ..models.reservation import ReservationStatus

class ReservationTemplateBase(BaseModel):
    gpu_id: int
    name: Optional[str] = None
    purpose: Optional[str] = None
    recurrence_type: RecurrenceType
    start_time: str  # "09:30" format
    end_time: str    # "18:45" or "24:00"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    specific_dates: Optional[List[str]] = None

class ReservationTemplateCreate(ReservationTemplateBase):
    pass

class ReservationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    purpose: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    specific_dates: Optional[List[str]] = None

class ReservationTemplateResponse(ReservationTemplateBase):
    id: int
    user_id: int
    status: ReservationStatus
    approved_by: Optional[int]
    is_active: bool
    created_at: datetime
    gpu_name: Optional[str] = None
    server_hostname: Optional[str] = None
    gpu_index: Optional[int] = None
    instance_count: Optional[int] = 0
    dates_summary: Optional[str] = None

    class Config:
        from_attributes = True

class ReservationTemplateApprove(BaseModel):
    approved: bool
    reason: Optional[str] = None

class ReservationInstancePreview(BaseModel):
    date: str
    start_time: str
    end_time: str

class ReservationTemplatePreviewResponse(BaseModel):
    template_id: int
    instances: List[ReservationInstancePreview]
    total_count: int
from sqlalchemy import Column, Integer, String, DateTime, Date, Text, ForeignKey, Enum as SQLEnum, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base
from .reservation import ReservationStatus

class RecurrenceType(str, enum.Enum):
    DAILY = "daily"
    SPECIFIC_DATES = "specific_dates"
    DATE_RANGE = "date_range"

class ReservationTemplate(Base):
    __tablename__ = "reservation_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    gpu_id = Column(Integer, ForeignKey("gpus.id"), nullable=False, index=True)
    name = Column(String(200), nullable=True)
    purpose = Column(Text, nullable=True)
    recurrence_type = Column(SQLEnum(RecurrenceType), nullable=False)
    start_time = Column(String(5), nullable=False)  # "09:30" format
    end_time = Column(String(5), nullable=False)  # "18:45" or "24:00"
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    specific_dates = Column(JSON, nullable=True)
    status = Column(SQLEnum(ReservationStatus), default=ReservationStatus.PENDING, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    gpu = relationship("GPU", foreign_keys=[gpu_id])
    approver = relationship("User", foreign_keys=[approved_by])
    instances = relationship("ReservationTemplateInstance", back_populates="template")

class ReservationTemplateInstance(Base):
    __tablename__ = "reservation_template_instances"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("reservation_templates.id", ondelete='SET NULL'), nullable=False, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id", ondelete='CASCADE'), nullable=False, index=True)
    instance_date = Column(Date, nullable=False)

    template = relationship("ReservationTemplate", back_populates="instances")
    reservation = relationship("Reservation")
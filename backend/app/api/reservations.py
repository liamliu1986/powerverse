from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from typing import List, Optional, Dict
from datetime import datetime, timezone as utc_timezone
from zoneinfo import ZoneInfo
from ..database import get_db
from ..models.reservation import Reservation, ReservationStatus
from ..models.gpu import GPU
from ..models.user import User, UserRole
from ..models.message import Message, MessageType
from ..models.audit_log import AuditLog
from ..schemas.reservation import (
    ReservationCreate, ReservationUpdate, ReservationResponse,
    ReservationWithUserResponse, ReservationApproval, ReservationCalendarResponse
)
from ..core.dependencies import get_current_user, get_current_operator

router = APIRouter(prefix="/api/v1/reservations", tags=["Reservations"])

@router.get("")
async def list_reservations(
    status: Optional[ReservationStatus] = Query(None),
    gpu_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Reservation).options(
        joinedload(Reservation.gpu).joinedload(GPU.server),
        joinedload(Reservation.user)
    )
    if current_user.role == UserRole.USER:
        query = query.where(Reservation.user_id == current_user.id)
    else:
        if user_id:
            query = query.where(Reservation.user_id == user_id)
    if status:
        query = query.where(Reservation.status == status)
    if gpu_id:
        query = query.where(Reservation.gpu_id == gpu_id)

    result = await db.execute(query.order_by(Reservation.created_at.desc()))
    reservations = result.scalars().all()

    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "gpu_id": r.gpu_id,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "purpose": r.purpose,
            "status": r.status.value if hasattr(r.status, 'value') else r.status,
            "approved_by": r.approved_by,
            "created_at": r.created_at,
            "gpu": {
                "id": r.gpu.id,
                "server_id": r.gpu.server_id,
                "gpu_index": r.gpu.gpu_index,
                "model_name": r.gpu.model_name,
                "memory_total_mb": r.gpu.memory_total_mb,
                "server": {
                    "hostname": r.gpu.server.hostname,
                    "ip_address": r.gpu.server.ip_address,
                } if r.gpu.server else None,
            } if r.gpu else None,
            "user": {
                "id": r.user.id,
                "username": r.user.username,
                "email": r.user.email,
            } if r.user else None,
        }
        for r in reservations
    ]

@router.get("/calendar", response_model=List[ReservationCalendarResponse])
async def get_reservations_calendar(
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get reservations for calendar view (admin only)"""
    start = datetime.strptime(start_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0)
    end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)

    query = select(Reservation).options(
        joinedload(Reservation.gpu).joinedload(GPU.server),
        joinedload(Reservation.user)
    ).where(
        Reservation.start_time <= end,
        Reservation.end_time >= start
    ).order_by(Reservation.start_time)

    result = await db.execute(query)
    reservations = result.scalars().all()

    return [
        {
            "id": r.id,
            "gpu_id": r.gpu_id,
            "gpu_name": f"{r.gpu.server.hostname}/GPU-{r.gpu.gpu_index}",
            "model_name": r.gpu.model_name,
            "user_name": r.user.username,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "purpose": r.purpose,
            "status": r.status.value if hasattr(r.status, 'value') else r.status
        }
        for r in reservations
    ]

def ensure_tz(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware (UTC), then strip tzinfo for DB storage/comparison"""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=utc_timezone.utc)
    return dt.replace(tzinfo=None)

@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation_data: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gpu_result = await db.execute(select(GPU).where(GPU.id == reservation_data.gpu_id))
    if not gpu_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="GPU not found")

    start_time = ensure_tz(reservation_data.start_time)
    end_time = ensure_tz(reservation_data.end_time)

    conflict = await db.execute(
        select(Reservation).where(
            and_(
                Reservation.gpu_id == reservation_data.gpu_id,
                Reservation.status == ReservationStatus.APPROVED,
                Reservation.start_time < end_time,
                Reservation.end_time > start_time
            )
        )
    )
    conflicting = conflict.scalar_one_or_none()
    if conflicting:
        local_start = conflicting.start_time.replace(tzinfo=utc_timezone.utc).astimezone(ZoneInfo(tz_name))
        local_end = conflicting.end_time.replace(tzinfo=utc_timezone.utc).astimezone(ZoneInfo(tz_name))
        raise HTTPException(
            status_code=409,
            detail=f"该GPU在 {local_start.strftime('%Y-%m-%d %H:%M')} - {local_end.strftime('%H:%M')} 时段已被预约，请选择其他时段"
        )

    reservation = Reservation(
        gpu_id=reservation_data.gpu_id,
        start_time=start_time,
        end_time=end_time,
        purpose=reservation_data.purpose,
        user_id=current_user.id,
        status=ReservationStatus.PENDING
    )
    db.add(reservation)
    await db.flush()
    await db.refresh(reservation)

    return {
        "id": reservation.id,
        "user_id": reservation.user_id,
        "gpu_id": reservation.gpu_id,
        "start_time": reservation.start_time,
        "end_time": reservation.end_time,
        "purpose": reservation.purpose,
        "status": reservation.status.value if hasattr(reservation.status, 'value') else reservation.status,
        "approved_by": reservation.approved_by,
        "created_at": reservation.created_at,
    }

@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if current_user.role == UserRole.USER and reservation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return reservation

@router.put("/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    reservation_id: int,
    reservation_data: ReservationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.user_id != current_user.id and current_user.role == UserRole.USER:
        raise HTTPException(status_code=403, detail="Access denied")
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only update pending reservations")

    for key, value in reservation_data.model_dump(exclude_unset=True).items():
        setattr(reservation, key, value)

    await db.flush()
    await db.refresh(reservation)
    return reservation

@router.post("/{reservation_id}/approve", response_model=ReservationResponse)
async def approve_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_operator)
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Reservation is not pending")

    reservation.status = ReservationStatus.APPROVED
    reservation.approved_by = current_user.id

    message = Message(
        user_id=reservation.user_id,
        type=MessageType.APPROVAL_PASSED,
        title="预约已通过",
        content=f"您的预约(ID: {reservation.id})已通过审批"
    )
    db.add(message)

    audit = AuditLog(
        entity_type="reservation",
        entity_id=reservation.id,
        action="approve",
        old_value=ReservationStatus.PENDING.value,
        new_value=ReservationStatus.APPROVED.value,
        operator_id=current_user.id
    )
    db.add(audit)

    await db.flush()
    await db.refresh(reservation)
    return reservation

@router.post("/{reservation_id}/reject", response_model=ReservationResponse)
async def reject_reservation(
    reservation_id: int,
    approval: ReservationApproval,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_operator)
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Reservation is not pending")

    reservation.status = ReservationStatus.REJECTED
    reservation.approved_by = current_user.id

    message = Message(
        user_id=reservation.user_id,
        type=MessageType.APPROVAL_REJECTED,
        title="预约被拒绝",
        content=f"您的预约(ID: {reservation.id})被拒绝。{approval.reason or ''}"
    )
    db.add(message)

    audit = AuditLog(
        entity_type="reservation",
        entity_id=reservation.id,
        action="reject",
        old_value=ReservationStatus.PENDING.value,
        new_value=ReservationStatus.REJECTED.value,
        operator_id=current_user.id
    )
    db.add(audit)

    await db.flush()
    await db.refresh(reservation)
    return reservation
@router.post("/{reservation_id}/cancel", response_model=ReservationResponse)
async def cancel_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a reservation (user can cancel their own, admin can cancel any)"""
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if reservation.user_id != current_user.id and current_user.role == UserRole.USER:
        raise HTTPException(status_code=403, detail="Access denied")

    if reservation.status == ReservationStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Reservation already cancelled")

    reservation.status = ReservationStatus.CANCELLED

    audit = AuditLog(
        entity_type="reservation",
        entity_id=reservation.id,
        action="cancel",
        old_value=reservation.status.value if hasattr(reservation.status, 'value') else reservation.status,
        new_value=ReservationStatus.CANCELLED.value,
        operator_id=current_user.id
    )
    db.add(audit)

    await db.flush()
    await db.refresh(reservation)

    return {
        "id": reservation.id,
        "user_id": reservation.user_id,
        "gpu_id": reservation.gpu_id,
        "start_time": reservation.start_time,
        "end_time": reservation.end_time,
        "purpose": reservation.purpose,
        "status": reservation.status.value if hasattr(reservation.status, 'value') else reservation.status,
        "approved_by": reservation.approved_by,
        "created_at": reservation.created_at,
    }

@router.delete("/{reservation_id}")
async def delete_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a cancelled reservation"""
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if reservation.user_id != current_user.id and current_user.role == UserRole.USER:
        raise HTTPException(status_code=403, detail="Access denied")

    if reservation.status != ReservationStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Can only delete cancelled reservations")

    audit_result = await db.execute(
        select(AuditLog).where(
            AuditLog.entity_type == "reservation",
            AuditLog.entity_id == reservation_id
        )
    )
    audit_logs = audit_result.scalars().all()
    for audit in audit_logs:
        await db.delete(audit)

    await db.delete(reservation)
    await db.commit()
    return {"status": "ok"}

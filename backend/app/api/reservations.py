from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from typing import List, Optional, Dict
from datetime import datetime
from ..database import get_db
from ..models.reservation import Reservation, ReservationStatus
from ..models.gpu import GPU
from ..models.user import User, UserRole
from ..models.message import Message, MessageType
from ..models.audit_log import AuditLog
from ..schemas.reservation import (
    ReservationCreate, ReservationUpdate, ReservationResponse,
    ReservationWithUserResponse, ReservationApproval
)
from ..core.dependencies import get_current_user, get_current_operator

router = APIRouter(prefix="/api/v1/reservations", tags=["Reservations"])

@router.get("", response_model=List[ReservationResponse])
async def list_reservations(
    status: Optional[ReservationStatus] = Query(None),
    gpu_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Reservation)
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
    return result.scalars().all()

@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation_data: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    gpu_result = await db.execute(select(GPU).where(GPU.id == reservation_data.gpu_id))
    if not gpu_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="GPU not found")

    conflict = await db.execute(
        select(Reservation).where(
            and_(
                Reservation.gpu_id == reservation_data.gpu_id,
                Reservation.status == ReservationStatus.APPROVED,
                Reservation.start_time < reservation_data.end_time,
                Reservation.end_time > reservation_data.start_time
            )
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Time slot already reserved")

    reservation = Reservation(
        **reservation_data.model_dump(),
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
        reservation_id=reservation.id,
        action="approve",
        old_status=ReservationStatus.PENDING.value,
        new_status=ReservationStatus.APPROVED.value,
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
        reservation_id=reservation.id,
        action="reject",
        old_status=ReservationStatus.PENDING.value,
        new_status=ReservationStatus.REJECTED.value,
        operator_id=current_user.id
    )
    db.add(audit)

    await db.flush()
    await db.refresh(reservation)
    return reservation
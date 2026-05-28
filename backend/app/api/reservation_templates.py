from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from typing import List
from datetime import datetime, date, timedelta
from dateutil import parser as date_parser
from ..database import get_db
from ..models.user import User, UserRole
from ..models.gpu import GPU
from ..models.reservation import Reservation, ReservationStatus
from ..models.reservation_template import ReservationTemplate, ReservationTemplateInstance, RecurrenceType
from ..schemas.reservation_template import (
    ReservationTemplateCreate, ReservationTemplateUpdate,
    ReservationTemplateResponse, ReservationTemplatePreviewResponse,
    ReservationInstancePreview
)
from ..core.dependencies import get_current_user, get_current_operator
from ..api.reservations import check_slot_metrics
from zoneinfo import ZoneInfo

router = APIRouter(prefix="/api/v1/reservation-templates", tags=["Reservation Templates"])

TZ_NAME = "Asia/Shanghai"

def parse_time_str(time_str: str, reference_date: date) -> datetime:
    """Parse time string like '09:30' or '24:00' to datetime on reference_date"""
    if time_str == "24:00":
        return datetime.combine(reference_date + timedelta(days=1), datetime.min.time().replace(hour=0))
    hour, minute = map(int, time_str.split(":"))
    return datetime.combine(reference_date, datetime.min.time().replace(hour=hour, minute=minute))

def validate_time_str(time_str: str, is_start: bool) -> bool:
    """Validate time string format and range"""
    try:
        parts = time_str.split(":")
        if len(parts) != 2:
            return False
        hour, minute = int(parts[0]), int(parts[1])
        if is_start:
            return 0 <= hour <= 23 and 0 <= minute <= 59
        else:
            # end time: 00:00 to 24:00 (24:00 means next day 00:00)
            if hour == 24 and minute == 0:
                return True
            return 1 <= hour <= 23 and 0 <= minute <= 59
    except (ValueError, AttributeError):
        return False

def time_str_to_local_datetime(time_str: str, ref_date: date) -> datetime:
    """Convert time string to local datetime (Asia/Shanghai)"""
    if time_str == "24:00":
        local_dt = datetime.combine(ref_date + timedelta(days=1), datetime.min.time().replace(hour=0))
    else:
        hour, minute = map(int, time_str.split(":"))
        local_dt = datetime.combine(ref_date, datetime.min.time().replace(hour=hour, minute=minute))
    return local_dt.replace(tzinfo=ZoneInfo(TZ_NAME))

def generate_instance_dates(template: ReservationTemplate) -> List[date]:
    """Generate list of dates based on recurrence type"""
    dates = []
    if template.recurrence_type == RecurrenceType.DAILY:
        current = template.start_date
        while current <= template.end_date:
            dates.append(current)
            current += timedelta(days=1)
    elif template.recurrence_type == RecurrenceType.DATE_RANGE:
        current = template.start_date
        while current <= template.end_date:
            dates.append(current)
            current += timedelta(days=1)
    elif template.recurrence_type == RecurrenceType.SPECIFIC_DATES:
        if template.specific_dates:
            for d in template.specific_dates:
                if isinstance(d, str):
                    dates.append(datetime.strptime(d, "%Y-%m-%d").date())
                else:
                    dates.append(d)
    return dates

@router.get("", response_model=List[ReservationTemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List reservation templates (user sees only their own)"""
    query = select(ReservationTemplate).options(
        joinedload(ReservationTemplate.gpu).joinedload(GPU.server)
    )
    if current_user.role == UserRole.USER:
        query = query.where(ReservationTemplate.user_id == current_user.id)
    query = query.where(ReservationTemplate.is_active == True)
    query = query.order_by(ReservationTemplate.created_at.desc())
    result = await db.execute(query)
    templates = result.scalars().all()

    response_list = []
    for t in templates:
        template_dict = {
            "id": t.id,
            "user_id": t.user_id,
            "gpu_id": t.gpu_id,
            "name": t.name,
            "purpose": t.purpose,
            "recurrence_type": t.recurrence_type,
            "start_time": t.start_time,
            "end_time": t.end_time,
            "start_date": t.start_date,
            "end_date": t.end_date,
            "specific_dates": t.specific_dates,
            "status": t.status,
            "approved_by": t.approved_by,
            "is_active": t.is_active,
            "created_at": t.created_at,
            "gpu_name": t.gpu.model_name if t.gpu else None,
            "server_hostname": t.gpu.server.hostname if t.gpu and t.gpu.server else None,
        }
        response_list.append(template_dict)
    return response_list

@router.get("/{template_id}", response_model=ReservationTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific template"""
    result = await db.execute(select(ReservationTemplate).where(ReservationTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if current_user.role == UserRole.USER and template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return template

@router.get("/{template_id}/preview", response_model=ReservationTemplatePreviewResponse)
async def preview_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Preview what reservations will be created from this template"""
    result = await db.execute(select(ReservationTemplate).where(ReservationTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    dates = generate_instance_dates(template)
    instances = []
    for d in dates:
        start_local = time_str_to_local_datetime(template.start_time, d)
        end_local = time_str_to_local_datetime(template.end_time, d)
        instances.append(ReservationInstancePreview(
            date=d.strftime("%Y-%m-%d"),
            start_time=start_local.strftime("%Y-%m-%d %H:%M"),
            end_time=end_local.strftime("%Y-%m-%d %H:%M")
        ))
    return ReservationTemplatePreviewResponse(
        template_id=template.id,
        instances=instances,
        total_count=len(instances)
    )

@router.post("", response_model=ReservationTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: ReservationTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new reservation template"""
    # Validate time format
    if not validate_time_str(template_data.start_time, is_start=True):
        raise HTTPException(status_code=400, detail="开始时间格式无效，请使用 HH:MM 格式 (00:00-23:59)")
    if not validate_time_str(template_data.end_time, is_start=False):
        raise HTTPException(status_code=400, detail="结束时间格式无效，请使用 HH:MM 格式 (01:00-24:00)")

    gpu_result = await db.execute(select(GPU).where(GPU.id == template_data.gpu_id))
    if not gpu_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="GPU not found")

    template = ReservationTemplate(
        user_id=current_user.id,
        gpu_id=template_data.gpu_id,
        name=template_data.name,
        purpose=template_data.purpose,
        recurrence_type=template_data.recurrence_type,
        start_time=template_data.start_time,
        end_time=template_data.end_time,
        start_date=template_data.start_date,
        end_date=template_data.end_date,
        specific_dates=template_data.specific_dates,
    )
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template

@router.put("/{template_id}", response_model=ReservationTemplateResponse)
async def update_template(
    template_id: int,
    template_data: ReservationTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a template (only PENDING status)"""
    result = await db.execute(select(ReservationTemplate).where(ReservationTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if current_user.role == UserRole.USER and template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if template.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only update PENDING templates")

    update_data = template_data.model_dump(exclude_unset=True)
    if 'start_time' in update_data and not validate_time_str(update_data['start_time'], is_start=True):
        raise HTTPException(status_code=400, detail="开始时间格式无效，请使用 HH:MM 格式 (00:00-23:59)")
    if 'end_time' in update_data and not validate_time_str(update_data['end_time'], is_start=False):
        raise HTTPException(status_code=400, detail="结束时间格式无效，请使用 HH:MM 格式 (01:00-24:00)")

    for key, value in update_data.items():
        setattr(template, key, value)
    await db.commit()
    await db.refresh(template)
    return template

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a template (only PENDING status)"""
    result = await db.execute(select(ReservationTemplate).where(ReservationTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if current_user.role == UserRole.USER and template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if template.status == ReservationStatus.REJECTED:
        raise HTTPException(status_code=400, detail="Cannot delete rejected templates")

    # Soft delete: set is_active to False, keep reservations intact
    template.is_active = False
    template.status = ReservationStatus.CANCELLED
    await db.commit()

@router.post("/{template_id}/approve", response_model=ReservationTemplateResponse)
async def approve_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_operator)
):
    """Approve a template and create reservation instances"""
    result = await db.execute(select(ReservationTemplate).where(ReservationTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Template is not PENDING")

    dates = generate_instance_dates(template)
    created_instances = []
    errors = []

    for d in dates:
        # Parse start time to UTC
        start_local = time_str_to_local_datetime(template.start_time, d)
        start_dt = start_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

        # Parse end time to UTC
        end_local = time_str_to_local_datetime(template.end_time, d)
        end_dt = end_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

        # Only check metrics (GPU load), not time overlap
        slot_results = await check_slot_metrics(db, template.gpu_id, start_dt, end_dt)
        blocked_slots = [r for r in slot_results if r['blocked']]
        if blocked_slots:
            errors.append(f"{d.strftime('%Y-%m-%d')} {template.start_time} 历史负载过高")
            continue

        # Create reservation
        reservation = Reservation(
            user_id=template.user_id,
            gpu_id=template.gpu_id,
            template_id=template.id,
            start_time=start_dt,
            end_time=end_dt,
            purpose=template.purpose,
            status=ReservationStatus.APPROVED,
            approved_by=current_user.id
        )
        db.add(reservation)
        await db.flush()
        await db.refresh(reservation)

        # Create instance link
        instance = ReservationTemplateInstance(
            template_id=template.id,
            reservation_id=reservation.id,
            instance_date=d
        )
        db.add(instance)
        created_instances.append(reservation.id)

    if errors and not created_instances:
        await db.rollback()
        raise HTTPException(status_code=409, detail="所有时段均冲突:\n" + "\n".join(errors))

    template.status = ReservationStatus.APPROVED
    template.approved_by = current_user.id
    await db.commit()
    await db.refresh(template)

    if errors:
        return template  # Partial success
    return template

@router.post("/{template_id}/reject")
async def reject_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_operator)
):
    """Reject a template"""
    result = await db.execute(select(ReservationTemplate).where(ReservationTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Template is not PENDING")

    template.status = ReservationStatus.REJECTED
    template.approved_by = current_user.id
    await db.commit()
    return {"status": "ok"}
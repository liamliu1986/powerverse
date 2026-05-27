from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from sqlalchemy.orm import joinedload
from ..database import get_db
from ..models.gpu import GPU
from ..models.gpu_metric import GPUMetric
from ..models.server import Server
from ..models.reservation import Reservation, ReservationStatus
from ..schemas.gpu import GPUResponse, GPUMetricResponse, GPUMetricsHistoryResponse, GPUCreate, GPUUpdate, AvailableSlotsResponse, AvailableSlot
from ..schemas.server import ServerResponse
from ..core.dependencies import get_current_user, get_current_operator

router = APIRouter(prefix="/api/v1/gpus", tags=["GPUs"])

@router.post("", response_model=GPUResponse, status_code=status.HTTP_201_CREATED)
async def create_gpu(
    gpu_data: GPUCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_operator)
):
    gpu = GPU(**gpu_data.model_dump())
    db.add(gpu)
    await db.flush()
    await db.refresh(gpu)
    return gpu

@router.get("", response_model=List[GPUResponse])
async def list_gpus(
    server_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(GPU).options(joinedload(GPU.server))
    if server_id:
        query = query.where(GPU.server_id == server_id)
    result = await db.execute(query)
    gpus = result.scalars().all()

    # Convert to response dict with server data
    response = []
    for gpu in gpus:
        gpu_dict = {
            "id": gpu.id,
            "server_id": gpu.server_id,
            "gpu_index": gpu.gpu_index,
            "model_name": gpu.model_name,
            "memory_total_mb": gpu.memory_total_mb,
            "created_at": gpu.created_at,
        }
        if gpu.server:
            gpu_dict["server"] = {
                "id": gpu.server.id,
                "hostname": gpu.server.hostname,
                "ip_address": gpu.server.ip_address,
                "subsidiary": gpu.server.subsidiary,
                "machine_room": gpu.server.machine_room,
                "rack_location": gpu.server.rack_location,
                "status": gpu.server.status.value if hasattr(gpu.server.status, 'value') else gpu.server.status,
                "created_at": gpu.server.created_at,
            }
        else:
            gpu_dict["server"] = None
        response.append(GPUResponse(**gpu_dict))
    return response

@router.get("/{gpu_id}", response_model=GPUResponse)
async def get_gpu(
    gpu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(GPU).where(GPU.id == gpu_id))
    gpu = result.scalar_one_or_none()
    if not gpu:
        raise HTTPException(status_code=404, detail="GPU not found")
    return gpu

@router.get("/{gpu_id}/metrics", response_model=GPUMetricResponse)
async def get_gpu_metrics(
    gpu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(GPUMetric)
        .where(GPUMetric.gpu_id == gpu_id)
        .order_by(GPUMetric.time.desc())
        .limit(1)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="No metrics found for GPU")
    return metric

@router.get("/{gpu_id}/metrics/history", response_model=GPUMetricsHistoryResponse)
async def get_gpu_metrics_history(
    gpu_id: int,
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    since = datetime.utcnow() - timedelta(hours=hours)
    result = await db.execute(
        select(GPUMetric)
        .where(GPUMetric.gpu_id == gpu_id, GPUMetric.time >= since)
        .order_by(GPUMetric.time.asc())
    )
    metrics = result.scalars().all()
    return GPUMetricsHistoryResponse(gpu_id=gpu_id, metrics=list(metrics))

@router.get("/metrics/batch", response_model=Dict[int, GPUMetricResponse])
async def get_batch_metrics(
    gpu_ids: str = Query(..., description="Comma-separated GPU IDs"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    ids = [int(x.strip()) for x in gpu_ids.split(',') if x.strip().isdigit()]
    if not ids:
        return {}

    result = await db.execute(
        select(GPUMetric)
        .where(GPUMetric.gpu_id.in_(ids))
        .order_by(GPUMetric.gpu_id, GPUMetric.time.desc())
    )
    all_metrics = result.scalars().all()

    latest_by_gpu: Dict[int, GPUMetricResponse] = {}
    for metric in all_metrics:
        if metric.gpu_id not in latest_by_gpu:
            latest_by_gpu[metric.gpu_id] = GPUMetricResponse(
                time=metric.time,
                gpu_id=metric.gpu_id,
                utilization_pct=metric.utilization_pct,
                memory_used_mb=metric.memory_used_mb,
                memory_free_mb=metric.memory_free_mb,
                temperature_c=metric.temperature_c,
                power_usage_w=metric.power_usage_w
            )
    return latest_by_gpu

@router.put("/{gpu_id}", response_model=GPUResponse)
async def update_gpu(
    gpu_id: int,
    gpu_data: GPUUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_operator)
):
    result = await db.execute(select(GPU).options(joinedload(GPU.server)).where(GPU.id == gpu_id))
    gpu = result.scalar_one_or_none()
    if not gpu:
        raise HTTPException(status_code=404, detail="GPU not found")

    update_data = gpu_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(gpu, key, value)

    await db.flush()
    await db.refresh(gpu)

    gpu_dict = {
        "id": gpu.id,
        "server_id": gpu.server_id,
        "gpu_index": gpu.gpu_index,
        "model_name": gpu.model_name,
        "memory_total_mb": gpu.memory_total_mb,
        "created_at": gpu.created_at,
    }
    if gpu.server:
        gpu_dict["server"] = {
            "id": gpu.server.id,
            "hostname": gpu.server.hostname,
            "ip_address": gpu.server.ip_address,
            "subsidiary": gpu.server.subsidiary,
            "machine_room": gpu.server.machine_room,
            "rack_location": gpu.server.rack_location,
            "status": gpu.server.status.value if hasattr(gpu.server.status, 'value') else gpu.server.status,
            "created_at": gpu.server.created_at,
        }
    else:
        gpu_dict["server"] = None
    return GPUResponse(**gpu_dict)

@router.get("/{gpu_id}/available-slots", response_model=AvailableSlotsResponse)
async def get_available_slots(
    gpu_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from datetime import time as dt_time

    date_obj = datetime.strptime(date, "%Y-%m-%d").date()
    start_of_day = datetime.combine(date_obj, dt_time.min)
    end_of_day = datetime.combine(date_obj, dt_time.max)

    gpu_result = await db.execute(select(GPU).where(GPU.id == gpu_id))
    if not gpu_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="GPU not found")

    reservations_result = await db.execute(
        select(Reservation).where(
            Reservation.gpu_id == gpu_id,
            Reservation.status == ReservationStatus.APPROVED,
            Reservation.start_time < end_of_day,
            Reservation.end_time > start_of_day
        )
    )
    reservations = reservations_result.scalars().all()

    metrics_result = await db.execute(
        select(GPUMetric).where(
            GPUMetric.gpu_id == gpu_id,
            GPUMetric.time >= start_of_day,
            GPUMetric.time <= end_of_day
        ).order_by(GPUMetric.time.asc())
    )
    metrics = list(metrics_result.scalars().all())

    slots = []
    current_time = start_of_day

    for reservation in sorted(reservations, key=lambda r: r.start_time):
        if current_time < reservation.start_time:
            gap_metrics = [m for m in metrics if current_time <= m.time < reservation.start_time]
            if gap_metrics:
                avg_util = sum(m.utilization_pct or 0 for m in gap_metrics) / len(gap_metrics)
                avg_mem = sum(m.memory_used_mb or 0 for m in gap_metrics) / len(gap_metrics)
                if avg_util < 50 and avg_mem < 50:
                    slots.append(AvailableSlot(
                        start_time=current_time,
                        end_time=reservation.start_time,
                        avg_utilization_pct=round(avg_util, 1),
                        avg_memory_used_mb=int(avg_mem)
                    ))
        current_time = max(current_time, reservation.end_time)

    if current_time < end_of_day:
        gap_metrics = [m for m in metrics if current_time <= m.time <= end_of_day]
        if gap_metrics:
            avg_util = sum(m.utilization_pct or 0 for m in gap_metrics) / len(gap_metrics)
            avg_mem = sum(m.memory_used_mb or 0 for m in gap_metrics) / len(gap_metrics)
            if avg_util < 50 and avg_mem < 50:
                slots.append(AvailableSlot(
                    start_time=current_time,
                    end_time=end_of_day,
                    avg_utilization_pct=round(avg_util, 1),
                    avg_memory_used_mb=int(avg_mem)
                ))

    return AvailableSlotsResponse(gpu_id=gpu_id, date=date, slots=slots)
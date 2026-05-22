from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text, literal_column
from typing import List
from datetime import datetime, timedelta
from ..database import get_db
from ..models.server import Server, ServerStatus
from ..models.gpu import GPU
from ..models.gpu_metric import GPUMetric
from ..models.reservation import Reservation, ReservationStatus
from ..models.user import User
from ..schemas.dashboard import (
    DashboardOverview, UtilizationStats, UtilizationByGPU,
    ScheduleItem, ScheduleResponse, UsageTrendItem, UsageTrendResponse
)
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

@router.get("/overview", response_model=DashboardOverview)
async def get_overview(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    total_servers = await db.scalar(select(func.count(Server.id)))
    online_servers = await db.scalar(
        select(func.count(Server.id)).where(Server.status == ServerStatus.ONLINE)
    )
    total_gpus = await db.scalar(select(func.count(GPU.id)))
    pending_reservations = await db.scalar(
        select(func.count(Reservation.id)).where(Reservation.status == ReservationStatus.PENDING)
    )
    total_users = await db.scalar(select(func.count(User.id)))

    latest_metrics = await db.execute(
        select(GPUMetric.gpu_id, GPUMetric.utilization_pct)
        .distinct(GPUMetric.gpu_id)
        .order_by(GPUMetric.gpu_id, GPUMetric.time.desc())
    )
    metrics = latest_metrics.scalars().all()
    busy_gpus = sum(1 for m in metrics if m and m > 10)
    idle_gpus = total_gpus - busy_gpus if total_gpus else 0

    return DashboardOverview(
        total_servers=total_servers or 0,
        online_servers=online_servers or 0,
        total_gpus=total_gpus or 0,
        busy_gpus=busy_gpus,
        idle_gpus=idle_gpus,
        total_users=total_users or 0,
        pending_reservations=pending_reservations or 0
    )

@router.get("/utilization", response_model=UtilizationStats)
async def get_utilization(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    latest_metrics = await db.execute(
        select(GPUMetric, GPU, Server)
        .join(GPU, GPUMetric.gpu_id == GPU.id)
        .join(Server, GPU.server_id == Server.id)
        .where(
            GPUMetric.time >= datetime.utcnow() - timedelta(minutes=5)
        )
    )

    gpu_utils = []
    total_mem_used = 0
    total_mem_total = 0

    for metric, gpu, server in latest_metrics.all():
        if metric:
            gpu_utils.append(UtilizationByGPU(
                gpu_id=gpu.id,
                gpu_name=f"{server.hostname}/GPU-{gpu.gpu_index}",
                server_hostname=server.hostname,
                utilization_pct=metric.utilization_pct or 0,
                memory_used_mb=metric.memory_used_mb or 0,
                memory_total_mb=gpu.memory_total_mb or 0
            ))
            total_mem_used += metric.memory_used_mb or 0
            total_mem_total += gpu.memory_total_mb or 0

    avg_util = sum(g.utilization_pct for g in gpu_utils) / len(gpu_utils) if gpu_utils else 0

    return UtilizationStats(
        timestamp=datetime.utcnow(),
        gpus=gpu_utils,
        average_utilization=round(avg_util, 2),
        total_memory_used_gb=round(total_mem_used / 1024, 2),
        total_memory_total_gb=round(total_mem_total / 1024, 2)
    )

@router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    target_date = datetime.strptime(date, "%Y-%m-%d")
    start_of_day = target_date.replace(hour=0, minute=0, second=0)
    end_of_day = target_date.replace(hour=23, minute=59, second=59)

    result = await db.execute(
        select(Reservation, GPU, Server, User)
        .join(GPU, Reservation.gpu_id == GPU.id)
        .join(Server, GPU.server_id == Server.id)
        .join(User, Reservation.user_id == User.id)
        .where(
            and_(
                Reservation.status == ReservationStatus.APPROVED,
                Reservation.start_time <= end_of_day,
                Reservation.end_time >= start_of_day
            )
        )
        .order_by(Reservation.start_time)
    )

    items = []
    for reservation, gpu, server, user in result.all():
        items.append(ScheduleItem(
            reservation_id=reservation.id,
            gpu_id=gpu.id,
            gpu_name=f"{server.hostname}/GPU-{gpu.gpu_index}",
            server_hostname=server.hostname,
            username=user.username,
            start_time=reservation.start_time,
            end_time=reservation.end_time,
            purpose=reservation.purpose
        ))

    return ScheduleResponse(items=items, date=date)

@router.get("/usage-trend", response_model=UsageTrendResponse)
async def get_usage_trend(
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            literal_column("date_trunc('hour', gpu_metrics.time)").label('hour'),
            func.avg(GPUMetric.utilization_pct).label('avg_util'),
            func.avg(GPUMetric.memory_used_mb).label('avg_mem')
        )
        .where(GPUMetric.time >= since)
        .group_by(literal_column('hour'))
        .order_by(literal_column('hour'))
    )

    items = [
        UsageTrendItem(
            timestamp=row.hour,
            avg_utilization=round(float(row.avg_util or 0), 2),
            total_memory_used_gb=round(float(row.avg_mem or 0) / 1024, 2)
        )
        for row in result.all()
    ]

    return UsageTrendResponse(items=items, period_days=days)
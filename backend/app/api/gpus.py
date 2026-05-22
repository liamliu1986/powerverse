from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timedelta
from ..database import get_db
from ..models.gpu import GPU
from ..models.gpu_metric import GPUMetric
from ..schemas.gpu import GPUResponse, GPUMetricResponse, GPUMetricsHistoryResponse, GPUCreate
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/gpus", tags=["GPUs"])

@router.post("", response_model=GPUResponse, status_code=status.HTTP_201_CREATED)
async def create_gpu(
    gpu_data: GPUCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
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
    query = select(GPU)
    if server_id:
        query = query.where(GPU.server_id == server_id)
    result = await db.execute(query)
    return result.scalars().all()

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
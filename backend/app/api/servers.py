from fastapi import APIRouter, Depends, HTTPException, status, Query
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
from ..database import get_db
from ..models.server import Server
from ..models.gpu import GPU
from ..models.gpu_metric import GPUMetric
from ..models.reservation import Reservation
from ..schemas.server import ServerCreate, ServerUpdate, ServerResponse
from ..schemas.gpu import GPUResponse
from ..core.dependencies import get_current_user, get_current_operator
from ..services import prometheus_config

router = APIRouter(prefix="/api/v1/servers", tags=["Servers"])

@router.get("", response_model=List[ServerResponse])
async def list_servers(
    subsidiary: Optional[str] = Query(None),
    machine_room: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(Server)
    if subsidiary:
        query = query.where(Server.subsidiary == subsidiary)
    if machine_room:
        query = query.where(Server.machine_room == machine_room)
    if status:
        query = query.where(Server.status == status)

    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    server_data: ServerCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_operator)
):
    server = Server(**server_data.model_dump())
    db.add(server)
    await db.flush()
    await db.refresh(server)

    # Add server IP to Prometheus targets
    asyncio.create_task(prometheus_config.add_target(server.ip_address))

    return server

@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server

@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: int,
    server_data: ServerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_operator)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    for key, value in server_data.model_dump(exclude_unset=True).items():
        setattr(server, key, value)

    await db.flush()
    await db.refresh(server)
    return server

@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_operator)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    # Get all GPUs belonging to this server
    gpu_result = await db.execute(select(GPU.id).where(GPU.server_id == server_id))
    gpu_ids = [row[0] for row in gpu_result.all()]

    if gpu_ids:
        # Delete related reservations first
        await db.execute(delete(Reservation).where(Reservation.gpu_id.in_(gpu_ids)))
        # Delete related metrics
        await db.execute(delete(GPUMetric).where(GPUMetric.gpu_id.in_(gpu_ids)))
        # Delete GPUs
        await db.execute(delete(GPU).where(GPU.server_id == server_id))

    # Remove server IP from Prometheus targets
    asyncio.create_task(prometheus_config.remove_target(server.ip_address))

    await db.delete(server)

@router.get("/{server_id}/gpus", response_model=List[GPUResponse])
async def get_server_gpus(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(GPU).where(GPU.server_id == server_id))
    return result.scalars().all()
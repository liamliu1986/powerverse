from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
import httpx
import logging

from ..database import get_db
from ..models.gpu import GPU
from ..models.server import Server
from ..core.dependencies import get_current_user

logger = logging.getLogger(__name__)

PROMETHEUS_URL = "http://172.18.68.183:9090"


class DiscoveredGPU(BaseModel):
    gpu_index: int
    model_name: Optional[str] = None
    memory_total_mb: Optional[int] = None


class DiscoverPreviewResponse(BaseModel):
    server_id: int
    server_hostname: str
    server_ip: str
    gpus: List[DiscoveredGPU]


class DiscoverResponse(BaseModel):
    discovered: int
    already_exists: int
    failed: int
    gpus: List[DiscoveredGPU]


router = APIRouter(prefix="/api/v1/gpus", tags=["GPU Discovery"])


async def fetch_from_prometheus(query: str) -> Optional[List[dict]]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": query})
            if resp.status_code == 200:
                result = resp.json().get("data", {}).get("result", [])
                return result
    except Exception as e:
        logger.warning(f"Prometheus query failed: {query}, error: {e}")
    return None


async def discover_gpus_on_server(server: Server) -> List[DiscoveredGPU]:
    instance = f"{server.ip_address}:9400"

    index_query = f'DCGM_FI_DEV_GPU_DEVICE_INDEX{{instance="{instance}"}}'
    index_result = await fetch_from_prometheus(index_query)

    if not index_result:
        logger.warning(f"No GPU devices found on {instance}")
        return []

    discovered_gpus = []
    for item in index_result:
        gpu_index = int(item["value"][1])

        model_name = None
        memory_total_mb = None

        model_query = f'DCGM_FI_DEV_MODEL_NAME{{instance="{instance}", gpu="{gpu_index}"}}'
        model_result = await fetch_from_prometheus(model_query)
        if model_result and len(model_result) > 0:
            model_name = model_result[0]["value"][1]

        mem_query = f'DCGM_FI_DEV_MEMORY_TOTAL{{instance="{instance}", gpu="{gpu_index}"}}'
        mem_result = await fetch_from_prometheus(mem_query)
        if mem_result and len(mem_result) > 0:
            memory_bytes = int(mem_result[0]["value"][1])
            memory_total_mb = memory_bytes // (1024 * 1024)

        discovered_gpus.append(DiscoveredGPU(
            gpu_index=gpu_index,
            model_name=model_name if model_name else None,
            memory_total_mb=memory_total_mb
        ))

    return discovered_gpus


@router.get("/discover/preview", response_model=DiscoverPreviewResponse)
async def preview_gpu_discovery(
    server_id: int = Query(..., description="Server ID to discover GPUs from"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    gpus = await discover_gpus_on_server(server)
    if not gpus:
        raise HTTPException(
            status_code=422,
            detail=f"No GPU devices found on {server.ip_address}. "
                   f"Please verify that DCGM Exporter is running and "
                   f"exposing DCGM_FI_DEV_GPU_DEVICE_INDEX metrics."
        )
    return DiscoverPreviewResponse(
        server_id=server.id,
        server_hostname=server.hostname,
        server_ip=server.ip_address,
        gpus=gpus
    )


@router.post("/discover", response_model=DiscoverResponse)
async def discover_and_create_gpus(
    server_id: int = Query(..., description="Server ID to discover GPUs from"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    discovered = await discover_gpus_on_server(server)

    discovered_count = 0
    already_exists_count = 0
    failed_count = 0
    created_gpus = []

    existing_result = await db.execute(select(GPU).where(GPU.server_id == server_id))
    existing_gpus = existing_result.scalars().all()
    existing_indices = {gpu.gpu_index for gpu in existing_gpus}

    for dgpu in discovered:
        if dgpu.gpu_index in existing_indices:
            already_exists_count += 1
            continue

        try:
            gpu = GPU(
                server_id=server_id,
                gpu_index=dgpu.gpu_index,
                model_name=dgpu.model_name,
                memory_total_mb=dgpu.memory_total_mb
            )
            db.add(gpu)
            await db.flush()
            created_gpus.append(dgpu)
            discovered_count += 1
        except Exception as e:
            logger.error(f"Failed to create GPU {dgpu.gpu_index}: {e}")
            failed_count += 1

    await db.commit()

    return DiscoverResponse(
        discovered=discovered_count,
        already_exists=already_exists_count,
        failed=failed_count,
        gpus=created_gpus
    )
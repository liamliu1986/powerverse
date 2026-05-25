import asyncio
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import async_session
from ..models.gpu import GPU
from ..models.gpu_metric import GPUMetric

logger = logging.getLogger(__name__)

PROMETHEUS_URL = "http://172.18.68.183:9090"


async def fetch_gpu_metrics_from_prometheus(gpu_index: int, server_ip: str) -> Optional[float]:
    import httpx
    query = f'DCGM_FI_DEV_MEM_COPY_UTIL{{instance="{server_ip}:9400", gpu="{gpu_index}"}}'
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": query})
            if resp.status_code == 200:
                result = resp.json().get("data", {}).get("result", [])
                if result:
                    value = result[0]["value"][1]
                    return float(value) if value != "" else None
    except Exception as e:
        logger.warning(f"Failed to fetch utilization for GPU {gpu_index}: {e}")
    return None


async def fetch_memory_metrics(gpu_index: int, server_ip: str):
    import httpx
    queries = {
        "memory_used": f'DCGM_FI_DEV_FB_USED{{instance="{server_ip}:9400", gpu="{gpu_index}"}}',
        "memory_free": f'DCGM_FI_DEV_FB_FREE{{instance="{server_ip}:9400", gpu="{gpu_index}"}}',
        "temperature": f'DCGM_FI_DEV_GPU_TEMP{{instance="{server_ip}:9400", gpu="{gpu_index}"}}',
        "power": f'DCGM_FI_DEV_POWER_USAGE{{instance="{server_ip}:9400", gpu="{gpu_index}"}}',
    }
    result = {}
    async with httpx.AsyncClient(timeout=10) as client:
        for key, query in queries.items():
            try:
                resp = await client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": query})
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get("result", [])
                    if data:
                        result[key] = float(data[0]["value"][1]) if data[0]["value"][1] != "" else 0
            except Exception as e:
                logger.warning(f"Failed to fetch {key} for GPU {gpu_index}: {e}")
                result[key] = 0
    return result


async def sync_all_gpu_metrics():
    from ..models.server import Server
    async with async_session() as db:
        result = await db.execute(
            select(GPU, Server)
            .join(Server, GPU.server_id == Server.id)
        )
        rows = result.all()
        for gpu, server in rows:
            server_ip = server.ip_address

            util = await fetch_gpu_metrics_from_prometheus(gpu.gpu_index, server_ip)
            if util is not None:
                mem = await fetch_memory_metrics(gpu.gpu_index, server_ip)
                metric = GPUMetric(
                    time=datetime.utcnow(),
                    gpu_id=gpu.id,
                    utilization_pct=int(util),
                    memory_used_mb=int(mem.get("memory_used", 0)),
                    memory_free_mb=int(mem.get("memory_free", 0)),
                    temperature_c=int(mem.get("temperature", 0)),
                    power_usage_w=int(mem.get("power", 0)),
                )
                db.add(metric)
        await db.commit()
    logger.info(f"Synced GPU metrics at {datetime.utcnow()}")


async def metrics_sync_loop(interval_seconds: int = 30):
    while True:
        try:
            await sync_all_gpu_metrics()
        except Exception as e:
            logger.error(f"Metrics sync error: {e}")
        await asyncio.sleep(interval_seconds)
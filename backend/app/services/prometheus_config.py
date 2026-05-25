import json
import logging
import httpx
import asyncio
import os
from pathlib import Path
from typing import List, Set

logger = logging.getLogger(__name__)

PROMETHEUS_URL = "http://172.18.68.183:9090"
# In Docker, targets file is mounted at /etc/prometheus/targets
# Locally, use project root targets directory
TARGETS_FILE = Path(os.environ.get(
    "PROMETHEUS_TARGETS_FILE",
    "/etc/prometheus/targets/dcgm-targets.json"
))


async def load_targets() -> Set[str]:
    """Load existing targets from JSON file."""
    if not TARGETS_FILE.exists():
        return set()
    try:
        with open(TARGETS_FILE, 'r') as f:
            data = json.load(f)
            targets = set()
            for item in data:
                targets.update(item.get('targets', []))
            return targets
    except Exception as e:
        logger.error(f"Failed to load targets file: {e}")
        return set()


async def save_targets(targets: Set[str]) -> None:
    """Save targets to JSON file."""
    TARGETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = [
        {
            "targets": list(targets),
            "labels": {}
        }
    ]
    with open(TARGETS_FILE, 'w') as f:
        json.dump(data, f, indent=2)


async def reload_prometheus() -> bool:
    """Call Prometheus reload API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{PROMETHEUS_URL}/-/reload")
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"Failed to reload Prometheus: {e}")
        return False


async def add_target(ip_address: str) -> bool:
    """Add a target to Prometheus configuration and reload."""
    target = f"{ip_address}:9400"
    targets = await load_targets()

    if target in targets:
        logger.info(f"Target {target} already exists")
        return True

    targets.add(target)
    await save_targets(targets)
    logger.info(f"Added target {target} to {TARGETS_FILE}")

    success = await reload_prometheus()
    if not success:
        logger.warning(f"Prometheus reload failed, but target file updated")
    return True


async def remove_target(ip_address: str) -> bool:
    """Remove a target from Prometheus configuration and reload."""
    target = f"{ip_address}:9400"
    targets = await load_targets()

    if target not in targets:
        logger.info(f"Target {target} does not exist")
        return True

    targets.discard(target)
    await save_targets(targets)
    logger.info(f"Removed target {target} from {TARGETS_FILE}")

    success = await reload_prometheus()
    if not success:
        logger.warning(f"Prometheus reload failed, but target file updated")
    return True


async def sync_targets_from_db() -> None:
    """Sync targets file with all servers in database."""
    from ..database import async_session
    from ..models.server import Server
    from sqlalchemy import select

    async with async_session() as db:
        result = await db.execute(select(Server.ip_address))
        ip_addresses = [row[0] for row in result.all()]
        targets = {f"{ip}:9400" for ip in ip_addresses}
        await save_targets(targets)
        logger.info(f"Synced {len(targets)} targets from database")
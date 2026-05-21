from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DashboardOverview(BaseModel):
    total_servers: int
    online_servers: int
    total_gpus: int
    busy_gpus: int
    idle_gpus: int
    total_users: int
    pending_reservations: int

class UtilizationByGPU(BaseModel):
    gpu_id: int
    gpu_name: str
    server_hostname: str
    utilization_pct: int
    memory_used_mb: int
    memory_total_mb: int

class UtilizationStats(BaseModel):
    timestamp: datetime
    gpus: List[UtilizationByGPU]
    average_utilization: float
    total_memory_used_gb: float
    total_memory_total_gb: float

class ScheduleItem(BaseModel):
    reservation_id: int
    gpu_id: int
    gpu_name: str
    server_hostname: str
    username: str
    start_time: datetime
    end_time: datetime
    purpose: Optional[str]

class ScheduleResponse(BaseModel):
    items: List[ScheduleItem]
    date: str

class UsageTrendItem(BaseModel):
    timestamp: datetime
    avg_utilization: float
    total_memory_used_gb: float

class UsageTrendResponse(BaseModel):
    items: List[UsageTrendItem]
    period_days: int

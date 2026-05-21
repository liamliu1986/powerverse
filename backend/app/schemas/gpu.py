from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class GPUBase(BaseModel):
    gpu_index: int
    model_name: Optional[str] = None
    memory_total_mb: Optional[int] = None

class GPUCreate(GPUBase):
    server_id: int

class GPUResponse(GPUBase):
    id: int
    server_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class GPUMetricResponse(BaseModel):
    time: datetime
    gpu_id: int
    utilization_pct: Optional[int] = None
    memory_used_mb: Optional[int] = None
    memory_free_mb: Optional[int] = None
    temperature_c: Optional[int] = None
    power_usage_w: Optional[int] = None

    class Config:
        from_attributes = True

class GPUDetailResponse(GPUResponse):
    server: "ServerResponse"
    current_metrics: Optional[GPUMetricResponse] = None

class GPUMetricsHistoryResponse(BaseModel):
    gpu_id: int
    metrics: List[GPUMetricResponse]

from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AuditLogResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int
    operator_id: Optional[int]
    old_value: Optional[str]
    new_value: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..models.server import ServerStatus

class ServerBase(BaseModel):
    hostname: str
    ip_address: str
    subsidiary: Optional[str] = None
    machine_room: Optional[str] = None
    rack_location: Optional[str] = None

class ServerCreate(ServerBase):
    pass

class ServerUpdate(BaseModel):
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    subsidiary: Optional[str] = None
    machine_room: Optional[str] = None
    rack_location: Optional[str] = None
    status: Optional[ServerStatus] = None

class ServerResponse(ServerBase):
    id: int
    status: ServerStatus
    created_at: datetime

    class Config:
        from_attributes = True

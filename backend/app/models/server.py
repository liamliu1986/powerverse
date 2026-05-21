from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base

class ServerStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"

class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(100), unique=True, nullable=False, index=True)
    ip_address = Column(String(45), nullable=False)
    subsidiary = Column(String(50), nullable=True, index=True)
    machine_room = Column(String(50), nullable=True, index=True)
    rack_location = Column(String(20), nullable=True)
    status = Column(SQLEnum(ServerStatus), default=ServerStatus.ONLINE, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    gpus = relationship("GPU", back_populates="server")
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class GPU(Base):
    __tablename__ = "gpus"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False, index=True)
    gpu_index = Column(Integer, nullable=False)
    model_name = Column(String(50), nullable=True)
    memory_total_mb = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    server = relationship("Server", back_populates="gpus")
    metrics = relationship("GPUMetric", back_populates="gpu")
    reservations = relationship("Reservation", back_populates="gpu")
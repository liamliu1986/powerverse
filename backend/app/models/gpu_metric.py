from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class GPUMetric(Base):
    __tablename__ = "gpu_metrics"

    time = Column(DateTime, primary_key=True, nullable=False)
    gpu_id = Column(Integer, ForeignKey("gpus.id"), primary_key=True, nullable=False, index=True)
    utilization_pct = Column(Integer, nullable=True)
    memory_used_mb = Column(Integer, nullable=True)
    memory_free_mb = Column(Integer, nullable=True)
    temperature_c = Column(Integer, nullable=True)
    power_usage_w = Column(Integer, nullable=True)

    gpu = relationship("GPU", back_populates="metrics")
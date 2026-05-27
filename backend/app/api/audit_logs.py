from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..models.user import User
from ..models.audit_log import AuditLog
from ..schemas.audit_log import AuditLogResponse
from ..core.dependencies import get_current_admin

router = APIRouter(prefix="/api/v1/audit-logs", tags=["Audit Logs"])

@router.get("", response_model=List[AuditLogResponse])
async def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    operator_id: Optional[int] = Query(None, description="Filter by operator ID"),
    start_time: Optional[datetime] = Query(None, description="Filter by start time"),
    end_time: Optional[datetime] = Query(None, description="Filter by end time"),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """List audit logs (admin only)"""
    query = select(AuditLog).order_by(AuditLog.created_at.desc())

    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if operator_id:
        query = query.where(AuditLog.operator_id == operator_id)
    if start_time:
        query = query.where(AuditLog.created_at >= start_time)
    if end_time:
        query = query.where(AuditLog.created_at <= end_time)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    return logs
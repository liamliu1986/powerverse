from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List
from ..database import get_db
from ..models.user import User, UserRole
from ..models.audit_log import AuditLog
from ..schemas.user import UserCreate, UserUpdate, UserResponse
from ..core.security import get_password_hash, verify_password
from ..core.dependencies import get_current_admin

router = APIRouter(prefix="/api/v1/users", tags=["Users"])

def create_audit_log(db: AsyncSession, action: str, entity_type: str, entity_id: int,
                     old_value: str = None, new_value: str = None, operator_id: int = None):
    audit = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        operator_id=operator_id
    )
    db.add(audit)
    return audit

@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """List all users (admin only)"""
    result = await db.execute(select(User).order_by(User.id))
    users = result.scalars().all()
    return users

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Get a specific user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Create a new user (admin only)"""
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        subsidiary=user_data.subsidiary
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    create_audit_log(
        db=db,
        action="create",
        entity_type="user",
        entity_id=user.id,
        new_value=f"username={user.username},role={user.role.value}",
        operator_id=current_user.id
    )
    await db.commit()

    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update a user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.username and user_data.username != user.username:
        result = await db.execute(select(User).where(User.username == user_data.username))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = user_data.username

    if user_data.email and user_data.email != user.email:
        result = await db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")
        user.email = user_data.email

    if user_data.subsidiary is not None:
        user.subsidiary = user_data.subsidiary

    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)

    create_audit_log(
        db=db,
        action="update",
        entity_type="user",
        entity_id=user.id,
        new_value=f"username={user.username}",
        operator_id=current_user.id
    )
    await db.commit()
    await db.refresh(user)
    return user

@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    role: UserRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Update a user's role (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role.value
    user.role = role

    create_audit_log(
        db=db,
        action="change_role",
        entity_type="user",
        entity_id=user.id,
        old_value=old_role,
        new_value=role.value,
        operator_id=current_user.id
    )
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Delete a user (admin only)"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    create_audit_log(
        db=db,
        action="delete",
        entity_type="user",
        entity_id=user.id,
        old_value=f"username={user.username}",
        operator_id=current_user.id
    )

    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    return None
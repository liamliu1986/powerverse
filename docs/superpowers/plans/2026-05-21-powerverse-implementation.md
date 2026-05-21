# PowerVerse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI computing resource monitoring and scheduling system with GPU monitoring, reservation management, and dashboard statistics.

**Architecture:** Monolithic full-stack application with FastAPI backend, React frontend, PostgreSQL + TimescaleDB for persistence, DCGM Exporter for GPU metrics. Deployed on Kubernetes.

**Tech Stack:** Python 3.11 + FastAPI, React 18 + Ant Design + TypeScript, PostgreSQL 15 + TimescaleDB, Celery + Redis, Prometheus + Grafana, DCGM Exporter

---

## Phase 1: Project Initialization

### File Structure

```
PowerVerse/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application entry
│   │   ├── config.py            # Configuration
│   │   ├── database.py          # Database connection
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── api/                 # API routes
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── servers.py
│   │   │   ├── gpus.py
│   │   │   ├── reservations.py
│   │   │   ├── dashboard.py
│   │   │   └── messages.py
│   │   ├── core/                # Core utilities
│   │   │   ├── security.py      # JWT, password hashing
│   │   │   └── dependencies.py  # FastAPI dependencies
│   │   └── services/            # Business logic
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── Dockerfile
│
├── k8s/
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── postgres-statefulset.yaml
│   └── ...
│
└── docs/
    ├── er_diagram.html
    └── specs/
```

---

## Phase 1: Project Setup

### Task 1: Initialize Backend Project

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`

- [ ] **Step 1: Create backend directory structure**

```bash
mkdir -p backend/app/{models,schemas,api,core,services}
mkdir -p backend/tests
touch backend/app/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/api/__init__.py
touch backend/app/core/__init__.py
touch backend/app/services/__init__.py
```

- [ ] **Step 2: Create requirements.txt**

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
asyncpg==0.29.0
psycopg2-binary==2.9.9
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
celery==5.3.6
redis==5.0.1
httpx==0.26.0
pytest==7.4.4
pytest-asyncio==0.23.3
alembic==1.13.1
```

- [ ] **Step 3: Create config.py**

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_name: str = "PowerVerse"
    debug: bool = False
    
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/powerverse"
    
    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
```

- [ ] **Step 4: Create database.py**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from .config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

- [ ] **Step 5: Create main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {"message": "PowerVerse API"}
```

- [ ] **Step 6: Test server starts**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`
Expected: Server starts on port 8000

- [ ] **Step 7: Commit**

```bash
git init
git add backend/
git commit -m "feat: initialize backend project with FastAPI structure"
```

---

### Task 2: Initialize Frontend Project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`
- Create: `frontend/index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "powerverse-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.3",
    "antd": "^5.13.0",
    "@ant-design/icons": "^5.2.6",
    "axios": "^1.6.5",
    "dayjs": "^1.11.10",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>PowerVerse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 6: Create App.tsx**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  )
}

export default App
```

- [ ] **Step 7: Create index.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
```

- [ ] **Step 8: Install dependencies and test**

Run: `cd frontend && npm install && npm run dev`
Expected: Vite dev server starts on port 3000

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend project with React + Vite + Ant Design"
```

---

## Phase 2: Database Models

### Task 3: Create SQLAlchemy Models

**Files:**
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/server.py`
- Create: `backend/app/models/gpu.py`
- Create: `backend/app/models/reservation.py`
- Create: `backend/app/models/message.py`
- Create: `backend/app/models/audit_log.py`
- Create: `backend/app/models/__init__.py` (exports)

- [ ] **Step 1: Create user model**

```python
from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    USER = "user"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)
    subsidiary = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    reservations = relationship("Reservation", back_populates="user")
    messages = relationship("Message", back_populates="user")
```

- [ ] **Step 2: Create server model**

```python
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
```

- [ ] **Step 3: Create GPU model**

```python
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
```

- [ ] **Step 4: Create GPU Metric model (TimescaleDB)**

```python
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
```

- [ ] **Step 5: Create Reservation model**

```python
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base

class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    gpu_id = Column(Integer, ForeignKey("gpus.id"), nullable=False, index=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    purpose = Column(Text, nullable=True)
    status = Column(SQLEnum(ReservationStatus), default=ReservationStatus.PENDING, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id], back_populates="reservations")
    gpu = relationship("GPU", back_populates="reservations")
    approver = relationship("User", foreign_keys=[approved_by])
    audit_logs = relationship("AuditLog", back_populates="reservation")
```

- [ ] **Step 6: Create Message model**

```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base

class MessageType(str, enum.Enum):
    APPROVAL_REJECTED = "approval_rejected"
    APPROVAL_PASSED = "approval_passed"
    SYSTEM = "system"

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(SQLEnum(MessageType), nullable=False)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="messages")
```

- [ ] **Step 7: Create AuditLog model**

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=False, index=True)
    action = Column(String(20), nullable=False)
    old_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    reservation = relationship("Reservation", back_populates="audit_logs")
```

- [ ] **Step 8: Create models __init__.py**

```python
from .user import User, UserRole
from .server import Server, ServerStatus
from .gpu import GPU
from .gpu_metric import GPUMetric
from .reservation import Reservation, ReservationStatus
from .message import Message, MessageType
from .audit_log import AuditLog

__all__ = [
    "User", "UserRole",
    "Server", "ServerStatus",
    "GPU",
    "GPUMetric",
    "Reservation", "ReservationStatus",
    "Message", "MessageType",
    "AuditLog",
]
```

- [ ] **Step 9: Create database init script for TimescaleDB**

Create: `backend/app/models/timescale_setup.sql`

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert gpu_metrics to hypertable (run after table creation)
SELECT create_hypertable('gpu_metrics', 'time', if_not_exists => TRUE);

-- Create continuous aggregate for hourly stats
CREATE MATERIALIZED VIEW IF NOT EXISTS gpu_hourly_stats
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS hour,
       gpu_id,
       AVG(utilization_pct) AS avg_utilization,
       AVG(memory_used_mb) AS avg_memory_used,
       AVG(memory_free_mb) AS avg_memory_free,
       AVG(temperature_c) AS avg_temperature,
       AVG(power_usage_w) AS avg_power
FROM gpu_metrics
GROUP BY hour, gpu_id;

-- Add retention policy (60 days)
SELECT add_retention_policy('gpu_metrics', INTERVAL '60 days');
```

- [ ] **Step 10: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add SQLAlchemy models for all entities"
```

---

## Phase 3: Pydantic Schemas

### Task 4: Create Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/user.py`
- Create: `backend/app/schemas/server.py`
- Create: `backend/app/schemas/gpu.py`
- Create: `backend/app/schemas/reservation.py`
- Create: `backend/app/schemas/message.py`
- Create: `backend/app/schemas/dashboard.py`

- [ ] **Step 1: Create user schemas**

```python
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from ..models.user import UserRole

class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: UserRole = UserRole.USER
    subsidiary: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    subsidiary: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[int] = None
```

- [ ] **Step 2: Create server schemas**

```python
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
```

- [ ] **Step 3: Create GPU schemas**

```python
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
```

- [ ] **Step 4: Create reservation schemas**

```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..models.reservation import ReservationStatus

class ReservationBase(BaseModel):
    gpu_id: int
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None

class ReservationCreate(ReservationBase):
    pass

class ReservationUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    purpose: Optional[str] = None

class ReservationResponse(ReservationBase):
    id: int
    user_id: int
    status: ReservationStatus
    approved_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ReservationWithUserResponse(ReservationResponse):
    user: "UserResponse"
    gpu: "GPUDetailResponse"

class ReservationApproval(BaseModel):
    approved: bool
    reason: Optional[str] = None
```

- [ ] **Step 5: Create message schemas**

```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..models.message import MessageType

class MessageBase(BaseModel):
    type: MessageType
    title: str
    content: Optional[str] = None

class MessageCreate(MessageBase):
    user_id: int

class MessageResponse(MessageBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UnreadCountResponse(BaseModel):
    count: int
```

- [ ] **Step 6: Create dashboard schemas**

```python
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
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas for all entities"
```

---

## Phase 4: Authentication & Security

### Task 5: Implement JWT Authentication

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/app/core/dependencies.py`
- Modify: `backend/app/api/auth.py`

- [ ] **Step 1: Create security.py**

```python
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from ..config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: int = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None
```

- [ ] **Step 2: Create dependencies.py**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..core.security import decode_access_token
from ..models.user import User, UserRole

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user

def require_roles(*roles: UserRole):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return role_checker

get_current_admin = require_roles(UserRole.ADMIN)
get_current_operator = require_roles(UserRole.ADMIN, UserRole.OPERATOR)
```

- [ ] **Step 3: Create auth.py**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.user import User
from ..schemas.user import UserLogin, Token, UserResponse
from ..core.security import verify_password, create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
async def login(
    login_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.username == login_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token)

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 4: Update main.py to include router**

```python
from .api import auth

app.include_router(auth.router)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/ backend/app/api/auth.py
git commit -m "feat: implement JWT authentication"
```

---

## Phase 5: API Routes

### Task 6: Server & GPU API Routes

**Files:**
- Create: `backend/app/api/servers.py`
- Create: `backend/app/api/gpus.py`

- [ ] **Step 1: Create servers.py**

```python
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from ..database import get_db
from ..models.server import Server
from ..models.gpu import GPU
from ..schemas.server import ServerCreate, ServerUpdate, ServerResponse
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/servers", tags=["Servers"])

@router.get("", response_model=List[ServerResponse])
async def list_servers(
    subsidiary: Optional[str] = Query(None),
    machine_room: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(Server)
    if subsidiary:
        query = query.where(Server.subsidiary == subsidiary)
    if machine_room:
        query = query.where(Server.machine_room == machine_room)
    if status:
        query = query.where(Server.status == status)

    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    server_data: ServerCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    server = Server(**server_data.model_dump())
    db.add(server)
    await db.flush()
    await db.refresh(server)
    return server

@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server

@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: int,
    server_data: ServerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    for key, value in server_data.model_dump(exclude_unset=True).items():
        setattr(server, key, value)

    await db.flush()
    await db.refresh(server)
    return server

@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    await db.delete(server)

@router.get("/{server_id}/gpus", response_model=List[GPU])
async def get_server_gpus(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(GPU).where(GPU.server_id == server_id))
    return result.scalars().all()
```

- [ ] **Step 2: Create gpus.py**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime, timedelta
from ..database import get_db
from ..models.gpu import GPU
from ..models.gpu_metric import GPUMetric
from ..schemas.gpu import GPUResponse, GPUMetricResponse, GPUMetricsHistoryResponse
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/gpus", tags=["GPUs"])

@router.get("", response_model=List[GPUResponse])
async def list_gpus(
    server_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(GPU)
    if server_id:
        query = query.where(GPU.server_id == server_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{gpu_id}", response_model=GPUResponse)
async def get_gpu(
    gpu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(GPU).where(GPU.id == gpu_id))
    gpu = result.scalar_one_or_none()
    if not gpu:
        raise HTTPException(status_code=404, detail="GPU not found")
    return gpu

@router.get("/{gpu_id}/metrics", response_model=GPUMetricResponse)
async def get_gpu_metrics(
    gpu_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(GPUMetric)
        .where(GPUMetric.gpu_id == gpu_id)
        .order_by(GPUMetric.time.desc())
        .limit(1)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="No metrics found for GPU")
    return metric

@router.get("/{gpu_id}/metrics/history", response_model=GPUMetricsHistoryResponse)
async def get_gpu_metrics_history(
    gpu_id: int,
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    since = datetime.utcnow() - timedelta(hours=hours)
    result = await db.execute(
        select(GPUMetric)
        .where(GPUMetric.gpu_id == gpu_id, GPUMetric.time >= since)
        .order_by(GPUMetric.time.asc())
    )
    metrics = result.scalars().all()
    return GPUMetricsHistoryResponse(gpu_id=gpu_id, metrics=list(metrics))
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/servers.py backend/app/api/gpus.py
git commit -m "feat: add server and GPU API routes"
```

---

### Task 7: Reservation API Routes

**Files:**
- Create: `backend/app/api/reservations.py`

- [ ] **Step 1: Create reservations.py**

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, date
from ..database import get_db
from ..models.reservation import Reservation, ReservationStatus
from ..models.gpu import GPU
from ..models.user import User, UserRole
from ..models.message import Message, MessageType
from ..models.audit_log import AuditLog
from ..schemas.reservation import (
    ReservationCreate, ReservationUpdate, ReservationResponse,
    ReservationWithUserResponse, ReservationApproval
)
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/reservations", tags=["Reservations"])

@router.get("", response_model=List[ReservationResponse])
async def list_reservations(
    status: Optional[ReservationStatus] = Query(None),
    gpu_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Reservation)
    if current_user.role == UserRole.USER:
        query = query.where(Reservation.user_id == current_user.id)
    else:
        if user_id:
            query = query.where(Reservation.user_id == user_id)
    if status:
        query = query.where(Reservation.status == status)
    if gpu_id:
        query = query.where(Reservation.gpu_id == gpu_id)

    result = await db.execute(query.order_by(Reservation.created_at.desc()))
    return result.scalars().all()

@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation_data: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conflict = await db.execute(
        select(Reservation).where(
            and_(
                Reservation.gpu_id == reservation_data.gpu_id,
                Reservation.status == ReservationStatus.APPROVED,
                Reservation.start_time < reservation_data.end_time,
                Reservation.end_time > reservation_data.start_time
            )
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Time slot already reserved")

    reservation = Reservation(
        **reservation_data.model_dump(),
        user_id=current_user.id,
        status=ReservationStatus.PENDING
    )
    db.add(reservation)
    await db.flush()
    await db.refresh(reservation)
    return reservation

@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if current_user.role == UserRole.USER and reservation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return reservation

@router.put("/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    reservation_id: int,
    reservation_data: ReservationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.user_id != current_user.id and current_user.role == UserRole.USER:
        raise HTTPException(status_code=403, detail="Access denied")
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only update pending reservations")

    for key, value in reservation_data.model_dump(exclude_unset=True).items():
        setattr(reservation, key, value)

    await db.flush()
    await db.refresh(reservation)
    return reservation

@router.post("/{reservation_id}/approve", response_model=ReservationResponse)
async def approve_reservation(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_operator)
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Reservation is not pending")

    reservation.status = ReservationStatus.APPROVED
    reservation.approved_by = current_user.id

    message = Message(
        user_id=reservation.user_id,
        type=MessageType.APPROVAL_PASSED,
        title="预约已通过",
        content=f"您的预约(ID: {reservation.id})已通过审批"
    )
    db.add(message)

    audit = AuditLog(
        reservation_id=reservation.id,
        action="approve",
        old_status=ReservationStatus.PENDING.value,
        new_status=ReservationStatus.APPROVED.value,
        operator_id=current_user.id
    )
    db.add(audit)

    await db.flush()
    await db.refresh(reservation)
    return reservation

@router.post("/{reservation_id}/reject", response_model=ReservationResponse)
async def reject_reservation(
    reservation_id: int,
    approval: ReservationApproval,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_operator)
):
    result = await db.execute(select(Reservation).where(Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.status != ReservationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Reservation is not pending")

    reservation.status = ReservationStatus.REJECTED
    reservation.approved_by = current_user.id

    message = Message(
        user_id=reservation.user_id,
        type=MessageType.APPROVAL_REJECTED,
        title="预约被拒绝",
        content=f"您的预约(ID: {reservation.id})被拒绝。{approval.reason or ''}"
    )
    db.add(message)

    audit = AuditLog(
        reservation_id=reservation.id,
        action="reject",
        old_status=ReservationStatus.PENDING.value,
        new_status=ReservationStatus.REJECTED.value,
        operator_id=current_user.id
    )
    db.add(audit)

    await db.flush()
    await db.refresh(reservation)
    return reservation
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/reservations.py
git commit -m "feat: add reservation API with approval workflow"
```

---

### Task 8: Dashboard API Routes

**Files:**
- Create: `backend/app/api/dashboard.py`

- [ ] **Step 1: Create dashboard.py**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List
from datetime import datetime, timedelta
from ..database import get_db
from ..models.server import Server, ServerStatus
from ..models.gpu import GPU
from ..models.gpu_metric import GPUMetric
from ..models.reservation import Reservation, ReservationStatus
from ..models.user import User
from ..schemas.dashboard import (
    DashboardOverview, UtilizationStats, UtilizationByGPU,
    ScheduleItem, ScheduleResponse, UsageTrendItem, UsageTrendResponse
)
from ..core.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

@router.get("/overview", response_model=DashboardOverview)
async def get_overview(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    total_servers = await db.scalar(select(func.count(Server.id)))
    online_servers = await db.scalar(
        select(func.count(Server.id)).where(Server.status == ServerStatus.ONLINE)
    )
    total_gpus = await db.scalar(select(func.count(GPU.id)))
    pending_reservations = await db.scalar(
        select(func.count(Reservation.id)).where(Reservation.status == ReservationStatus.PENDING)
    )
    total_users = await db.scalar(select(func.count(User.id)))

    latest_metrics = await db.execute(
        select(GPUMetric.gpu_id, GPUMetric.utilization_pct)
        .distinct(GPUMetric.gpu_id)
        .order_by(GPUMetric.gpu_id, GPUMetric.time.desc())
    )
    metrics = latest_metrics.scalars().all()
    busy_gpus = sum(1 for m in metrics if m and m > 10)
    idle_gpus = total_gpus - busy_gpus if total_gpus else 0

    return DashboardOverview(
        total_servers=total_servers or 0,
        online_servers=online_servers or 0,
        total_gpus=total_gpus or 0,
        busy_gpus=busy_gpus,
        idle_gpus=idle_gpus,
        total_users=total_users or 0,
        pending_reservations=pending_reservations or 0
    )

@router.get("/utilization", response_model=UtilizationStats)
async def get_utilization(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    latest_metrics = await db.execute(
        select(GPUMetric, GPU, Server)
        .join(GPU, GPUMetric.gpu_id == GPU.id)
        .join(Server, GPU.server_id == Server.id)
        .where(
            GPUMetric.time >= datetime.utcnow() - timedelta(minutes=5)
        )
    )

    gpu_utils = []
    total_mem_used = 0
    total_mem_total = 0

    for metric, gpu, server in latest_metrics.all():
        if metric:
            gpu_utils.append(UtilizationByGPU(
                gpu_id=gpu.id,
                gpu_name=f"{server.hostname}/GPU-{gpu.gpu_index}",
                server_hostname=server.hostname,
                utilization_pct=metric.utilization_pct or 0,
                memory_used_mb=metric.memory_used_mb or 0,
                memory_total_mb=gpu.memory_total_mb or 0
            ))
            total_mem_used += metric.memory_used_mb or 0
            total_mem_total += gpu.memory_total_mb or 0

    avg_util = sum(g.utilization_pct for g in gpu_utils) / len(gpu_utils) if gpu_utils else 0

    return UtilizationStats(
        timestamp=datetime.utcnow(),
        gpus=gpu_utils,
        average_utilization=round(avg_util, 2),
        total_memory_used_gb=round(total_mem_used / 1024, 2),
        total_memory_total_gb=round(total_mem_total / 1024, 2)
    )

@router.get("/schedule", response_model=ScheduleResponse)
async def get_schedule(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    target_date = datetime.strptime(date, "%Y-%m-%date")
    start_of_day = target_date.replace(hour=0, minute=0, second=0)
    end_of_day = target_date.replace(hour=23, minute=59, second=59)

    result = await db.execute(
        select(Reservation, GPU, Server, User)
        .join(GPU, Reservation.gpu_id == GPU.id)
        .join(Server, GPU.server_id == Server.id)
        .join(User, Reservation.user_id == User.id)
        .where(
            and_(
                Reservation.status == ReservationStatus.APPROVED,
                Reservation.start_time <= end_of_day,
                Reservation.end_time >= start_of_day
            )
        )
        .order_by(Reservation.start_time)
    )

    items = []
    for reservation, gpu, server, user in result.all():
        items.append(ScheduleItem(
            reservation_id=reservation.id,
            gpu_id=gpu.id,
            gpu_name=f"{server.hostname}/GPU-{gpu.gpu_index}",
            server_hostname=server.hostname,
            username=user.username,
            start_time=reservation.start_time,
            end_time=reservation.end_time,
            purpose=reservation.purpose
        ))

    return ScheduleResponse(items=items, date=date)

@router.get("/usage-trend", response_model=UsageTrendResponse)
async def get_usage_trend(
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            func.time_bucket('1 hour', GPUMetric.time).label('hour'),
            func.avg(GPUMetric.utilization_pct).label('avg_util'),
            func.avg(GPUMetric.memory_used_mb).label('avg_mem')
        )
        .where(GPUMetric.time >= since)
        .group_by('hour')
        .order_by('hour')
    )

    items = [
        UsageTrendItem(
            timestamp=row.hour,
            avg_utilization=round(float(row.avg_util or 0), 2),
            total_memory_used_gb=round(float(row.avg_mem or 0) / 1024, 2)
        )
        for row in result.all()
    ]

    return UsageTrendResponse(items=items, period_days=days)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/dashboard.py
git commit -m "feat: add dashboard API routes"
```

---

## Phase 6: Frontend Pages

### Task 9: Frontend Pages

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/pages/GpuMonitor.tsx`
- Create: `frontend/src/pages/ReservationList.tsx`
- Create: `frontend/src/services/api.ts`
- Create: `frontend/src/stores/authStore.ts`

- [ ] **Step 1: Create API service**

```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

- [ ] **Step 2: Create auth store**

```typescript
import { create } from 'zustand'
import api from '../services/api'

interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'operator' | 'user'
  subsidiary?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (username: string, password: string) => {
    const response = await api.post('/v1/auth/login', { username, password })
    const { access_token } = response.data
    localStorage.setItem('token', access_token)
    set({ token: access_token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  fetchUser: async () => {
    const response = await api.get('/v1/auth/me')
    set({ user: response.data })
  },
}))
```

- [ ] **Step 3: Create Login page**

```typescript
import { useState } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { useAuthStore } from '../stores/authStore'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      message.success('登录成功')
      navigate('/')
    } catch {
      message.error('用户名或密码错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card title="PowerVerse 登录" style={{ width: 400 }}>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Create Dashboard page**

```typescript
import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface DashboardData {
  total_servers: number
  online_servers: number
  total_gpus: number
  busy_gpus: number
  idle_gpus: number
  total_users: number
  pending_reservations: number
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/v1/dashboard/overview').then((res) => setData(res.data))
  }, [])

  if (!data) return null

  return (
    <div>
      <h1>仪表盘</h1>
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card><Statistic title="服务器总数" value={data.total_servers} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="在线服务器" value={data.online_servers} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="GPU总数" value={data.total_gpus} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="忙碌GPU" value={data.busy_gpus} valueStyle={{ color: '#3f8600' }} /></Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card><Statistic title="空闲GPU" value={data.idle_gpus} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="用户总数" value={data.total_users} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待审批" value={data.pending_reservations} /></Card>
        </Col>
      </Row>
    </div>
  )
}
```

- [ ] **Step 5: Create GPU Monitor page**

```typescript
import { useEffect, useState } from 'react'
import { Table, Tag, Button, Drawer } from 'antd'
import api from '../services/api'

interface GPU {
  id: number
  server_id: number
  gpu_index: number
  model_name: string
  memory_total_mb: number
}

interface GPUMetric {
  utilization_pct: number
  memory_used_mb: number
  temperature_c: number
  power_usage_w: number
}

export default function GpuMonitor() {
  const [gpus, setGpus] = useState<GPU[]>([])
  const [selectedGpu, setSelectedGpu] = useState<GPU | null>(null)
  const [metrics, setMetrics] = useState<GPUMetric | null>(null)

  useEffect(() => {
    api.get('/v1/gpus').then((res) => setGpus(res.data))
  }, [])

  const handleViewMetrics = async (gpu: GPU) => {
    setSelectedGpu(gpu)
    const res = await api.get(`/v1/gpus/${gpu.id}/metrics`)
    setMetrics(res.data)
  }

  const columns = [
    { title: 'GPU ID', dataIndex: 'id' },
    { title: 'GPU Index', dataIndex: 'gpu_index' },
    { title: '型号', dataIndex: 'model_name' },
    { title: '显存 (MB)', dataIndex: 'memory_total_mb' },
    {
      title: '操作',
      render: (_: unknown, record: GPU) => (
        <Button onClick={() => handleViewMetrics(record)}>查看监控</Button>
      )
    }
  ]

  return (
    <div>
      <h1>GPU 监控</h1>
      <Table columns={columns} dataSource={gpus} rowKey="id" style={{ marginTop: 16 }} />

      <Drawer title={`GPU ${selectedGpu?.id} 监控数据`} open={!!selectedGpu} onClose={() => setSelectedGpu(null)} width={400}>
        {metrics && (
          <div>
            <p>利用率: {metrics.utilization_pct}%</p>
            <p>显存使用: {metrics.memory_used_mb} MB</p>
            <p>温度: {metrics.temperature_c}°C</p>
            <p>功率: {metrics.power_usage_w} W</p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
```

- [ ] **Step 6: Create Reservation List page**

```typescript
import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, DatePicker, message } from 'antd'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import dayjs from 'dayjs'

interface Reservation {
  id: number
  gpu_id: number
  start_time: string
  end_time: string
  purpose: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  user_id: number
}

export default function ReservationList() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()
  const user = useAuthStore((state) => state.user)

  const fetchReservations = () => {
    api.get('/v1/reservations').then((res) => setReservations(res.data))
  }

  useEffect(() => {
    fetchReservations()
  }, [])

  const handleCreate = async (values: { gpu_id: number; start_time: dayjs.Dayjs; end_time: dayjs.Dayjs; purpose: string }) => {
    await api.post('/v1/reservations', {
      ...values,
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
    })
    message.success('预约申请已提交')
    setIsModalOpen(false)
    form.resetFields()
    fetchReservations()
  }

  const handleApprove = async (id: number) => {
    await api.post(`/v1/reservations/${id}/approve`)
    message.success('已批准')
    fetchReservations()
  }

  const handleReject = async (id: number) => {
    await api.post(`/v1/reservations/${id}/reject`, { approved: false, reason: '' })
    message.success('已拒绝')
    fetchReservations()
  }

  const statusColor: Record<string, string> = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red',
    cancelled: 'gray'
  }

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'GPU ID', dataIndex: 'gpu_id' },
    { title: '开始时间', dataIndex: 'start_time', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '结束时间', dataIndex: 'end_time', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '用途', dataIndex: 'purpose' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
    {
      title: '操作',
      render: (_: unknown, record: Reservation) =>
        record.status === 'pending' && (user?.role === 'admin' || user?.role === 'operator') ? (
          <>
            <Button onClick={() => handleApprove(record.id)} type="link">批准</Button>
            <Button onClick={() => handleReject(record.id)} type="link" danger>拒绝</Button>
          </>
        ) : null
    }
  ]

  return (
    <div>
      <h1>预约管理</h1>
      <Button type="primary" onClick={() => setIsModalOpen(true)} style={{ marginTop: 16 }}>
        新建预约
      </Button>
      <Table columns={columns} dataSource={reservations} rowKey="id" style={{ marginTop: 16 }} />

      <Modal title="新建预约" open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null}>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="gpu_id" label="GPU" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
            <DatePicker showTime />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间" rules={[{ required: true }]}>
            <DatePicker showTime />
          </Form.Item>
          <Form.Item name="purpose" label="用途">
            <Input.TextArea />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>提交</Button>
        </Form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: add frontend pages and services"
```

---

## Phase 7: Docker & K8s Deployment

### Task 10: Create Dockerfiles and K8s manifests

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `k8s/backend-deployment.yaml`
- Create: `k8s/frontend-deployment.yaml`
- Create: `k8s/postgres-statefulset.yaml`
- Create: `k8s/redis-deployment.yaml`

- [ ] **Step 1: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine as build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 3: Create frontend/nginx.conf**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://powerverse-api:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 4: Create k8s manifests**

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: powerverse-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: powerverse-api
  template:
    metadata:
      labels:
        app: powerverse-api
    spec:
      containers:
      - name: api
        image: powerverse-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: powerverse-secrets
              key: database-url
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1
            memory: 2Gi
---
apiVersion: v1
kind: Service
metadata:
  name: powerverse-api
spec:
  selector:
    app: powerverse-api
  ports:
  - port: 80
    targetPort: 8000
```

```yaml
# frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: powerverse-web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: powerverse-web
  template:
    metadata:
      labels:
        app: powerverse-web
    spec:
      containers:
      - name: web
        image: powerverse-web:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: powerverse-web
spec:
  selector:
    app: powerverse-web
  ports:
  - port: 80
    targetPort: 80
```

```yaml
# postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: powerverse-postgres
spec:
  serviceName: powerverse-postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: timescale/timescaledb:latest-pg15
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: powerverse-secrets
              key: postgres-password
        - name: POSTGRES_DB
          value: powerverse
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
```

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: powerverse-redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
```

- [ ] **Step 5: Commit**

```bash
git add Dockerfile k8s/
git commit -m "feat: add Dockerfiles and Kubernetes manifests"
```

---

## Verification

### Verification Steps

1. **Backend API**
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   # Visit http://localhost:8000/api/docs for Swagger UI
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   # Visit http://localhost:3000
   ```

3. **Database Migration**
   ```bash
   cd backend
   alembic init alembic
   alembic revision --autogenerate -m "initial"
   alembic upgrade head
   ```

4. **End-to-End Test**
   - Login with admin credentials
   - Create a server
   - View GPU list
   - Submit a reservation
   - Approve the reservation
   - View dashboard statistics

# PowerVerse - AI算力资源监控与调度系统

## 1. 项目概述

### 背景
需要建设一套AI算力资源监控系统，对分布在三个子公司机房的GPU服务器进行统一监控、预约申请、审批排期管理。

### 规模
- **服务器数量**：10台（Medium规模）
- **GPU数量**：80块（每台8卡）
- **用户规模**：普通用户50人 + 管理员3人 + 调度员3人

---

## 2. 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **前端** | React + Ant Design + TypeScript | 企业级后台管理UI |
| **后端** | Python + FastAPI | 高性能REST API |
| **数据库** | PostgreSQL + TimescaleDB | 结构化数据+时序指标 |
| **监控** | DCGM Exporter + Prometheus | Nvidia官方GPU监控 |
| **任务队列** | Celery + Redis | 定时任务、异步通知 |
| **部署** | Kubernetes | 可扩展容器编排 |

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         K8s Cluster                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Web UI  │  │ FastAPI  │  │Scheduler │  │  Prometheus      │ │
│  │ (React)  │  │ Backend  │  │ (Celery) │  │                  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
│                              │                   │             │
│                    ┌─────────┴─────────┐         │             │
│                    │   PostgreSQL +     │         │             │
│                    │   TimescaleDB      │         │             │
│                    └───────────────────┘         │             │
└────────────────────────────────────────────────────│─────────────┘
          │                                          │
          │ DCGM Exporter (Daemonset)                 │
          ▼                                          ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Server 1       │  │  Server 2       │  │  Server N       │
│  (8 GPUs)       │  │  (8 GPUs)       │  │  (8 GPUs)       │
│  子公司A机房    │  │  子公司B机房    │  │  子公司C机房    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 4. 数据库设计

### ER图
详见 [ER Diagram](../er_diagram.html)

### 核心表结构

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `users` | 用户表 | id, username, email, password_hash, role, subsidiary |
| `servers` | 服务器表 | id, hostname, ip_address, subsidiary, machine_room, rack_location, status |
| `gpus` | GPU卡表 | id, server_id, gpu_index, model_name, memory_total_mb |
| `gpu_metrics` | GPU指标表 (TimescaleDB Hypertable) | time, gpu_id, utilization_pct, memory_used_mb, temperature_c, power_usage_w |
| `reservations` | 预约申请表 | id, user_id, gpu_id, start_time, end_time, purpose, status, approved_by |
| `messages` | 站内消息表 | id, user_id, type, title, content, is_read |
| `audit_logs` | 操作审计表 | id, reservation_id, action, old_status, new_status, operator_id |

### 索引策略
- `gpu_metrics`: `(gpu_id, time)` 复合索引
- `reservations`: `(gpu_id, start_time, end_time)` 复合索引
- `users`: `username`, `email` 唯一索引

---

## 5. API 接口设计

### 认证模块
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 登录，返回JWT |
| POST | `/api/v1/auth/logout` | 登出 |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |

### 用户管理（Admin）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/users` | 用户列表 |
| POST | `/api/v1/users` | 创建用户 |
| GET | `/api/v1/users/{id}` | 用户详情 |
| PUT | `/api/v1/users/{id}` | 更新用户 |
| DELETE | `/api/v1/users/{id}` | 删除用户 |

### 服务器管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/servers` | 服务器列表（支持筛选） |
| POST | `/api/v1/servers` | 添加服务器 |
| GET | `/api/v1/servers/{id}` | 服务器详情 |
| PUT | `/api/v1/servers/{id}` | 更新服务器 |
| DELETE | `/api/v1/servers/{id}` | 删除服务器 |

### GPU管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/gpus` | GPU列表（支持筛选） |
| GET | `/api/v1/gpus/{id}` | GPU详情 |
| GET | `/api/v1/gpus/{id}/metrics` | GPU实时指标 |
| GET | `/api/v1/gpus/{id}/metrics/history` | GPU历史指标 |

### 预约申请
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/reservations` | 预约列表 |
| POST | `/api/v1/reservations` | 创建预约申请 |
| GET | `/api/v1/reservations/{id}` | 预约详情 |
| PUT | `/api/v1/reservations/{id}` | 更新预约（仅pending状态） |
| DELETE | `/api/v1/reservations/{id}` | 取消预约 |
| POST | `/api/v1/reservations/{id}/approve` | 审批通过 |
| POST | `/api/v1/reservations/{id}/reject` | 审批拒绝 |

### 看板统计
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/dashboard/overview` | 全局概览统计 |
| GET | `/api/v1/dashboard/utilization` | GPU利用率统计 |
| GET | `/api/v1/dashboard/schedule` | 排期表数据 |
| GET | `/api/v1/dashboard/usage-trend` | 使用趋势 |

### 消息通知
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/messages` | 消息列表 |
| GET | `/api/v1/messages/unread-count` | 未读消息数 |
| PUT | `/api/v1/messages/{id}/read` | 标记已读 |

---

## 6. 前端页面设计

### 页面结构
```
├── 登录页 (Login)
├── 控制台 Layout
│   ├── 顶部导航栏 (Header)
│   ├── 侧边菜单 (Sidebar)
│   └── 页面内容区
```

### 页面列表

| 页面 | 路由 | 权限 |
|------|------|------|
| 首页仪表盘 | `/` | 全部 |
| 服务器管理 | `/servers` | 全部 |
| GPU监控 | `/gpus` | 全部 |
| GPU详情 | `/gpus/:id` | 全部 |
| 预约申请 | `/reservations` | 全部 |
| 预约管理 | `/reservations/manage` | Admin/Operator |
| 排期看板 | `/schedule` | 全部 |
| 统计看板 | `/stats` | 全部 |
| 用户管理 | `/admin/users` | Admin |
| 消息中心 | `/messages` | 全部 |

---

## 7. 组件架构

```
src/
├── components/
│   ├── common/           # Header, Sidebar, PageContainer, StatCard
│   ├── dashboard/       # GpuOverview, UtilizationChart, RecentActivity
│   ├── gpu/             # GpuTable, GpuStatusBadge, GpuMetricsChart
│   ├── reservation/     # ReservationForm, ReservationTable, ApprovalModal
│   └── schedule/        # ScheduleCalendar, ScheduleTimeline
├── pages/               # 页面组件
├── services/            # API服务层 (axios)
├── stores/              # 状态管理 (Zustand)
├── hooks/               # 自定义Hooks
└── types/               # TypeScript类型定义
```

---

## 8. 部署架构

### K8s 部署拓扑
- **Web UI**: Deployment + Service + HPA
- **FastAPI Backend**: Deployment + Service + HPA
- **Celery Worker**: Deployment
- **Redis**: StatefulSet
- **PostgreSQL + TimescaleDB**: StatefulSet
- **Prometheus**: Deployment + Service
- **DCGM Exporter**: DaemonSet（每节点一个Pod）

### 资源配置建议

| 组件 | CPU | Memory | 副本数 |
|------|-----|--------|--------|
| Web UI | 500m | 512Mi | 2 |
| FastAPI | 1 core | 2Gi | 2-3 |
| Celery Worker | 500m | 1Gi | 2 |
| Prometheus | 2 cores | 4Gi | 1 |
| PostgreSQL | 2 cores | 8Gi | 1 |
| Redis | 500m | 1Gi | 1 |

---

## 9. 数据量估算

### 估算条件
- 10台服务器 × 8卡 = 80块GPU
- 采集间隔：30秒
- 保留期限：60天

### 存储估算

| 数据类型 | 单条大小 | 60天总量 |
|---------|---------|---------|
| GPU指标 | ~100 bytes | ~14 GB |
| 索引开销 | ~50 bytes | ~7 GB |
| **总计** | ~150 bytes | **~21 GB** |

TimescaleDB 压缩后存储约 **2-3 GB**。

### 保留策略
```sql
-- 60天后自动删除旧数据
SELECT add_retention_policy('gpu_metrics', INTERVAL '60 days');

-- 持续聚合用于看板
CREATE MATERIALIZED VIEW gpu_hourly_stats
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS hour,
       gpu_id,
       AVG(utilization_pct) AS avg_util,
       AVG(memory_used_mb) AS avg_mem
FROM gpu_metrics
GROUP BY hour, gpu_id;
```

---

## 10. 业务流程

### 任务调度流程
```
用户提交申请 → 管理员审批 → 通过后进入排期表 → 运维手动执行
                    ↓
              拒绝则发送站内消息通知用户
```

### 角色权限

| 角色 | 权限 |
|------|------|
| Admin | 用户管理、审批预约、服务器管理 |
| Operator | 审批预约、排期管理 |
| User | 查看资源、提交预约申请、查看我的预约 |

---

## 11. 后续计划

1. **第一阶段**：项目初始化、数据库模型、API基础框架
2. **第二阶段**：认证模块、服务器/GPU管理
3. **第三阶段**：预约申请与审批、消息通知
4. **第四阶段**：排期看板、统计看板
5. **第五阶段**：Prometheus/Grafana集成、DCGM Exporter部署

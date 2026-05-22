import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ConfigProvider, Layout, Menu, Badge, Button } from 'antd'
import { DashboardOutlined, AppstoreOutlined, ControlOutlined, ScheduleOutlined, BellOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import { useAuthStore } from './stores/authStore'
import { useEffect, useState } from 'react'
import api from './services/api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import GpuMonitor from './pages/GpuMonitor'
import ReservationList from './pages/ReservationList'
import Servers from './pages/Servers'
import Notifications from './pages/Notifications'

const { Header, Content } = Layout

function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, fetchUser } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchUser()
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/v1/messages/unread-count')
      setUnreadCount(res.data.count)
    } catch {
      // ignore
    }
  }

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/servers', icon: <AppstoreOutlined />, label: '服务器' },
    { key: '/gpus', icon: <ControlOutlined />, label: 'GPU监控' },
    { key: '/reservations', icon: <ScheduleOutlined />, label: '预约管理' },
    {
      key: '/notifications',
      icon: <BellOutlined />,
      label: <span>通知 {unreadCount > 0 && <Badge count={unreadCount} size="small" />}</span>,
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#001529' }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: 40 }}>
          PowerVerse
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ flex: 1, minWidth: 0 }}
        />
        <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span><UserOutlined /> {user?.username || 'User'}</span>
          <span style={{ fontSize: 12, color: '#999' }}>({user?.role})</span>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} style={{ color: '#fff' }}>
            退出
          </Button>
        </div>
      </Header>
      <Content style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gpus" element={<GpuMonitor />} />
          <Route path="/reservations" element={<ReservationList />} />
          <Route path="/servers" element={<Servers />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Content>
    </Layout>
  )
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </ConfigProvider>
  )
}

export default App
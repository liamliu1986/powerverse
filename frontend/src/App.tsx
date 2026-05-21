import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import GpuMonitor from './pages/GpuMonitor'
import ReservationList from './pages/ReservationList'

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/gpus" element={<GpuMonitor />} />
        <Route path="/reservations" element={<ReservationList />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  )
}

export default App
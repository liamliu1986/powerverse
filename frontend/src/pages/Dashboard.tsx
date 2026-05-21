import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic } from 'antd'
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
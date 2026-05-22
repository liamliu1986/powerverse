import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Timeline, DatePicker, Progress, Spin, Space, Tag, Empty } from 'antd'
import { CloudServerOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { dashboardApi, DashboardOverview, UtilizationStats, ScheduleItem, UsageTrendItem } from '../services/dashboardApi'
import dayjs from 'dayjs'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [utilization, setUtilization] = useState<UtilizationStats | null>(null)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [scheduleDate, setScheduleDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [trend, setTrend] = useState<UsageTrendItem[]>([])

  useEffect(() => {
    loadAllData()
  }, [])

  useEffect(() => {
    loadSchedule(scheduleDate)
  }, [scheduleDate])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [overviewRes, utilRes, trendRes] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getUtilization(),
        dashboardApi.getUsageTrend(7),
      ])
      setOverview(overviewRes.data)
      setUtilization(utilRes.data)
      setTrend(trendRes.data.items)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSchedule = async (date: string) => {
    try {
      const res = await dashboardApi.getSchedule(date)
      setSchedule(res.data.items)
    } catch (error) {
      console.error('Failed to load schedule:', error)
    }
  }

  if (loading || !overview) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    )
  }

  const utilizationColumns = [
    { title: 'GPU', dataIndex: 'gpu_name', key: 'gpu_name' },
    { title: '服务器', dataIndex: 'server_hostname', key: 'server_hostname' },
    {
      title: '利用率',
      dataIndex: 'utilization_pct',
      key: 'utilization_pct',
      render: (v: number) => <Progress percent={v} size="small" />
    },
    {
      title: '显存',
      key: 'memory',
      render: (_: unknown, r: UtilizationStats['gpus'][0]) =>
        `${(r.memory_used_mb / 1024).toFixed(1)} / ${(r.memory_total_mb / 1024).toFixed(1)} GB`
    },
  ]

  return (
    <div>
      <h1>仪表盘</h1>

      {/* 概览统计卡片 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="服务器总数"
              value={overview.total_servers}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线服务器"
              value={overview.online_servers}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="GPU总数"
              value={overview.total_gpus}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="忙碌GPU"
              value={overview.busy_gpus}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="空闲GPU"
              value={overview.idle_gpus}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="用户总数" value={overview.total_users} />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="待审批预约"
              value={overview.pending_reservations}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {/* GPU利用率 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={14}>
          <Card title="GPU 利用率" extra={<Tag color="blue">平均 {utilization?.average_utilization.toFixed(1)}%</Tag>}>
            <Table
              dataSource={utilization?.gpus || []}
              columns={utilizationColumns}
              rowKey="gpu_id"
              size="small"
              pagination={false}
              scroll={{ y: 300 }}
              locale={{ emptyText: <Empty description="暂无GPU数据" /> }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="当日调度">
            <Space direction="vertical" style={{ width: '100%' }}>
              <DatePicker
                value={dayjs(scheduleDate)}
                onChange={(date) => date && setScheduleDate(date.format('YYYY-MM-DD'))}
                style={{ width: '100%' }}
              />
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                {schedule.length === 0 ? (
                  <Empty description="当日无预约" style={{ marginTop: 40 }} />
                ) : (
                  <Timeline
                    items={schedule.map((item) => ({
                      color: item.username ? 'blue' : 'gray',
                      children: (
                        <div>
                          <strong>{item.gpu_name}</strong> @ {item.server_hostname}
                          <br />
                          <span style={{ fontSize: 12, color: '#999' }}>
                            {dayjs(item.start_time).format('HH:mm')} - {dayjs(item.end_time).format('HH:mm')}
                          </span>
                          <br />
                          <span style={{ fontSize: 12 }}>{item.username || '未分配'}</span>
                        </div>
                      ),
                    }))}
                  />
                )}
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 使用趋势 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="7天使用趋势">
            {trend.length === 0 ? (
              <Empty description="暂无趋势数据" />
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
                {trend.map((item, index) => (
                  <div key={index} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {dayjs(item.timestamp).format('MM/DD')}
                    </div>
                    <div style={{ height: 80, display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${item.avg_utilization}%`,
                          backgroundColor: '#1890ff',
                          borderRadius: '4px 4px 0 0',
                          minHeight: 4,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{item.avg_utilization.toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Timeline, DatePicker, Progress, Spin, Space, Tag, Empty, Badge } from 'antd'
import { CloudServerOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, DashboardOutlined } from '@ant-design/icons'
import { dashboardApi, DashboardOverview, UtilizationStats, ScheduleItem, UsageTrendItem } from '../services/dashboardApi'
import { gpuApi, GPUMetric } from '../services/gpuApi'
import dayjs from 'dayjs'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [utilization, setUtilization] = useState<UtilizationStats | null>(null)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [scheduleDate, setScheduleDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [trend, setTrend] = useState<UsageTrendItem[]>([])
  const [gpuHistoryMap, setGpuHistoryMap] = useState<Record<number, GPUMetric[]>>({})

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

      // 加载GPU历史数据用于24h趋势图
      if (utilRes.data.gpus && utilRes.data.gpus.length > 0) {
        const gpuIds = utilRes.data.gpus.map((g: { gpu_id: number }) => g.gpu_id)
        const historyPromises = gpuIds.slice(0, 8).map((id: number) =>
          gpuApi.getMetricsHistory(id, 24).catch(() => ({ gpu_id: id, metrics: [] }))
        )
        const historyResults = await Promise.all(historyPromises)
        const historyMap: Record<number, GPUMetric[]> = {}
        historyResults.forEach((r: { gpu_id: number; metrics: GPUMetric[] }) => {
          historyMap[r.gpu_id] = r.metrics
        })
        setGpuHistoryMap(historyMap)
      }
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

      {/* GPU 实时状态卡片 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <DashboardOutlined />
                GPU 实时监控
                <Tag color="blue">平均利用率 {utilization?.average_utilization.toFixed(1) || 0}%</Tag>
              </Space>
            }
            extra={
              <Space>
                <span style={{ fontSize: 12, color: '#999' }}>
                  显存: {(utilization?.total_memory_used_gb || 0).toFixed(1)} / {(utilization?.total_memory_total_gb || 0).toFixed(1)} GB
                </span>
              </Space>
            }
          >
            {utilization?.gpus && utilization.gpus.length > 0 ? (
              <Row gutter={[16, 16]}>
                {utilization.gpus.map((gpu) => {
                  const status = gpu.utilization_pct > 80 ? 'busy' : gpu.utilization_pct > 20 ? 'used' : 'idle'
                  const statusColor = status === 'busy' ? 'red' : status === 'used' ? 'orange' : 'green'
                  const statusText = status === 'busy' ? '繁忙' : status === 'used' ? '使用中' : '空闲'

                  return (
                    <Col key={gpu.gpu_id} span={6}>
                      <Card size="small" bordered bodyStyle={{ padding: 12 }}>
                        <Space style={{ marginBottom: 8 }}>
                          <Badge status={statusColor as 'success' | 'processing' | 'error' | 'default'} />
                          <span style={{ fontWeight: 500 }}>{gpu.gpu_name}</span>
                        </Space>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                          {gpu.server_hostname}
                        </div>

                        <Row gutter={8}>
                          <Col span={12}>
                            <div style={{ textAlign: 'center', background: '#e6f7ff', padding: 8, borderRadius: 4 }}>
                              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                                {gpu.utilization_pct}%
                              </div>
                              <div style={{ fontSize: 10, color: '#666' }}>利用率</div>
                            </div>
                          </Col>
                          <Col span={12}>
                            <div style={{ textAlign: 'center', background: '#fff7e6', padding: 8, borderRadius: 4 }}>
                              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fa8c16' }}>
                                {(gpu.memory_used_mb / 1024).toFixed(1)}
                              </div>
                              <div style={{ fontSize: 10, color: '#666' }}>显存(GB)</div>
                            </div>
                          </Col>
                        </Row>

                        <div style={{ marginTop: 8 }}>
                          <Progress
                            percent={Math.round((gpu.memory_used_mb / gpu.memory_total_mb) * 100)}
                            size="small"
                            format={() => `${(gpu.memory_used_mb / 1024).toFixed(1)} / ${(gpu.memory_total_mb / 1024).toFixed(0)} GB`}
                          />
                        </div>

                        {/* 24h utilization trend mini chart */}
                        {gpuHistoryMap[gpu.gpu_id] && gpuHistoryMap[gpu.gpu_id].length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>24h趋势</div>
                            <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 24 }}>
                              {gpuHistoryMap[gpu.gpu_id].slice(-12).map((m, i) => {
                                const max = Math.max(...gpuHistoryMap[gpu.gpu_id].map((x) => x.utilization_pct ?? 0), 1)
                                return (
                                  <div
                                    key={i}
                                    style={{
                                      flex: 1,
                                      height: `${((m.utilization_pct ?? 0) / max) * 100}%`,
                                      backgroundColor: '#1890ff',
                                      borderRadius: '1px 1px 0 0',
                                      minHeight: 2,
                                    }}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        )}

                        <Tag color={statusColor} style={{ marginTop: 4 }}>
                          {statusText}
                        </Tag>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            ) : (
              <Empty description="暂无GPU数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 当日调度 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
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
          <Card
            title="7天使用趋势"
            extra={
              <Space>
                <span style={{ fontSize: 12 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 3, backgroundColor: '#1890ff', borderRadius: 2, marginRight: 4 }}></span>
                  利用率
                </span>
                <span style={{ fontSize: 12, marginLeft: 12 }}>
                  <span style={{ display: 'inline-block', width: 16, height: 3, backgroundColor: '#fa8c16', borderRadius: 2, marginRight: 4 }}></span>
                  显存使用率
                </span>
              </Space>
            }
          >
            {trend.length === 0 ? (
              <Empty description="暂无趋势数据" />
            ) : (
              <div style={{ position: 'relative', height: 200, padding: '10 50 30 50' }}>
                <svg width="100%" height="180" viewBox="0 0 700 180" style={{ overflow: 'visible' }}>
                  {/* 左Y轴标签 */}
                  <text x="5" y="15" fontSize="10" fill="#999">100%</text>
                  <text x="5" y="90" fontSize="10" fill="#999">50%</text>
                  <text x="5" y="165" fontSize="10" fill="#999">0%</text>

                  {/* 右Y轴标签 */}
                  <text x="695" y="15" fontSize="10" fill="#999" textAnchor="end">100%</text>
                  <text x="695" y="90" fontSize="10" fill="#999" textAnchor="end">50%</text>
                  <text x="695" y="165" fontSize="10" fill="#999" textAnchor="end">0%</text>

                  {/* 网格线 */}
                  <line x1="50" y1="10" x2="690" y2="10" stroke="#eee" strokeWidth="1" />
                  <line x1="50" y1="90" x2="690" y2="90" stroke="#eee" strokeWidth="1" />
                  <line x1="50" y1="170" x2="690" y2="170" stroke="#eee" strokeWidth="1" />

                  {/* 计算曲线点 - 利用率(蓝色) */}
                  {(() => {
                    const maxUtil = Math.max(...trend.map((t) => t.avg_utilization), 1)
                    const points = trend.map((item, i) => {
                      const x = 50 + (i / Math.max(trend.length - 1, 1)) * 640
                      const y = 170 - (item.avg_utilization / maxUtil) * 160
                      return `${x},${y}`
                    })
                    return (
                      <>
                        <polyline
                          points={points.join(' ')}
                          fill="none"
                          stroke="#1890ff"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {/* 数据点 */}
                        {trend.map((item, i) => {
                          const x = 50 + (i / Math.max(trend.length - 1, 1)) * 640
                          const y = 170 - (item.avg_utilization / maxUtil) * 160
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="3"
                              fill="#1890ff"
                            />
                          )
                        })}
                      </>
                    )
                  })()}

                  {/* 计算曲线点 - 显存使用率(橙色) */}
                  {(() => {
                    const maxMemUtil = Math.max(...trend.map((t) => t.memory_utilization_pct), 1)
                    const points = trend.map((item, i) => {
                      const x = 50 + (i / Math.max(trend.length - 1, 1)) * 640
                      const y = 170 - (item.memory_utilization_pct / maxMemUtil) * 160
                      return `${x},${y}`
                    })
                    return (
                      <>
                        <polyline
                          points={points.join(' ')}
                          fill="none"
                          stroke="#fa8c16"
                          strokeWidth="2"
                          strokeDasharray="5,3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {/* 数据点 */}
                        {trend.map((item, i) => {
                          const x = 50 + (i / Math.max(trend.length - 1, 1)) * 640
                          const y = 170 - (item.memory_utilization_pct / maxMemUtil) * 160
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="3"
                              fill="#fa8c16"
                            />
                          )
                        })}
                      </>
                    )
                  })()}

                  {/* X轴标签 */}
                  {trend.map((item, i) => {
                    const x = 50 + (i / Math.max(trend.length - 1, 1)) * 640
                    return (
                      <text
                        key={i}
                        x={x}
                        y="185"
                        fontSize="10"
                        fill="#999"
                        textAnchor="middle"
                      >
                        {dayjs(item.timestamp).format('MM/DD')}
                      </text>
                    )
                  })}
                </svg>
                {/* 图例数值 */}
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 4 }}>
                  {trend.map((item, index) => (
                    <div key={index} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 9, color: '#1890ff' }}>{item.avg_utilization.toFixed(0)}%</div>
                      <div style={{ fontSize: 9, color: '#fa8c16' }}>{item.memory_utilization_pct.toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
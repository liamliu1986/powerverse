import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Progress, Spin, Space, Tag, Empty, Badge, Select } from 'antd'
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
  const [scheduleGpuFilter, setScheduleGpuFilter] = useState<number | null>(null)
  const [trend, setTrend] = useState<UsageTrendItem[]>([])
  const [gpuHistoryMap, setGpuHistoryMap] = useState<Record<number, GPUMetric[]>>({})
  const [chartWidth, setChartWidth] = useState(window.innerWidth)
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; data: UsageTrendItem | null }>({ visible: false, x: 0, y: 0, data: null })
  const [hoveredGpu, setHoveredGpu] = useState<{ gpuId: number; x: number; y: number; time: string; util: number; mem: string } | null>(null)

  useEffect(() => {
    loadAllData()
  }, [])

  useEffect(() => {
    const handleResize = () => setChartWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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

  const handleMouseEnter = (e: React.MouseEvent, item: UsageTrendItem) => {
    const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect()
    if (rect) {
      setTooltip({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        data: item,
      })
    }
  }

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, data: null })
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
                          <div style={{ marginTop: 6, position: 'relative' }}>
                            <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>24h趋势</div>
                            <svg width="100%" height="40" style={{ display: 'block' }} onMouseLeave={() => setHoveredGpu(null)}>
                              {(() => {
                                const data = gpuHistoryMap[gpu.gpu_id].slice(-12)
                                const maxUtil = Math.max(...data.map((x) => x.utilization_pct ?? 0), 1)
                                const maxMem = Math.max(...data.map((x) => (x.memory_used_mb ?? 0) / 1024), 1)
                                const w = 100 / data.length
                                const utilPoints = data.map((m, i) => {
                                  const x = i * w + w / 2
                                  const y = 28 - ((m.utilization_pct ?? 0) / maxUtil) * 26
                                  return { x, y, m, i }
                                })
                                const memPoints = data.map((m, i) => {
                                  const x = i * w + w / 2
                                  const y = 28 - (((m.memory_used_mb ?? 0) / 1024) / maxMem) * 26
                                  return { x, y, m, i }
                                })
                                const utilPoly = utilPoints.map(p => `${p.x},${p.y}`).join(' ')
                                const memPoly = memPoints.map(p => `${p.x},${p.y}`).join(' ')
                                return (
                                  <>
                                    {/* Time labels */}
                                    <text x="2" y="38" fontSize="8" fill="#999">00:00</text>
                                    <text x="45" y="38" fontSize="8" fill="#999">06:00</text>
                                    <text x="88" y="38" fontSize="8" fill="#999">12:00</text>
                                    {/* Lines */}
                                    <polyline points={utilPoly} fill="none" stroke="#1890ff" strokeWidth="1.5" strokeLinejoin="round" />
                                    <polyline points={memPoly} fill="none" stroke="#fa8c16" strokeWidth="1.5" strokeDasharray="2,1" strokeLinejoin="round" />
                                    {/* Hover areas */}
                                    {utilPoints.map(p => (
                                      <rect
                                        key={p.i}
                                        x={p.x - w / 2}
                                        y={0}
                                        width={w}
                                        height={35}
                                        fill="transparent"
                                        onMouseEnter={(e) => {
                                          const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect()
                                          if (rect) {
                                            setHoveredGpu({
                                              gpuId: gpu.gpu_id,
                                              x: e.clientX - rect.left,
                                              y: e.clientY - rect.top - 50,
                                              time: p.m.time,
                                              util: p.m.utilization_pct ?? 0,
                                              mem: ((p.m.memory_used_mb ?? 0) / 1024).toFixed(1)
                                            })
                                          }
                                        }}
                                      />
                                    ))}
                                  </>
                                )
                              })()}
                            </svg>
                            {hoveredGpu && hoveredGpu.gpuId === gpu.gpu_id && (
                              <div style={{
                                position: 'absolute',
                                left: hoveredGpu.x,
                                top: hoveredGpu.y,
                                transform: 'translateX(-50%)',
                                backgroundColor: 'rgba(0,0,0,0.85)',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: 10,
                                pointerEvents: 'none',
                                zIndex: 100,
                                whiteSpace: 'nowrap'
                              }}>
                                <div>{dayjs.utc(hoveredGpu.time).tz('Asia/Shanghai').format('HH:mm')}</div>
                                <div style={{ color: '#1890ff' }}>利用率: {hoveredGpu.util}%</div>
                                <div style={{ color: '#fa8c16' }}>显存: {hoveredGpu.mem}GB</div>
                              </div>
                            )}
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
        <Col span={24}>
          <Card
            title={
              <Space>
                <span>当日调度</span>
                <DatePicker
                  value={dayjs(scheduleDate)}
                  onChange={(date) => date && setScheduleDate(date.format('YYYY-MM-DD'))}
                  format="YYYY-MM-DD"
                  style={{ width: 130 }}
                />
                <Select
                  placeholder="筛选GPU"
                  allowClear
                  style={{ width: 150 }}
                  value={scheduleGpuFilter}
                  onChange={(v) => setScheduleGpuFilter(v)}
                >
                  {Array.from(new Set(schedule.map(s => s.gpu_id))).map(gpuId => {
                    const gpu = schedule.find(s => s.gpu_id === gpuId)
                    return (
                      <Select.Option key={gpuId} value={gpuId}>
                        {gpu?.gpu_name || `GPU #${gpuId}`}
                      </Select.Option>
                    )
                  })}
                </Select>
              </Space>
            }
          >
            {schedule.length === 0 ? (
              <Empty description="当日无预约" />
            ) : (
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 450 }}>
                {(() => {
                  const filteredSchedule = scheduleGpuFilter
                    ? schedule.filter(s => s.gpu_id === scheduleGpuFilter)
                    : schedule
                  const gpuGroups = filteredSchedule.reduce((acc, item) => {
                    const key = `${item.gpu_id}-${item.gpu_name}`
                    if (!acc[key]) acc[key] = []
                    acc[key].push(item)
                    return acc
                  }, {} as Record<string, ScheduleItem[]>)

                  const gpuCount = Object.keys(gpuGroups).length
                  const rowHeight = 38
                  const headerHeight = 50
                  const svgHeight = headerHeight + gpuCount * rowHeight + 10

                  // 计算最长GPU名称需要的宽度（每个字符约7px + 10px内边距）
                  const maxGpuNameLen = Math.max(...Object.values(gpuGroups).map(items => (items[0]?.gpu_name || '').length))
                  const leftMargin = Math.max(70, maxGpuNameLen * 7 + 30)
                  const chartWidthPx = chartWidth - leftMargin

                  return (
                    <svg width="100%" height={svgHeight} style={{ display: 'block', minWidth: 800 }}>
                      {/* X轴: 0-24小时 */}
                      <line x1={leftMargin} y1={headerHeight - 10} x2="100%" y2={headerHeight - 10} stroke="#ccc" strokeWidth="1" />

                      {/* 小时刻度和网格 */}
                      {Array.from({ length: 25 }, (_, i) => {
                        const pct = i / 24
                        const x = leftMargin + pct * chartWidthPx
                        const isHour = i % 3 === 0
                        return (
                          <g key={i}>
                            <line
                              x1={x}
                              y1={isHour ? headerHeight - 15 : headerHeight - 12}
                              x2={x}
                              y2={headerHeight - 10}
                              stroke="#999"
                              strokeWidth={isHour ? 1 : 0.5}
                            />
                            {isHour && (
                              <text
                                x={x}
                                y={headerHeight - 20}
                                fontSize="11"
                                fill="#666"
                                textAnchor="middle"
                              >
                                {i.toString().padStart(2, '0')}:00
                              </text>
                            )}
                          </g>
                        )
                      })}

                      {/* 按GPU分组显示预约 */}
                      {Object.entries(gpuGroups).map(([key, items], gpuIdx) => {
                        const gpuName = items[0]?.gpu_name || key
                        const yBase = headerHeight + gpuIdx * rowHeight
                        const colors = ['#1890ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2']
                        const color = colors[gpuIdx % colors.length]

                        return (
                          <g key={key}>
                            {/* GPU标签 */}
                            <text
                              x={leftMargin - 8}
                              y={yBase + rowHeight / 2 + 4}
                              fontSize="11"
                              fill="#333"
                              textAnchor="end"
                            >
                              {gpuName}
                            </text>
                            {/* 分隔线 */}
                            <line x1={leftMargin} y1={yBase} x2="100%" y2={yBase} stroke="#f0f0f0" strokeWidth="1" />
                            {/* 预约条 */}
                            {items.map((item, idx) => {
                              const start = dayjs.utc(item.start_time).tz('Asia/Shanghai')
                              const end = dayjs.utc(item.end_time).tz('Asia/Shanghai')
                              const startHour = start.hour() + start.minute() / 60
                              const endHour = end.hour() + end.minute() / 60

                              const barX = leftMargin + (startHour / 24) * chartWidthPx
                              const barWidth = Math.max(6, ((endHour - startHour) / 24) * chartWidthPx)
                              const barY = yBase + 6
                              const barHeight = rowHeight - 12

                              return (
                                <g key={`bar-${item.reservation_id}-${idx}`} style={{ cursor: 'pointer' }}>
                                  <rect
                                    x={barX}
                                    y={barY}
                                    width={barWidth}
                                    height={barHeight}
                                    fill={color}
                                    rx="4"
                                    opacity={0.9}
                                  />
                                  <title>{gpuName}{'\n'}{item.username || '未分配'}{'\n'}{start.format('HH:mm')} - {end.format('HH:mm')}{item.purpose ? '\n' + item.purpose : ''}</title>
                                  {barWidth > 40 && (
                                    <text
                                      x={barX + barWidth / 2}
                                      y={yBase + rowHeight / 2 + 4}
                                      fontSize="10"
                                      fill="#fff"
                                      textAnchor="middle"
                                    >
                                      {item.username?.substring(0, 5) || '未分配'}
                                    </text>
                                  )}
                                </g>
                              )
                            })}
                          </g>
                        )
                      })}
                    </svg>
                  )
                })()}
              </div>
            )}
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
              <div style={{ height: 240, position: 'relative' }}>
                {/* Tooltip */}
                {tooltip.visible && (
                  <div
                    style={{
                      position: 'absolute',
                      left: tooltip.x,
                      top: tooltip.y - 60,
                      transform: 'translateX(-50%)',
                      backgroundColor: 'rgba(0,0,0,0.85)',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: 4,
                      fontSize: 12,
                      pointerEvents: 'none',
                      zIndex: 100,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ marginBottom: 4 }}>{dayjs.utc(tooltip.data?.timestamp).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm')}</div>
                    <div style={{ color: '#1890ff' }}>利用率: {tooltip.data?.avg_utilization.toFixed(1)}%</div>
                    <div style={{ color: '#fa8c16' }}>显存使用率: {tooltip.data?.memory_utilization_pct.toFixed(1)}%</div>
                  </div>
                )}
                <svg width="100%" height="220" style={{ display: 'block' }} preserveAspectRatio="none">
                  {/* 左Y轴标签 - 基于100%坐标系 */}
                  <text x="30" y="12" fontSize="10" fill="#999">100%</text>
                  <text x="30" y="91" fontSize="10" fill="#999">50%</text>
                  <text x="30" y="170" fontSize="10" fill="#999">0%</text>

                  {/* 网格线 */}
                  <line x1="45" y1="10" x2="100%" y2="10" stroke="#eee" strokeWidth="1" />
                  <line x1="45" y1="90" x2="100%" y2="90" stroke="#eee" strokeWidth="1" />
                  <line x1="45" y1="170" x2="100%" y2="170" stroke="#eee" strokeWidth="1" />

                  {/* 计算曲线点 - 利用率(蓝色) - 标准化到100% */}
                  {(() => {
                    const points = trend.map((item, i) => {
                      const pct = trend.length <= 1 ? 0 : i / (trend.length - 1)
                      const x = 45 + pct * (chartWidth - 120)
                      const y = 170 - (item.avg_utilization / 100) * 160
                      return { x, y, item }
                    })
                    return (
                      <>
                        <polyline
                          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#1890ff"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {points.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="4"
                            fill="#fff"
                            stroke="#1890ff"
                            strokeWidth="2"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(e) => handleMouseEnter(e, p.item)}
                            onMouseLeave={handleMouseLeave}
                          />
                        ))}
                      </>
                    )
                  })()}

                  {/* 计算曲线点 - 显存使用率(橙色) - 标准化到100% */}
                  {(() => {
                    const points = trend.map((item, i) => {
                      const pct = trend.length <= 1 ? 0 : i / (trend.length - 1)
                      const x = 45 + pct * (chartWidth - 120)
                      const y = 170 - (item.memory_utilization_pct / 100) * 160
                      return { x, y, item }
                    })
                    return (
                      <>
                        <polyline
                          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#fa8c16"
                          strokeWidth="2"
                          strokeDasharray="5,3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {points.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="4"
                            fill="#fff"
                            stroke="#fa8c16"
                            strokeWidth="2"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(e) => handleMouseEnter(e, p.item)}
                            onMouseLeave={handleMouseLeave}
                          />
                        ))}
                      </>
                    )
                  })()}

                  {/* X轴标签 - 每隔1个显示，避免拥挤 */}
                  {(() => {
                    const showIndices = trend.map((_, i) => i).filter((i) => i % 2 === 0)
                    const points = trend.map((item, i) => {
                      const pct = trend.length <= 1 ? 0 : i / (trend.length - 1)
                      const x = 45 + pct * (chartWidth - 120)
                      return { x, item, show: showIndices.includes(i) }
                    })
                    return (
                      <>
                        {points.filter((p) => p.show).map((p, i) => (
                          <g key={i}>
                            <text
                              x={p.x}
                              y="192"
                              fontSize="9"
                              fill="#666"
                              textAnchor="middle"
                              transform={`rotate(-30 ${p.x} 192)`}
                            >
                              {dayjs.utc(p.item.timestamp).tz('Asia/Shanghai').format('MM/DD HH:mm')}
                            </text>
                          </g>
                        ))}
                      </>
                    )
                  })()}
                </svg>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { Table, Button, Drawer, Select, Space, message, Progress, Tag, Modal, List, Divider } from 'antd'
import { PlusOutlined, ApartmentOutlined, SearchOutlined } from '@ant-design/icons'
import { gpuApi, GPU, GPUMetric, DiscoveredGPU } from '../services/gpuApi'
import api from '../services/api'
import dayjs from 'dayjs'

const { Option } = Select

interface Server {
  id: number
  hostname: string
  ip_address: string
}

interface GPUWithServer extends GPU {
  server?: Server
}

export default function GpuMonitor() {
  const [gpus, setGpus] = useState<GPUWithServer[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGpu, setSelectedGpu] = useState<GPUWithServer | null>(null)
  const [metrics, setMetrics] = useState<GPUMetric | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<GPUMetric[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [filterServerId, setFilterServerId] = useState<number | null>(null)
  const [historyHours, setHistoryHours] = useState(24)

  // 发现GPU相关状态
  const [discoverModalVisible, setDiscoverModalVisible] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [previewGpus, setPreviewGpus] = useState<DiscoveredGPU[]>([])
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null)
  const [discoveringLoading, setDiscoveringLoading] = useState(false)

  useEffect(() => {
    fetchServers()
    fetchGpus()
  }, [])

  const fetchServers = async () => {
    try {
      const serversRes = await api.get('/v1/servers')
      setServers(serversRes.data)
    } catch {
      message.error('获取服务器列表失败')
    }
  }

  const fetchGpus = async (serverId?: number) => {
    setLoading(true)
    try {
      const data = await gpuApi.list(serverId)
      setGpus(data as GPUWithServer[])
    } catch {
      message.error('获取GPU列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (value: number | null) => {
    setFilterServerId(value)
    fetchGpus(value || undefined)
  }

  const handleViewDetails = async (gpu: GPUWithServer) => {
    setSelectedGpu(gpu)
    setDetailVisible(true)

    try {
      const [metricsData, historyData] = await Promise.all([
        gpuApi.getMetrics(gpu.id),
        gpuApi.getMetricsHistory(gpu.id, historyHours),
      ])
      setMetrics(metricsData)
      setMetricsHistory(historyData.metrics)
    } catch {
      setMetrics(null)
      setMetricsHistory([])
    }
  }

  const handleHistoryChange = async (hours: number) => {
    setHistoryHours(hours)
    if (selectedGpu) {
      try {
        const res = await gpuApi.getMetricsHistory(selectedGpu.id, hours)
        setMetricsHistory(res.metrics)
      } catch {
        setMetricsHistory([])
      }
    }
  }

  // 发现GPU相关处理函数
  const handleDiscoverClick = () => {
    setSelectedServerId(filterServerId)
    setDiscoverModalVisible(true)
  }

  const handleServerSelectChange = (value: number) => {
    setSelectedServerId(value)
  }

  const handlePreviewDiscover = async () => {
    if (!selectedServerId) {
      message.warning('请先选择服务器')
      return
    }
    setDiscovering(true)
    try {
      const data = await gpuApi.discoverPreview(selectedServerId)
      setPreviewGpus(data.gpus)
    } catch {
      message.error('发现GPU失败，请检查服务器IP和exporter状态')
      setPreviewGpus([])
    } finally {
      setDiscovering(false)
    }
  }

  const handleConfirmDiscover = async () => {
    if (!selectedServerId || previewGpus.length === 0) return
    setDiscoveringLoading(true)
    try {
      const result = await gpuApi.discover(selectedServerId)
      if (result.discovered > 0) {
        message.success(`成功发现并添加 ${result.discovered} 个GPU`)
      } else if (result.already_exists > 0) {
        message.info(`已存在 ${result.already_exists} 个GPU，无需重复添加`)
      }
      setDiscoverModalVisible(false)
      setPreviewGpus([])
      fetchGpus(filterServerId || undefined)
    } catch {
      message.error('添加GPU失败')
    } finally {
      setDiscoveringLoading(false)
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: 'GPU信息',
      key: 'gpu_info',
      render: (_: unknown, r: GPUWithServer) => (
        <Space direction="vertical" size={0}>
          <span>{r.server?.hostname || `Server #${r.server_id}`} / GPU {r.gpu_index}</span>
          <span style={{ fontSize: 12, color: '#888' }}>{r.model_name || '未知型号'}</span>
        </Space>
      ),
    },
    {
      title: '显存',
      dataIndex: 'memory_total_mb',
      key: 'memory_total_mb',
      width: 100,
      render: (v: number) => v ? `${(v / 1024).toFixed(0)} GB` : 'N/A',
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: unknown, r: GPUWithServer) => {
        if (metrics && selectedGpu?.id === r.id) {
          const util = metrics.utilization_pct ?? 0
          if (util > 80) return <Tag color="red">繁忙</Tag>
          if (util > 20) return <Tag color="orange">使用中</Tag>
          return <Tag color="green">空闲</Tag>
        }
        return <Tag>--</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: GPUWithServer) => (
        <Button size="small" onClick={() => handleViewDetails(record)}>
          详情
        </Button>
      ),
    },
  ]

  const renderTrendChart = () => {
    if (metricsHistory.length === 0) return <div style={{ textAlign: 'center', color: '#999' }}>暂无历史数据</div>

    const maxUtil = Math.max(...metricsHistory.map((m) => m.utilization_pct ?? 0), 1)

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
          利用率趋势 (过去 {historyHours} 小时)
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 60 }}>
          {metricsHistory.slice(-20).map((m, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${((m.utilization_pct ?? 0) / maxUtil) * 100}%`,
                backgroundColor: '#1890ff',
                borderRadius: '2px 2px 0 0',
                minHeight: 2,
              }}
              title={`${dayjs(m.time).format('HH:mm')}: ${m.utilization_pct}%`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>GPU管理</h1>
        <Space>
          <Select
            placeholder="筛选服务器"
            allowClear
            style={{ width: 200 }}
            onChange={handleFilterChange}
            value={filterServerId}
          >
            {servers.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.hostname} ({s.ip_address})
              </Option>
            ))}
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleDiscoverClick}>
            发现GPU
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={gpus}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* GPU详情Drawer */}
      <Drawer
        title={
          <Space>
            <ApartmentOutlined />
            GPU详情
          </Space>
        }
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false)
          setSelectedGpu(null)
          setMetrics(null)
          setMetricsHistory([])
        }}
        width={450}
      >
        {selectedGpu && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h3>{selectedGpu.model_name || 'GPU'}</h3>
              <p style={{ color: '#666', fontSize: 14 }}>
                {selectedGpu.server?.hostname || `Server #${selectedGpu.server_id}`} / GPU {selectedGpu.gpu_index}
              </p>
            </div>

            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>基本信息</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>GPU索引: <strong>{selectedGpu.gpu_index}</strong></div>
                <div>显存: <strong>{selectedGpu.memory_total_mb ? `${(selectedGpu.memory_total_mb / 1024).toFixed(0)} GB` : 'N/A'}</strong></div>
                <div>服务器: <strong>{selectedGpu.server?.hostname || 'N/A'}</strong></div>
                <div>IP地址: <strong>{selectedGpu.server?.ip_address || 'N/A'}</strong></div>
                <div>创建时间: <strong>{dayjs(selectedGpu.created_at).format('YYYY-MM-DD')}</strong></div>
              </div>
            </div>

            {metrics && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>实时监控</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>{metrics.utilization_pct ?? 0}%</div>
                    <div style={{ fontSize: 12, color: '#666' }}>利用率</div>
                  </div>
                  <div style={{ background: '#fff7e6', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fa8c16' }}>{metrics.temperature_c ?? 0}°C</div>
                    <div style={{ fontSize: 12, color: '#666' }}>温度</div>
                  </div>
                  <div style={{ background: '#f6ffed', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                      {((metrics.memory_used_mb ?? 0) / 1024).toFixed(1)} GB
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>已用显存</div>
                  </div>
                  <div style={{ background: '#fff1f0', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f5222d' }}>{metrics.power_usage_w ?? 0} W</div>
                    <div style={{ fontSize: 12, color: '#666' }}>功率</div>
                  </div>
                </div>
                <Progress
                  percent={Math.round(((metrics.memory_used_mb ?? 0) / ((metrics.memory_free_mb ?? 0) + (metrics.memory_used_mb ?? 0))) * 100)}
                  format={() => `${((metrics.memory_used_mb ?? 0) / 1024).toFixed(1)} / ${(((metrics.memory_free_mb ?? 0) + (metrics.memory_used_mb ?? 0)) / 1024).toFixed(1)} GB`}
                  style={{ marginTop: 12 }}
                />
                <div style={{ fontSize: 12, color: '#999', textAlign: 'right', marginTop: 4 }}>
                  更新于 {dayjs(metrics.time).format('HH:mm:ss')}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <Space style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#999' }}>历史数据</span>
                <Select value={historyHours} onChange={handleHistoryChange} size="small" style={{ width: 100 }}>
                  <Option value={6}>6小时</Option>
                  <Option value={24}>24小时</Option>
                  <Option value={72}>3天</Option>
                  <Option value={168}>7天</Option>
                </Select>
              </Space>
              {renderTrendChart()}
            </div>
          </>
        )}
      </Drawer>

      {/* 发现GPU Modal */}
      <Modal
        title="发现GPU设备"
        open={discoverModalVisible}
        onCancel={() => {
          setDiscoverModalVisible(false)
          setPreviewGpus([])
          setSelectedServerId(null)
        }}
        footer={null}
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <span style={{ marginRight: 8 }}>选择服务器:</span>
            <Select
              value={selectedServerId}
              onChange={handleServerSelectChange}
              placeholder="请选择服务器"
              style={{ width: 280 }}
            >
              {servers.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.hostname} ({s.ip_address})
                </Option>
              ))}
            </Select>
            <Button
              onClick={handlePreviewDiscover}
              loading={discovering}
              disabled={!selectedServerId}
              style={{ marginLeft: 8 }}
            >
              预览
            </Button>
          </div>

          {previewGpus.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  将发现 {previewGpus.length} 个GPU设备:
                </div>
                <List
                  size="small"
                  dataSource={previewGpus}
                  renderItem={(gpu) => (
                    <List.Item style={{ padding: '4px 0' }}>
                      GPU {gpu.gpu_index} - {gpu.model_name || '未知型号'} - 显存: {gpu.memory_total_mb ? `${(gpu.memory_total_mb / 1024).toFixed(0)} GB` : 'N/A'}
                    </List.Item>
                  )}
                />
              </div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleConfirmDiscover}
                loading={discoveringLoading}
                block
              >
                确认添加 {previewGpus.length} 个GPU
              </Button>
            </>
          )}

          {previewGpus.length === 0 && !discovering && selectedServerId && (
            <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
              点击"预览"按钮发现GPU设备
            </div>
          )}
        </Space>
      </Modal>
    </div>
  )
}
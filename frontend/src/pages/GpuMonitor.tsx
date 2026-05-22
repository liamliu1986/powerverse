import { useEffect, useState } from 'react'
import { Table, Button, Drawer, Form, Input, Select, Space, message, Progress, Tag } from 'antd'
import { PlusOutlined, ApartmentOutlined } from '@ant-design/icons'
import api from '../services/api'
import dayjs from 'dayjs'

interface Server {
  id: number
  hostname: string
  ip_address: string
}

interface GPU {
  id: number
  server_id: number
  gpu_index: number
  model_name?: string
  memory_total_mb?: number
  created_at: string
  server?: Server
}

interface GPUMetric {
  utilization_pct: number
  memory_used_mb: number
  memory_free_mb: number
  temperature_c: number
  power_usage_w: number
  time: string
}

interface GPUMetricsHistoryResponse {
  gpu_id: number
  metrics: GPUMetric[]
}

const { Option } = Select

export default function GpuMonitor() {
  const [gpus, setGpus] = useState<GPU[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGpu, setSelectedGpu] = useState<GPU | null>(null)
  const [metrics, setMetrics] = useState<GPUMetric | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<GPUMetric[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [form] = Form.useForm()
  const [filterServerId, setFilterServerId] = useState<number | null>(null)
  const [historyHours, setHistoryHours] = useState(24)

  useEffect(() => {
    fetchServers()
    fetchGpus()
  }, [])

  const fetchServers = async () => {
    try {
      const res = await api.get<Server[]>('/v1/servers')
      setServers(res.data)
    } catch {
      message.error('获取服务器列表失败')
    }
  }

  const fetchGpus = async (serverId?: number) => {
    setLoading(true)
    try {
      const url = serverId ? `/v1/gpus?server_id=${serverId}` : '/v1/gpus'
      const res = await api.get<GPU[]>(url)
      setGpus(res.data)
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

  const handleViewDetails = async (gpu: GPU) => {
    setSelectedGpu(gpu)
    setDetailVisible(true)

    try {
      const [metricsRes, historyRes] = await Promise.all([
        api.get<GPUMetric>(`/v1/gpus/${gpu.id}/metrics`),
        api.get<GPUMetricsHistoryResponse>(`/v1/gpus/${gpu.id}/metrics/history?hours=${historyHours}`),
      ])
      setMetrics(metricsRes.data)
      setMetricsHistory(historyRes.data.metrics)
    } catch {
      setMetrics(null)
      setMetricsHistory([])
    }
  }

  const handleHistoryChange = async (hours: number) => {
    setHistoryHours(hours)
    if (selectedGpu) {
      try {
        const res = await api.get<GPUMetricsHistoryResponse>(
          `/v1/gpus/${selectedGpu.id}/metrics/history?hours=${hours}`
        )
        setMetricsHistory(res.data.metrics)
      } catch {
        setMetricsHistory([])
      }
    }
  }

  const handleAdd = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await api.post('/v1/gpus', values)
      message.success('添加成功')
      setModalVisible(false)
      fetchGpus(filterServerId || undefined)
    } catch {
      message.error('添加失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '服务器',
      key: 'server',
      render: (_: unknown, r: GPU) => r.server?.hostname || `Server #${r.server_id}`,
    },
    { title: 'GPU索引', dataIndex: 'gpu_index', key: 'gpu_index', width: 80 },
    { title: '型号', dataIndex: 'model_name', key: 'model_name' },
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
      render: (_: unknown, r: GPU) => {
        if (metrics && selectedGpu?.id === r.id) {
          const util = metrics.utilization_pct
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
      render: (_: unknown, record: GPU) => (
        <Button size="small" onClick={() => handleViewDetails(record)}>
          详情
        </Button>
      ),
    },
  ]

  const renderTrendChart = () => {
    if (metricsHistory.length === 0) return <div style={{ textAlign: 'center', color: '#999' }}>暂无历史数据</div>

    const maxUtil = Math.max(...metricsHistory.map((m) => m.utilization_pct), 1)

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
                height: `${(m.utilization_pct / maxUtil) * 100}%`,
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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加GPU
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
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>{metrics.utilization_pct}%</div>
                    <div style={{ fontSize: 12, color: '#666' }}>利用率</div>
                  </div>
                  <div style={{ background: '#fff7e6', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fa8c16' }}>{metrics.temperature_c}°C</div>
                    <div style={{ fontSize: 12, color: '#666' }}>温度</div>
                  </div>
                  <div style={{ background: '#f6ffed', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                      {(metrics.memory_used_mb / 1024).toFixed(1)} GB
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>已用显存</div>
                  </div>
                  <div style={{ background: '#fff1f0', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f5222d' }}>{metrics.power_usage_w} W</div>
                    <div style={{ fontSize: 12, color: '#666' }}>功率</div>
                  </div>
                </div>
                <Progress
                  percent={Math.round((metrics.memory_used_mb / (metrics.memory_free_mb + metrics.memory_used_mb)) * 100)}
                  format={() => `${(metrics.memory_used_mb / 1024).toFixed(1)} / ${((metrics.memory_free_mb + metrics.memory_used_mb) / 1024).toFixed(1)} GB`}
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

      {/* 添加GPU Drawer */}
      <Drawer
        title="添加GPU"
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={400}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="server_id" label="服务器" rules={[{ required: true, message: '请选择服务器' }]}>
            <Select placeholder="请选择服务器">
              {servers.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.hostname} ({s.ip_address})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="gpu_index" label="GPU索引" rules={[{ required: true, message: '请输入GPU索引' }]}>
            <Input type="number" placeholder="e.g. 0" />
          </Form.Item>
          <Form.Item name="model_name" label="型号">
            <Input placeholder="e.g. NVIDIA A100" />
          </Form.Item>
          <Form.Item name="memory_total_mb" label="显存 (MB)">
            <Input type="number" placeholder="e.g. 40960" />
          </Form.Item>
          <Button type="primary" onClick={handleSubmit} block>
            确定
          </Button>
        </Form>
      </Drawer>
    </div>
  )
}
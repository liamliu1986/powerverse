import { useEffect, useState } from 'react'
import { Table, Button, Drawer, Form, Input, Select, Space, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import api from '../services/api'

interface Server {
  id: number
  hostname: string
  ip_address: string
}

interface GPU {
  id: number
  server_id: number
  gpu_index: number
  model_name: string
  memory_total_mb: number
  created_at: string
}

interface GPUMetric {
  utilization_pct: number
  memory_used_mb: number
  memory_free_mb: number
  temperature_c: number
  power_usage_w: number
  time: string
}

const { Option } = Select

export default function GpuMonitor() {
  const [gpus, setGpus] = useState<GPU[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGpu, setSelectedGpu] = useState<GPU | null>(null)
  const [metrics, setMetrics] = useState<GPUMetric | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [filterServerId, setFilterServerId] = useState<number | null>(null)

  useEffect(() => {
    fetchServers()
    fetchGpus()
  }, [])

  const fetchServers = async () => {
    try {
      const res = await api.get('/v1/servers')
      setServers(res.data)
    } catch {
      message.error('获取服务器列表失败')
    }
  }

  const fetchGpus = async (serverId?: number) => {
    setLoading(true)
    try {
      const url = serverId ? `/v1/gpus?server_id=${serverId}` : '/v1/gpus'
      const res = await api.get(url)
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

  const handleViewMetrics = async (gpu: GPU) => {
    setSelectedGpu(gpu)
    try {
      const res = await api.get(`/v1/gpus/${gpu.id}/metrics`)
      setMetrics(res.data)
    } catch {
      setMetrics(null)
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
    { title: '服务器ID', dataIndex: 'server_id', key: 'server_id', width: 80 },
    { title: 'GPU索引', dataIndex: 'gpu_index', key: 'gpu_index', width: 80 },
    { title: '型号', dataIndex: 'model_name', key: 'model_name' },
    { title: '显存 (MB)', dataIndex: 'memory_total_mb', key: 'memory_total_mb', width: 100 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: GPU) => (
        <Button size="small" onClick={() => handleViewMetrics(record)}>查看监控</Button>
      )
    }
  ]

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
              <Option key={s.id} value={s.id}>{s.hostname} ({s.ip_address})</Option>
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

      <Drawer
        title={`GPU ${selectedGpu?.id} 监控数据`}
        open={!!selectedGpu}
        onClose={() => { setSelectedGpu(null); setMetrics(null) }}
        width={400}
      >
        {selectedGpu && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>型号:</strong> {selectedGpu.model_name || 'N/A'}</p>
            <p><strong>显存:</strong> {selectedGpu.memory_total_mb} MB</p>
          </div>
        )}
        {metrics ? (
          <div>
            <p>利用率: <strong>{metrics.utilization_pct}%</strong></p>
            <p>显存使用: <strong>{metrics.memory_used_mb} MB</strong> / {metrics.memory_free_mb} MB</p>
            <p>温度: <strong>{metrics.temperature_c}°C</strong></p>
            <p>功率: <strong>{metrics.power_usage_w} W</strong></p>
            <p style={{ color: '#999', fontSize: 12 }}>更新时间: {new Date(metrics.time).toLocaleString()}</p>
          </div>
        ) : (
          <p>暂无监控数据</p>
        )}
      </Drawer>

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
                <Option key={s.id} value={s.id}>{s.hostname} ({s.ip_address})</Option>
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
          <Button type="primary" onClick={handleSubmit} block>确定</Button>
        </Form>
      </Drawer>
    </div>
  )
}
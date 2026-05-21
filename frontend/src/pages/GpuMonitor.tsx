import { useEffect, useState } from 'react'
import { Table, Button, Drawer } from 'antd'
import api from '../services/api'

interface GPU {
  id: number
  server_id: number
  gpu_index: number
  model_name: string
  memory_total_mb: number
}

interface GPUMetric {
  utilization_pct: number
  memory_used_mb: number
  temperature_c: number
  power_usage_w: number
}

export default function GpuMonitor() {
  const [gpus, setGpus] = useState<GPU[]>([])
  const [selectedGpu, setSelectedGpu] = useState<GPU | null>(null)
  const [metrics, setMetrics] = useState<GPUMetric | null>(null)

  useEffect(() => {
    api.get('/v1/gpus').then((res) => setGpus(res.data))
  }, [])

  const handleViewMetrics = async (gpu: GPU) => {
    setSelectedGpu(gpu)
    try {
      const res = await api.get(`/v1/gpus/${gpu.id}/metrics`)
      setMetrics(res.data)
    } catch {
      setMetrics(null)
    }
  }

  const columns = [
    { title: 'GPU ID', dataIndex: 'id', key: 'id' },
    { title: 'GPU Index', dataIndex: 'gpu_index', key: 'gpu_index' },
    { title: '型号', dataIndex: 'model_name', key: 'model_name' },
    { title: '显存 (MB)', dataIndex: 'memory_total_mb', key: 'memory_total_mb' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: GPU) => (
        <Button onClick={() => handleViewMetrics(record)}>查看监控</Button>
      )
    }
  ]

  return (
    <div>
      <h1>GPU 监控</h1>
      <Table columns={columns} dataSource={gpus} rowKey="id" style={{ marginTop: 16 }} />

      <Drawer
        title={`GPU ${selectedGpu?.id} 监控数据`}
        open={!!selectedGpu}
        onClose={() => setSelectedGpu(null)}
        width={400}
      >
        {metrics ? (
          <div>
            <p>利用率: {metrics.utilization_pct}%</p>
            <p>显存使用: {metrics.memory_used_mb} MB</p>
            <p>温度: {metrics.temperature_c}°C</p>
            <p>功率: {metrics.power_usage_w} W</p>
          </div>
        ) : (
          <p>暂无监控数据</p>
        )}
      </Drawer>
    </div>
  )
}
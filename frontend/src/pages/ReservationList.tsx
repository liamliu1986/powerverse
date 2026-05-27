import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, DatePicker, Select, Tag, Space, message, Alert } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import { gpuApi, AvailableSlot } from '../services/gpuApi'
import dayjs from 'dayjs'

interface GPU {
  id: number
  server_id: number
  gpu_index: number
  model_name?: string
  memory_total_mb?: number
  server?: {
    hostname: string
    ip_address: string
  }
}

interface Reservation {
  id: number
  gpu_id: number
  start_time: string
  end_time: string
  purpose?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  user_id: number
  created_at: string
  user?: {
    username: string
    email: string
  }
  gpu?: GPU
}

interface RejectModalProps {
  open: boolean
  reservationId: number | null
  onConfirm: (id: number, reason: string) => void
  onCancel: () => void
}

function RejectModal({ open, reservationId, onConfirm, onCancel }: RejectModalProps) {
  const [reason, setReason] = useState('')

  return (
    <Modal
      title="拒绝预约"
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (reservationId) {
          onConfirm(reservationId, reason)
          setReason('')
        }
      }}
      okText="确认拒绝"
      okButtonProps={{ danger: true }}
    >
      <p>确定要拒绝这个预约吗？</p>
      <Input.TextArea
        placeholder="请输入拒绝原因（可选）"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
      />
    </Modal>
  )
}

export default function ReservationList() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [gpus, setGpus] = useState<GPU[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ open: boolean; reservationId: number | null }>({
    open: false,
    reservationId: null,
  })
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [form] = Form.useForm()
  const user = useAuthStore((state) => state.user)
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [selectedGpuId, setSelectedGpuId] = useState<number | null>(null)

  const fetchReservations = async () => {
    setLoading(true)
    try {
      const res = await api.get<Reservation[]>('/v1/reservations')
      setReservations(res.data)
    } catch {
      message.error('获取预约列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchGpus = async () => {
    try {
      const res = await api.get<GPU[]>('/v1/gpus')
      setGpus(res.data)
    } catch {
      message.error('获取GPU列表失败')
    }
  }

  useEffect(() => {
    fetchReservations()
    fetchGpus()
  }, [])

  const handleGpuSelect = async (gpuId: number) => {
    setSelectedGpuId(gpuId)
    try {
      const date = dayjs().format('YYYY-MM-DD')
      const data = await gpuApi.getAvailableSlots(gpuId, date)
      setAvailableSlots(data.slots)
    } catch {
      setAvailableSlots([])
    }
  }

  const handleCreate = async (values: { gpu_id: number; start_time: dayjs.Dayjs; end_time: dayjs.Dayjs; purpose?: string }) => {
    try {
      await api.post('/v1/reservations', {
        gpu_id: values.gpu_id,
        start_time: values.start_time.toISOString(),
        end_time: values.end_time.toISOString(),
        purpose: values.purpose,
      })
      message.success('预约申请已提交')
      setIsModalOpen(false)
      form.resetFields()
      fetchReservations()
    } catch (err: any) {
      const detail = err.response?.data?.detail
      message.error(detail || '创建预约失败')
    }
  }

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/v1/reservations/${id}/approve`)
      message.success('已批准')
      fetchReservations()
    } catch {
      message.error('批准失败')
    }
  }

  const handleReject = async (id: number, reason: string) => {
    try {
      await api.post(`/v1/reservations/${id}/reject`, { approved: false, reason })
      message.success('已拒绝')
      setRejectModal({ open: false, reservationId: null })
      fetchReservations()
    } catch {
      message.error('拒绝失败')
    }
  }

  const handleCancel = async (id: number) => {
    try {
      await api.post(`/v1/reservations/${id}/cancel`)
      message.success('已撤销')
      fetchReservations()
    } catch {
      message.error('撤销失败')
    }
  }

  const handleDeleteReservation = async (id: number) => {
    try {
      await api.delete(`/v1/reservations/${id}`)
      message.success('已删除')
      fetchReservations()
    } catch {
      message.error('删除失败')
    }
  }

  const canManage = user?.role === 'admin' || user?.role === 'operator'

  const statusColor: Record<string, string> = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red',
    cancelled: 'default',
  }

  const filteredReservations = statusFilter
    ? reservations.filter((r) => r.status === statusFilter)
    : reservations

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: 'GPU',
      key: 'gpu',
      render: (_: unknown, r: Reservation) =>
        r.gpu ? `${r.gpu.server?.hostname || 'N/A'} / GPU ${r.gpu.gpu_index}` : `GPU #${r.gpu_id}`,
    },
    {
      title: '申请人',
      key: 'user',
      render: (_: unknown, r: Reservation) => r.user?.username || `User #${r.user_id}`,
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (v: string) => dayjs.utc(v).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (v: string) => dayjs.utc(v).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm'),
    },
    { title: '用途', dataIndex: 'purpose', key: 'purpose', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: Reservation) => {
        const isOwn = record.user_id === user?.id
        return (
          <Space>
            {record.status === 'pending' && canManage && (
              <>
                <Button
                  size="small"
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(record.id)}
                >
                  批准
                </Button>
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setRejectModal({ open: true, reservationId: record.id })}
                >
                  拒绝
                </Button>
              </>
            )}
            {record.status !== 'cancelled' && (isOwn || canManage) && (
              <Button
                size="small"
                type="link"
                danger
                onClick={() => handleCancel(record.id)}
              >
                撤销
              </Button>
            )}
            {record.status === 'cancelled' && (isOwn || canManage) && (
              <Button
                size="small"
                type="link"
                danger
                onClick={() => handleDeleteReservation(record.id)}
              >
                删除
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>预约管理</h1>
        <Space>
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 120 }}
            onChange={(v) => setStatusFilter(v || undefined)}
            value={statusFilter}
          >
            <Select.Option value="pending">待审批</Select.Option>
            <Select.Option value="approved">已批准</Select.Option>
            <Select.Option value="rejected">已拒绝</Select.Option>
            <Select.Option value="cancelled">已取消</Select.Option>
          </Select>
          <Button type="primary" onClick={() => setIsModalOpen(true)}>
            新建预约
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredReservations}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="新建预约"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        footer={null}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="gpu_id"
            label="选择GPU"
            rules={[{ required: true, message: '请选择GPU' }]}
          >
            <Select placeholder="请选择GPU" onChange={handleGpuSelect}>
              {gpus.map((gpu) => (
                <Select.Option key={gpu.id} value={gpu.id}>
                  {gpu.server?.hostname || `Server #${gpu.server_id}`} / GPU {gpu.gpu_index}
                  {gpu.model_name && ` (${gpu.model_name})`}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedGpuId && availableSlots.length > 0 && (
            <Alert
              message="今日可用时段 (利用率<50% 且 显存<50%)"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              description={
                <div style={{ maxHeight: 100, overflow: 'auto' }}>
                  {availableSlots.map((slot, i) => (
                    <div key={i} style={{ fontSize: 12 }}>
                      {dayjs(slot.start_time).format('HH:mm')}-{dayjs(slot.end_time).format('HH:mm')}
                      {' '}(利用率{(slot.avg_utilization_pct).toFixed(0)}%, 显存{(slot.avg_memory_used_mb / 1024).toFixed(1)}GB)
                    </div>
                  ))}
                </div>
              }
            />
          )}

          <Form.Item
            name="start_time"
            label="开始时间"
            rules={[{ required: true, message: '请选择开始时间' }]}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="end_time"
            label="结束时间"
            rules={[{ required: true, message: '请选择结束时间' }]}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purpose" label="用途">
            <Input.TextArea placeholder="请输入预约用途" rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            提交申请
          </Button>
        </Form>
      </Modal>

      <RejectModal
        open={rejectModal.open}
        reservationId={rejectModal.reservationId}
        onConfirm={handleReject}
        onCancel={() => setRejectModal({ open: false, reservationId: null })}
      />
    </div>
  )
}
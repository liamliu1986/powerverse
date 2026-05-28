import { useEffect, useState } from 'react'
import { Table, Button, Modal, Input, Select, Tag, Space, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ExpandAltOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
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
  template_id?: number
  time_description?: string
  conflict_note?: string
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
  const [loading, setLoading] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ open: boolean; reservationId: number | null }>({
    open: false,
    reservationId: null,
  })
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const user = useAuthStore((state) => state.user)

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

  useEffect(() => {
    fetchReservations()
  }, [])

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

  // Build table data with expandable rows
  const tableData = reservations.map((r) => ({
    ...r,
    key: r.id,
    isGroupHeader: false,
  }))

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  console.log('tableData length:', tableData.length)

  const filteredReservations = statusFilter
    ? reservations.filter((r) => r.status === statusFilter)
    : reservations

  const columns = [
    {
      title: 'GPU',
      key: 'gpu',
      render: (_: unknown, r: Reservation) =>
        r.gpu ? `${r.gpu.server?.hostname || 'N/A'} / GPU ${r.gpu.gpu_index}` : `GPU #${r.gpu_id}`,
    },
    {
      title: '来源',
      key: 'template',
      render: (_: unknown, r: Reservation) =>
        r.template_id ? (
          <Tag icon={<ExpandAltOutlined />} color="blue">模板</Tag>
        ) : (
          <Tag>单次</Tag>
        ),
    },
    {
      title: '预约时间',
      key: 'time_range',
      render: (_: unknown, r: Reservation) => {
        const start = dayjs.utc(r.start_time).tz('Asia/Shanghai')
        const end = dayjs.utc(r.end_time).tz('Asia/Shanghai')
        if (r.time_description) {
          return <div style={{ whiteSpace: 'pre-line' }}>{r.time_description}<br />{start.format('HH:mm')} - {end.format('HH:mm')}</div>
        }
        return `${start.format('YYYY-MM-DD HH:mm')} - ${end.format('HH:mm')}`
      },
    },
    { title: '用途', dataIndex: 'purpose', key: 'purpose', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    {
      title: '备注',
      key: 'conflict_note',
      render: (_: unknown, r: Reservation) =>
        r.conflict_note ? (
          <span style={{ color: 'orange', fontSize: 12 }}>{r.conflict_note}</span>
        ) : null,
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
        <h1>预约看板</h1>
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
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredReservations}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <RejectModal
        open={rejectModal.open}
        reservationId={rejectModal.reservationId}
        onConfirm={handleReject}
        onCancel={() => setRejectModal({ open: false, reservationId: null })}
      />
    </div>
  )
}
import { useEffect, useState } from 'react'
import { Table, Button, Modal, Input, Select, Tag, Space, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
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

// 分组后的行数据
interface GroupedReservation {
  key: string
  isGroup: boolean
  template_id?: number
  gpu_id: number
  gpu_name: string
  instances: Reservation[]
  instance_count: number
  time_description: string
  time_slot: string  // 时段，如 "09:00 - 18:00"
  conflict_note?: string
  status: string
  user_id: number
  user?: Reservation['user']
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

  // 将数据按template_id分组，模板的多个实例合并成一行
  const groupedData: GroupedReservation[] = []
  const templateMap = new Map<number, Reservation[]>()
  const singleReservations: Reservation[] = []

  // 先筛选状态
  const filtered = statusFilter
    ? reservations.filter((r) => r.status === statusFilter)
    : reservations

  // 分离模板预约和单次预约
  filtered.forEach(r => {
    if (r.template_id) {
      if (!templateMap.has(r.template_id)) {
        templateMap.set(r.template_id, [])
      }
      templateMap.get(r.template_id)!.push(r)
    } else {
      singleReservations.push(r)
    }
  })

  // 添加模板分组
  templateMap.forEach((instances, templateId) => {
    const first = instances[0]
    const start = dayjs.utc(first.start_time).tz('Asia/Shanghai')
    const end = dayjs.utc(first.end_time).tz('Asia/Shanghai')
    groupedData.push({
      key: `template-${templateId}`,
      isGroup: true,
      template_id: templateId,
      gpu_id: first.gpu_id,
      gpu_name: first.gpu ? `${first.gpu.server?.hostname || 'N/A'} / GPU ${first.gpu.gpu_index}` : `GPU #${first.gpu_id}`,
      instances,
      instance_count: instances.length,
      time_description: first.time_description || '',
      time_slot: `${start.format('HH:mm')} - ${end.format('HH:mm')}`,
      conflict_note: first.conflict_note,
      status: first.status,
      user_id: first.user_id,
      user: first.user,
    })
  })

  // 添加单次预约
  singleReservations.forEach(r => {
    const start = dayjs.utc(r.start_time).tz('Asia/Shanghai')
    const end = dayjs.utc(r.end_time).tz('Asia/Shanghai')
    groupedData.push({
      key: `single-${r.id}`,
      isGroup: false,
      gpu_id: r.gpu_id,
      gpu_name: r.gpu ? `${r.gpu.server?.hostname || 'N/A'} / GPU ${r.gpu.gpu_index}` : `GPU #${r.gpu_id}`,
      instances: [r],
      instance_count: 1,
      time_description: '',
      time_slot: `${start.format('HH:mm')} - ${end.format('HH:mm')}`,
      conflict_note: r.conflict_note,
      status: r.status,
      user_id: r.user_id,
      user: r.user,
    })
  })

  const columns = [
    {
      title: 'GPU',
      key: 'gpu',
      render: (_: unknown, r: GroupedReservation) => r.gpu_name,
    },
    {
      title: '预约时间',
      key: 'time_range',
      render: (_: unknown, r: GroupedReservation) => {
        const timeSlot = r.time_slot
        if (r.isGroup && r.time_description) {
          return <div style={{ whiteSpace: 'pre-line' }}>{r.time_description}<br /><span style={{ color: '#666', fontSize: 12 }}>{timeSlot}</span></div>
        }
        return `${r.instances[0] ? dayjs.utc(r.instances[0].start_time).tz('Asia/Shanghai').format('YYYY-MM-DD') : '-'} ${timeSlot}`
      },
    },
    {
      title: '用途',
      key: 'purpose',
      render: (_: unknown, r: GroupedReservation) => r.instances[0]?.purpose || '-',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    {
      title: '备注',
      key: 'conflict_note',
      render: (_: unknown, r: GroupedReservation) =>
        r.conflict_note ? (
          <span style={{ color: 'orange', fontSize: 12 }}>{r.conflict_note}</span>
        ) : null,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: GroupedReservation) => {
        // 对于模板组，操作列显示主要实例的操作
        const first = record.instances[0]
        const isOwn = record.user_id === user?.id
        return (
          <Space size="small">
            {first.status === 'pending' && canManage && (
              <>
                <Button
                  size="small"
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApprove(first.id)}
                >
                  批准
                </Button>
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setRejectModal({ open: true, reservationId: first.id })}
                >
                  拒绝
                </Button>
              </>
            )}
            {first.status !== 'cancelled' && (isOwn || canManage) && (
              <Button
                size="small"
                type="link"
                danger
                onClick={() => handleCancel(first.id)}
              >
                撤销
              </Button>
            )}
            {first.status === 'cancelled' && (isOwn || canManage) && (
              <Button
                size="small"
                type="link"
                danger
                onClick={() => handleDeleteReservation(first.id)}
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
        dataSource={groupedData}
        rowKey="key"
        loading={loading}
        pagination={{ pageSize: 10 }}
        expandable={
          {
            expandedRowRender: (record: GroupedReservation) => {
              if (!record.isGroup || record.instances.length <= 1) return null
              const purpose = record.instances[0]?.purpose || '-'
              return (
                <div style={{ padding: '8px 0' }}>
                  {/* 用途信息 - 合并显示 */}
                  <div style={{ padding: '8px 12px', background: '#f0f7ff', borderRadius: 4, marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: '#666' }}>用途：</span>
                    <span>{purpose}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px', background: '#fafafa', fontWeight: 500, fontSize: 12, color: '#666', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ width: 180 }}>日期</span>
                    <span style={{ flex: 1 }}>预约时间</span>
                    <span style={{ width: 80 }}>状态</span>
                    <span style={{ width: 100 }}>备注</span>
                    <span style={{ width: 200 }}>操作</span>
                  </div>
                  {record.instances.map((inst) => {
                    const start = dayjs.utc(inst.start_time).tz('Asia/Shanghai')
                    const end = dayjs.utc(inst.end_time).tz('Asia/Shanghai')
                    return (
                      <div key={inst.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 8px', borderBottom: '1px solid #f0f0f0' }}>
                        <span style={{ width: 180, fontSize: 12 }}>{start.format('YYYY-MM-DD')}</span>
                        <span style={{ flex: 1, fontSize: 12 }}>{start.format('HH:mm')} - {end.format('HH:mm')}</span>
                        <span style={{ width: 80 }}>
                          <Tag color={statusColor[inst.status]} style={{ fontSize: 11 }}>{inst.status}</Tag>
                        </span>
                        <span style={{ width: 100, fontSize: 11, color: 'orange' }}>{inst.conflict_note || '-'}</span>
                        <span style={{ width: 200 }}>
                          <Space size="small">
                            {inst.status === 'pending' && canManage && (
                              <>
                                <Button size="small" type="link" icon={<CheckCircleOutlined />} onClick={() => handleApprove(inst.id)}>批准</Button>
                                <Button size="small" type="link" danger icon={<CloseCircleOutlined />} onClick={() => setRejectModal({ open: true, reservationId: inst.id })}>拒绝</Button>
                              </>
                            )}
                            {inst.status !== 'cancelled' && (inst.user_id === user?.id || canManage) && (
                              <Button size="small" type="link" danger onClick={() => handleCancel(inst.id)}>撤销</Button>
                            )}
                            {inst.status === 'cancelled' && (inst.user_id === user?.id || canManage) && (
                              <Button size="small" type="link" danger onClick={() => handleDeleteReservation(inst.id)}>删除</Button>
                            )}
                          </Space>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            },
            rowExpandable: (record: GroupedReservation) => record.isGroup && record.instances.length > 1,
            showExpandColumn: true,
          }
        }
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
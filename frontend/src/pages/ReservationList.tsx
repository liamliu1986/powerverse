import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, DatePicker, message } from 'antd'
import { useAuthStore } from '../stores/authStore'
import api from '../services/api'
import dayjs from 'dayjs'

interface Reservation {
  id: number
  gpu_id: number
  start_time: string
  end_time: string
  purpose: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  user_id: number
}

export default function ReservationList() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()
  const user = useAuthStore((state) => state.user)

  const fetchReservations = () => {
    api.get('/v1/reservations').then((res) => setReservations(res.data))
  }

  useEffect(() => {
    fetchReservations()
  }, [])

  const handleCreate = async (values: { gpu_id: number; start_time: dayjs.Dayjs; end_time: dayjs.Dayjs; purpose: string }) => {
    await api.post('/v1/reservations', {
      ...values,
      start_time: values.start_time.toISOString(),
      end_time: values.end_time.toISOString(),
    })
    message.success('预约申请已提交')
    setIsModalOpen(false)
    form.resetFields()
    fetchReservations()
  }

  const handleApprove = async (id: number) => {
    await api.post(`/v1/reservations/${id}/approve`)
    message.success('已批准')
    fetchReservations()
  }

  const handleReject = async (id: number) => {
    await api.post(`/v1/reservations/${id}/reject`, { approved: false, reason: '' })
    message.success('已拒绝')
    fetchReservations()
  }

  const statusColor: Record<string, string> = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red',
    cancelled: 'gray'
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'GPU ID', dataIndex: 'gpu_id', key: 'gpu_id' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '用途', dataIndex: 'purpose', key: 'purpose' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Reservation) =>
        record.status === 'pending' && (user?.role === 'admin' || user?.role === 'operator') ? (
          <>
            <Button onClick={() => handleApprove(record.id)} type="link">批准</Button>
            <Button onClick={() => handleReject(record.id)} type="link" danger>拒绝</Button>
          </>
        ) : null
    }
  ]

  return (
    <div>
      <h1>预约管理</h1>
      <Button type="primary" onClick={() => setIsModalOpen(true)} style={{ marginTop: 16 }}>
        新建预约
      </Button>
      <Table columns={columns} dataSource={reservations} rowKey="id" style={{ marginTop: 16 }} />

      <Modal title="新建预约" open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null}>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="gpu_id" label="GPU ID" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
            <DatePicker showTime />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间" rules={[{ required: true }]}>
            <DatePicker showTime />
          </Form.Item>
          <Form.Item name="purpose" label="用途">
            <Input.TextArea />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>提交</Button>
        </Form>
      </Modal>
    </div>
  )
}
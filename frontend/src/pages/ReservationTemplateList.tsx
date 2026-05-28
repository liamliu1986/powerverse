import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, DatePicker, Space, message, Popconfirm, Tag, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '../stores/authStore'
import { reservationTemplateApi, ReservationTemplate, ReservationTemplateCreate, ReservationInstancePreview } from '../services/reservationTemplateApi'
import { gpuApi } from '../services/gpuApi'

const { RangePicker } = DatePicker

export default function ReservationTemplateList() {
  const [templates, setTemplates] = useState<ReservationTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ReservationTemplate | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewData, setPreviewData] = useState<{ instances: ReservationInstancePreview[]; total_count: number } | null>(null)
  const [gpus, setGpus] = useState<any[]>([])
  const [form] = Form.useForm()
  const user = useAuthStore((state) => state.user)

  const canManage = user?.role === 'admin' || user?.role === 'operator'

  useEffect(() => {
    fetchTemplates()
    fetchGpus()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const data = await reservationTemplateApi.list()
      setTemplates(data)
    } catch {
      message.error('获取模板列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchGpus = async () => {
    try {
      const data = await gpuApi.list()
      setGpus(data)
    } catch {
      // ignore
    }
  }

  const handleCreate = () => {
    setEditingTemplate(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (template: ReservationTemplate) => {
    setEditingTemplate(template)
    form.setFieldsValue({
      gpu_id: template.gpu_id,
      name: template.name,
      purpose: template.purpose,
      recurrence_type: template.recurrence_type,
      start_time: template.start_time,
      end_time: template.end_time,
      start_date: template.start_date ? dayjs(template.start_date) : null,
      end_date: template.end_date ? dayjs(template.end_date) : null,
      specific_dates: template.specific_dates,
    })
    setModalVisible(true)
  }

  const handlePreview = async (template: ReservationTemplate) => {
    try {
      const data = await reservationTemplateApi.preview(template.id)
      setPreviewData(data)
      setPreviewVisible(true)
    } catch {
      message.error('获取预览失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await reservationTemplateApi.delete(id)
      message.success('删除成功')
      fetchTemplates()
    } catch {
      message.error('删除失败')
    }
  }

  const handleApprove = async (id: number) => {
    try {
      await reservationTemplateApi.approve(id)
      message.success('已批准')
      fetchTemplates()
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } } }
      message.error(error.response?.data?.detail || '批准失败')
    }
  }

  const handleReject = async (id: number) => {
    try {
      await reservationTemplateApi.reject(id)
      message.success('已拒绝')
      fetchTemplates()
    } catch {
      message.error('拒绝失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data: ReservationTemplateCreate = {
        gpu_id: values.gpu_id,
        name: values.name,
        purpose: values.purpose,
        recurrence_type: values.recurrence_type,
        start_time: values.start_time,
        end_time: values.end_time,
      }

      if (values.recurrence_type === 'daily' || values.recurrence_type === 'date_range') {
        data.start_date = values.date_range[0].format('YYYY-MM-DD')
        data.end_date = values.date_range[1].format('YYYY-MM-DD')
      } else if (values.recurrence_type === 'specific_dates') {
        data.specific_dates = values.specific_dates.map((d: dayjs.Dayjs) => d.format('YYYY-MM-DD'))
      }

      if (editingTemplate) {
        await reservationTemplateApi.update(editingTemplate.id, data)
        message.success('更新成功')
      } else {
        await reservationTemplateApi.create(data)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchTemplates()
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } } }
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const statusColor: Record<string, string> = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red',
    cancelled: 'default',
  }

  const statusText: Record<string, string> = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝',
    cancelled: '已取消',
  }

  const recurrenceText: Record<string, string> = {
    daily: '每天',
    specific_dates: '指定日期',
    date_range: '日期范围',
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: 'GPU',
      key: 'gpu',
      render: (_: unknown, r: ReservationTemplate) =>
        `${r.server_hostname || 'N/A'}/${r.gpu_name || 'N/A'}-${r.gpu_index ?? 0}`,
    },
    {
      title: '重复类型',
      dataIndex: 'recurrence_type',
      key: 'recurrence_type',
      render: (v: string) => recurrenceText[v] || v,
    },
    {
      title: '时段',
      key: 'time_slot',
      render: (_: unknown, r: ReservationTemplate & { start_date?: string; end_date?: string }) =>
        `${r.start_date || ''} ${r.start_time} - ${r.end_date || ''} ${r.end_time}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{statusText[v]}</Tag>,
    },
    {
      title: '实例',
      key: 'instances',
      render: (_: unknown, r: ReservationTemplate) =>
        r.instance_count ? `${r.instance_count} 个` : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: ReservationTemplate) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handlePreview(record)} />
          {record.status === 'pending' && (
            <>
              {canManage && (
                <>
                  <Button icon={<CheckOutlined />} size="small" type="primary" onClick={() => handleApprove(record.id)} />
                  <Button icon={<CloseOutlined />} size="small" danger onClick={() => handleReject(record.id)} />
                </>
              )}
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
            </>
          )}
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>预约申请</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          预约申请
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingTemplate ? '编辑模板' : '创建模板'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="gpu_id" label="GPU" rules={[{ required: true, message: '请选择GPU' }]}>
            <Select placeholder="请选择GPU">
              {gpus.map((gpu: any) => (
                <Select.Option key={gpu.id} value={gpu.id}>
                  {gpu.server?.hostname || 'N/A'}/{gpu.model_name || 'N/A'}-{gpu.gpu_index}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="name" label="名称">
            <Input placeholder="如：每日凌晨训练" />
          </Form.Item>

          <Form.Item name="purpose" label="用途">
            <Input.TextArea placeholder="预约用途" rows={2} />
          </Form.Item>

          <Form.Item name="recurrence_type" label="重复类型" rules={[{ required: true }]}>
            <Select placeholder="选择重复类型">
              <Select.Option value="daily">每天固定时段</Select.Option>
              <Select.Option value="specific_dates">指定多个日期</Select.Option>
              <Select.Option value="date_range">日期范围</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.recurrence_type !== curr.recurrence_type}>
            {({ getFieldValue }) => {
              const rt = getFieldValue('recurrence_type')
              return (
                <>
                  <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
                    <Input placeholder="09:30" style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item name="end_time" label="结束时间" rules={[{ required: true }]}>
                    <Input placeholder="18:45 或 24:00" style={{ width: 120 }} />
                  </Form.Item>

                  {rt === 'daily' || rt === 'date_range' ? (
                    <Form.Item name="date_range" label="日期范围" rules={[{ required: true }]}>
                      <RangePicker format="YYYY-MM-DD" />
                    </Form.Item>
                  ) : rt === 'specific_dates' ? (
                    <Form.Item name="specific_dates" label="指定日期" rules={[{ required: true }]}>
                      <DatePicker multiple format="YYYY-MM-DD" style={{ width: '100%' }} />
                    </Form.Item>
                  ) : null}
                </>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={500}
      >
        {previewData && (
          <>
            <Alert message={`共 ${previewData.total_count} 个预约实例`} style={{ marginBottom: 16 }} />
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {previewData.instances.map((inst, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <strong>{inst.date}</strong> {inst.start_time.split(' ')[1]} - {inst.end_time.split(' ')[1]}
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../services/api'

interface Server {
  id: number
  hostname: string
  ip_address: string
  subsidiary?: string
  machine_room?: string
  rack_location?: string
  status: 'online' | 'offline' | 'maintenance'
  created_at: string
}

const { Option } = Select

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchServers()
  }, [])

  const fetchServers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/v1/servers')
      setServers(res.data)
    } catch {
      message.error('获取服务器列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingServer(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (server: Server) => {
    setEditingServer(server)
    form.setFieldsValue(server)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/v1/servers/${id}`)
      message.success('删除成功')
      fetchServers()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingServer) {
        await api.put(`/v1/servers/${editingServer.id}`, values)
        message.success('更新成功')
      } else {
        await api.post('/v1/servers', values)
        message.success('添加成功')
      }
      setModalVisible(false)
      fetchServers()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
    { title: 'IP地址', dataIndex: 'ip_address', key: 'ip_address' },
    { title: '子公司', dataIndex: 'subsidiary', key: 'subsidiary' },
    { title: '机房', dataIndex: 'machine_room', key: 'machine_room' },
    { title: '机架位置', dataIndex: 'rack_location', key: 'rack_location' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = { online: 'green', offline: 'red', maintenance: 'orange' }
        return <span style={{ color: colors[status] }}>{status}</span>
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Server) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>服务器管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加服务器
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={servers}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingServer ? '编辑服务器' : '添加服务器'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="hostname" label="主机名" rules={[{ required: true, message: '请输入主机名' }]}>
            <Input placeholder="e.g. gpu-server-01" />
          </Form.Item>
          <Form.Item name="ip_address" label="IP地址" rules={[{ required: true, message: '请输入IP地址' }]}>
            <Input placeholder="e.g. 192.168.1.100" />
          </Form.Item>
          <Form.Item name="subsidiary" label="子公司">
            <Input placeholder="e.g. 子公司A" />
          </Form.Item>
          <Form.Item name="machine_room" label="机房">
            <Input placeholder="e.g. 机房1" />
          </Form.Item>
          <Form.Item name="rack_location" label="机架位置">
            <Input placeholder="e.g. A-01" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="online">
            <Select>
              <Option value="online">在线</Option>
              <Option value="offline">离线</Option>
              <Option value="maintenance">维护中</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

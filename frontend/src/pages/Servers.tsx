import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tag, Drawer, Divider } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ExpandOutlined } from '@ant-design/icons'
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

interface GPU {
  id: number
  gpu_index: number
  model_name?: string
  memory_total_mb?: number
}

interface ServerFilter {
  subsidiary?: string
  machine_room?: string
  status?: string
}

const { Option } = Select

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [serverGpus, setServerGpus] = useState<GPU[]>([])
  const [filters, setFilters] = useState<ServerFilter>({})
  const [form] = Form.useForm()

  useEffect(() => {
    fetchServers()
  }, [filters])

  const fetchServers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.subsidiary) params.append('subsidiary', filters.subsidiary)
      if (filters.machine_room) params.append('machine_room', filters.machine_room)
      if (filters.status) params.append('status', filters.status)

      const url = params.toString() ? `/v1/servers?${params.toString()}` : '/v1/servers'
      const res = await api.get<Server[]>(url)
      setServers(res.data)
    } catch {
      message.error('获取服务器列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: keyof ServerFilter, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleViewGpus = async (server: Server) => {
    setSelectedServer(server)
    setDetailVisible(true)
    try {
      const res = await api.get<GPU[]>(`/v1/servers/${server.id}/gpus`)
      setServerGpus(res.data)
    } catch {
      setServerGpus([])
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

  const statusColor: Record<string, string> = {
    online: 'green',
    offline: 'red',
    maintenance: 'orange',
  }

  const statusText: Record<string, string> = {
    online: '在线',
    offline: '离线',
    maintenance: '维护中',
  }

  const expandedRowRender = (server: Server) => {
    return (
      <div style={{ padding: '8px 0' }}>
        <Space style={{ marginBottom: 8 }}>
          <Button size="small" icon={<ExpandOutlined />} onClick={() => handleViewGpus(server)}>
            查看GPU列表
          </Button>
        </Space>
        {serverGpus.length > 0 && selectedServer?.id === server.id ? (
          <Table
            size="small"
            dataSource={serverGpus}
            rowKey="id"
            pagination={false}
            columns={[
              { title: 'GPU ID', dataIndex: 'id', key: 'id', width: 80 },
              { title: 'GPU索引', dataIndex: 'gpu_index', key: 'gpu_index', width: 80 },
              { title: '型号', dataIndex: 'model_name', key: 'model_name' },
              {
                title: '显存',
                dataIndex: 'memory_total_mb',
                key: 'memory_total_mb',
                render: (v: number) => v ? `${(v / 1024).toFixed(0)} GB` : 'N/A',
              },
            ]}
          />
        ) : null}
      </div>
    )
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
      render: (status: string) => (
        <Tag color={statusColor[status]}>{statusText[status] || status}</Tag>
      ),
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
      ),
    },
  ]

  const subsidiaries = [...new Set(servers.map((s) => s.subsidiary).filter(Boolean))] as string[]
  const machineRooms = [...new Set(servers.map((s) => s.machine_room).filter(Boolean))] as string[]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>服务器管理</h1>
        <Space>
          <Select
            placeholder="子公司"
            allowClear
            style={{ width: 120 }}
            onChange={(v) => handleFilterChange('subsidiary', v || undefined)}
            value={filters.subsidiary}
          >
            {subsidiaries.map((s) => (
              <Option key={s} value={s}>{s}</Option>
            ))}
          </Select>
          <Select
            placeholder="机房"
            allowClear
            style={{ width: 120 }}
            onChange={(v) => handleFilterChange('machine_room', v || undefined)}
            value={filters.machine_room}
          >
            {machineRooms.map((m) => (
              <Option key={m} value={m}>{m}</Option>
            ))}
          </Select>
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 100 }}
            onChange={(v) => handleFilterChange('status', v || undefined)}
            value={filters.status}
          >
            <Option value="online">在线</Option>
            <Option value="offline">离线</Option>
            <Option value="maintenance">维护中</Option>
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加服务器
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={servers}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender,
          rowExpandable: () => true,
        }}
      />

      {/* 服务器详情Drawer */}
      <Drawer
        title={`服务器详情 - ${selectedServer?.hostname}`}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false)
          setSelectedServer(null)
          setServerGpus([])
        }}
        width={500}
      >
        {selectedServer && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h3>基本信息</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                <div>主机名: <strong>{selectedServer.hostname}</strong></div>
                <div>IP地址: <strong>{selectedServer.ip_address}</strong></div>
                <div>子公司: <strong>{selectedServer.subsidiary || 'N/A'}</strong></div>
                <div>机房: <strong>{selectedServer.machine_room || 'N/A'}</strong></div>
                <div>机架位置: <strong>{selectedServer.rack_location || 'N/A'}</strong></div>
                <div>状态: <Tag color={statusColor[selectedServer.status]}>{statusText[selectedServer.status]}</Tag></div>
                <div>创建时间: <strong>{selectedServer.created_at.split('T')[0]}</strong></div>
              </div>
            </div>
            <Divider />
            <div>
              <h3>GPU列表 ({serverGpus.length})</h3>
              {serverGpus.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无GPU</div>
              ) : (
                <Table
                  size="small"
                  dataSource={serverGpus}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: 'GPU索引', dataIndex: 'gpu_index', key: 'gpu_index', width: 80 },
                    { title: '型号', dataIndex: 'model_name', key: 'model_name' },
                    {
                      title: '显存',
                      dataIndex: 'memory_total_mb',
                      key: 'memory_total_mb',
                      render: (v: number) => v ? `${(v / 1024).toFixed(0)} GB` : 'N/A',
                    },
                  ]}
                />
              )}
            </div>
          </>
        )}
      </Drawer>

      {/* 添加/编辑服务器Modal */}
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
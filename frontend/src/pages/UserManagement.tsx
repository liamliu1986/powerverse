import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { userApi, User, UserCreate, UserUpdate, UserRole } from '../services/userApi'

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await userApi.list()
      setUsers(data)
    } catch {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      role: user.role,
      subsidiary: user.subsidiary,
      password: '',
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await userApi.delete(id)
      message.success('删除成功')
      fetchUsers()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data: UserCreate | UserUpdate = {
        username: values.username,
        email: values.email,
        role: values.role,
        subsidiary: values.subsidiary,
      }
      if (values.password) {
        (data as UserCreate).password = values.password
      }

      if (editingUser) {
        await userApi.update(editingUser.id, data as UserUpdate)
        message.success('更新成功')
      } else {
        await userApi.create(data as UserCreate)
        message.success('创建成功')
      }
      setModalVisible(false)
      fetchUsers()
    } catch {
      message.error('操作失败')
    }
  }

  const handleRoleChange = async (userId: number, role: UserRole) => {
    try {
      await userApi.updateRole(userId, role)
      message.success('角色更新成功')
      fetchUsers()
    } catch {
      message.error('角色更新失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole, record: User) => (
        <Select
          value={role}
          onChange={(newRole) => handleRoleChange(record.id, newRole)}
          style={{ width: 120 }}
        >
          <Select.Option value="admin">超级管理员</Select.Option>
          <Select.Option value="operator">运维人员</Select.Option>
          <Select.Option value="user">普通用户</Select.Option>
        </Select>
      ),
    },
    { title: '子公司', dataIndex: 'subsidiary', key: 'subsidiary' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: User) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm title="确认删除该用户?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>用户管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加用户
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效邮箱' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: !editingUser, message: '请输入密码' }]}
          >
            <Input.Password
              placeholder={editingUser ? '留空则不修改密码' : '请输入密码'}
            />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="请选择角色">
              <Select.Option value="admin">超级管理员</Select.Option>
              <Select.Option value="operator">运维人员</Select.Option>
              <Select.Option value="user">普通用户</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="subsidiary" label="子公司">
            <Input placeholder="请输入子公司" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, message, Tabs, Badge } from 'antd'
import { CheckOutlined, CloseOutlined, BellOutlined } from '@ant-design/icons'
import api from '../services/api'
import dayjs from 'dayjs'

interface Message {
  id: number
  user_id: number
  type: 'approval_rejected' | 'approval_passed' | 'system'
  title: string
  content: string
  is_read: boolean
  created_at: string
}

export default function Notifications() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const fetchMessages = async () => {
    setLoading(true)
    try {
      const res = await api.get<Message[]>('/v1/messages')
      setMessages(res.data)
    } catch {
      message.error('获取消息列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [])

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.put(`/v1/messages/${id}/read`)
      message.success('已标记为已读')
      fetchMessages()
    } catch {
      message.error('操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/v1/messages/${id}`)
      message.success('已删除')
      fetchMessages()
    } catch {
      message.error('删除失败')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/v1/messages/read-all')
      message.success('已全部标记为已读')
      fetchMessages()
    } catch {
      message.error('操作失败')
    }
  }

  const getTypeTag = (type: string) => {
    switch (type) {
      case 'approval_passed':
        return <Tag color="green" icon={<CheckOutlined />}>已批准</Tag>
      case 'approval_rejected':
        return <Tag color="red" icon={<CloseOutlined />}>已拒绝</Tag>
      case 'system':
        return <Tag color="blue" icon={<BellOutlined />}>系统通知</Tag>
      default:
        return <Tag>{type}</Tag>
    }
  }

  const unreadCount = messages.filter((m) => !m.is_read).length

  const filteredMessages = activeTab === 'unread'
    ? messages.filter((m) => !m.is_read)
    : messages

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Message) => (
        <span style={{ fontWeight: record.is_read ? 'normal' : 'bold' }}>{title}</span>
      ),
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '状态',
      dataIndex: 'is_read',
      key: 'is_read',
      width: 80,
      render: (isRead: boolean) =>
        isRead ? <Tag>已读</Tag> : <Tag color="blue">未读</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Message) => (
        <Space>
          {!record.is_read && (
            <Button size="small" onClick={() => handleMarkAsRead(record.id)}>
              标记已读
            </Button>
          )}
          <Button size="small" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>消息通知</h1>
        <Space>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead}>全部标为已读</Button>
          )}
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'all',
            label: (
              <span>
                全部 <Badge count={messages.length} style={{ marginLeft: 8 }} />
              </span>
            ),
          },
          {
            key: 'unread',
            label: (
              <span>
                未读 <Badge count={unreadCount} style={{ marginLeft: 8 }} />
              </span>
            ),
          },
        ]}
      />

      <Table
        columns={columns}
        dataSource={filteredMessages}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: activeTab === 'unread' ? '暂无未读消息' : '暂无消息',
        }}
      />
    </div>
  )
}
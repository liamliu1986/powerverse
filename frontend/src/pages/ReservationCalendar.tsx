import { useEffect, useState } from 'react'
import { Calendar, Tag, Modal, Descriptions, Spin } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { reservationApi, ReservationCalendar } from '../services/reservationApi'

const statusColors: Record<string, string> = {
  pending: 'blue',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray',
}

const statusText: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
}

export default function ReservationCalendarPage() {
  const [data, setData] = useState<ReservationCalendar[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ReservationCalendar | null>(null)
  const [currentMonth, setCurrentMonth] = useState(dayjs())

  const fetchCalendar = async (month: Dayjs) => {
    setLoading(true)
    try {
      const start = month.startOf('month').format('YYYY-MM-DD')
      const end = month.endOf('month').format('YYYY-MM-DD')
      const res = await reservationApi.getCalendar(start, end)
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendar(currentMonth)
  }, [currentMonth])

  const getReservationsForDate = (date: Dayjs) => {
    return data.filter(r => {
      const start = dayjs(r.start_time)
      const end = dayjs(r.end_time)
      return date.isSame(start, 'day') || date.isSame(end, 'day') ||
        (date.isAfter(start, 'day') && date.isBefore(end, 'day'))
    })
  }

  const dateCellRender = (date: Dayjs) => {
    const items = getReservationsForDate(date)
    return (
      <div style={{ maxHeight: 120, overflow: 'hidden' }}>
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => setSelected(item)}
            style={{
              fontSize: 11,
              padding: '2px 4px',
              marginBottom: 2,
              background: item.status === 'approved' ? '#f6ffed' : '#f0f5ff',
              borderLeft: `3px solid ${statusColors[item.status] || 'gray'}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.gpu_name} / {item.user_name}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>预约日历</h2>
      <Spin spinning={loading}>
        <Calendar
          value={currentMonth}
          onChange={setCurrentMonth}
          cellRender={dateCellRender}
        />
      </Spin>

      <Modal
        title="预约详情"
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
      >
        {selected && (
          <Descriptions column={1}>
            <Descriptions.Item label="GPU">{selected.gpu_name}</Descriptions.Item>
            <Descriptions.Item label="型号">{selected.model_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="用户">{selected.user_name}</Descriptions.Item>
            <Descriptions.Item label="用途">{selected.purpose || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColors[selected.status]}>{statusText[selected.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {dayjs(selected.start_time).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {dayjs(selected.end_time).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
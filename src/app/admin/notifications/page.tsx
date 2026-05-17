'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Notification, Profile } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'

export default function AdminNotificationsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    user_id: '',
    type: 'system' as string,
    message: '',
  })

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])

  const filteredNotifications = useMemo(() => {
    if (selectedUser === 'all') return notifications
    return notifications.filter(n => n.user_id === selectedUser)
  }, [notifications, selectedUser])

  const notificationStats = useMemo(() => {
    const total = notifications.length
    const unread = notifications.filter(n => !n.is_read).length
    const byType = notifications.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return { total, unread, byType }
  }, [notifications])

  const fetchData = useCallback(async () => {
    const [notifRes, profilesRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('*'),
    ])

    setNotifications((notifRes.data || []) as Notification[])
    setProfiles((profilesRes.data || []) as Profile[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateNotification = async () => {
    if (!formData.message.trim()) return

    setSaving(true)
    try {
      if (formData.user_id === 'all') {
        const allEmployees = profiles.filter(p => p.role === 'employee')
        for (const emp of allEmployees) {
          await supabase.from('notifications').insert({
            user_id: emp.id,
            type: formData.type,
            payload: { message: formData.message },
          })
        }
      } else {
        await supabase.from('notifications').insert({
          user_id: formData.user_id,
          type: formData.type,
          payload: { message: formData.message },
        })
      }

      setShowModal(false)
      setFormData({ user_id: '', type: 'system', message: '' })
      await fetchData()
      alert('Notification sent!')
    } catch (err) {
      alert('Failed to send notification')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const handleMarkAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    setNotifications(notifications.map(n => ({ ...n, is_read: true })))
  }

  const getUserName = (userId: string) => {
    const user = profileMap.get(userId)
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown'
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      goal_submitted: 'bg-yellow-600',
      goal_approved: 'bg-green-600',
      goal_rejected: 'bg-red-600',
      checkin_reminder: 'bg-blue-600',
      escalation: 'bg-orange-600',
      system: 'bg-slate-600',
    }
    return colors[type] || 'bg-slate-600'
  }

  if (loading) {
    return (
      <RoleLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingBar />
        </div>
      </RoleLayout>
    )
  }

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-slate-400 mt-1">Manage and send notifications to users</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Send Notification
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Total</p>
            <p className="text-3xl font-bold text-white mt-2">{notificationStats.total}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Unread</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{notificationStats.unread}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Employees</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">
              {profiles.filter(p => p.role === 'employee').length}
            </p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Managers</p>
            <p className="text-3xl font-bold text-purple-400 mt-2">
              {profiles.filter(p => p.role === 'manager').length}
            </p>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
          >
            <option value="all">All Users</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name} ({p.role})
              </option>
            ))}
          </select>

          {notificationStats.unread > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 text-blue-400 hover:text-blue-300"
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="bg-[#0d1a36] border border-white/10 rounded-xl overflow-hidden">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400">No notifications found.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredNotifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 flex items-start gap-4 ${!notif.is_read ? 'bg-blue-500/5' : ''}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor(notif.type)} text-white`}>
                        {notif.type}
                      </span>
                      {!notif.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-white">{notif.payload.message as string}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                      <span>To: {getUserName(notif.user_id)}</span>
                      <span>•</span>
                      <span>{new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="px-3 py-1 text-sm text-slate-400 hover:text-white"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Send Notification</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Recipient</label>
                  <select
                    value={formData.user_id}
                    onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                  >
                    <option value="">All Employees</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                  >
                    <option value="system">System</option>
                    <option value="goal_submitted">Goal Submitted</option>
                    <option value="goal_approved">Goal Approved</option>
                    <option value="goal_rejected">Goal Rejected</option>
                    <option value="checkin_reminder">Check-in Reminder</option>
                    <option value="escalation">Escalation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    placeholder="Enter notification message..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNotification}
                  disabled={saving || !formData.message.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleLayout>
  )
}
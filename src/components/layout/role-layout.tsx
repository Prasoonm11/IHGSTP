'use client'

import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'

const roleNavItems = {
  employee: [
    { href: '/employee/goals', label: 'My Goals' },
    { href: '/employee/checkins', label: 'Quarterly Check-ins' },
    { href: '/employee/progress', label: 'Progress Dashboard' },
  ],
  manager: [
    { href: '/manager/team', label: 'Team Dashboard' },
    { href: '/manager/approvals', label: 'Approvals' },
    { href: '/manager/checkins', label: 'Check-ins & Feedback' },
    { href: '/manager/reports', label: 'Team Reports' },
  ],
  admin: [
    { href: '/admin/users', label: 'User Management' },
    { href: '/admin/cycles', label: 'Goal Cycles' },
    { href: '/admin/shared-goals', label: 'Shared KPIs' },
    { href: '/admin/audit', label: 'Audit Trail' },
    { href: '/admin/reports', label: 'Analytics' },
    { href: '/admin/notifications', label: 'Notifications' },
    { href: '/admin/escalations', label: 'Escalations' },
  ],
}

export default function RoleLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    if (!loading && !profile) {
      router.replace('/login')
    }
  }, [loading, profile, router])

  useEffect(() => {
    if (profile) {
      loadNotifications()
    }
  }, [profile])

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile?.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setNotifications(data as Notification[])
  }

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(notifications.filter(n => n.id !== id))
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#081225] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const navItems = roleNavItems[profile.role] || []

  return (
    <div className="min-h-screen bg-[#081225] flex">
      <aside className="w-64 border-r border-white/10 bg-[#0d1a36] p-4 flex flex-col">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white px-4 py-2">
            Goal Setting
          </h1>
          <p className="text-xs text-slate-400 px-4 mt-1 capitalize">
            {profile.role} Portal
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 pt-4 mt-4">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
              {profile.first_name[0]}{profile.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">
                {profile.first_name} {profile.last_name}
              </p>
              <p className="text-xs text-slate-400 truncate">{profile.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-white/10 bg-[#0d1a36] px-6 flex items-center justify-between">
          <div className="text-sm text-slate-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-[#0d1a36] border border-white/10 rounded-lg shadow-xl z-50">
                  <div className="p-3 border-b border-white/10">
                    <h3 className="text-sm font-medium text-white">Notifications</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-sm text-slate-400">No new notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer"
                          onClick={() => markAsRead(n.id)}
                        >
                          <p className="text-sm text-white">{n.payload.message as string || n.type}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={signOut}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
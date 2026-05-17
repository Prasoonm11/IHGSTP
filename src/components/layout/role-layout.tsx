'use client'

import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'
import Image from 'next/image'

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

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile?.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setNotifications(data as Notification[])
  }, [profile?.id, supabase])

  useEffect(() => {
    if (profile) {
      loadNotifications()
    }
  }, [profile, loadNotifications])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(notifications.filter(n => n.id !== id))
  }

  const navItems = roleNavItems[profile?.role as keyof typeof roleNavItems] || []

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingBar className="w-56" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #1a0033 0%, #2d1b4e 50%, #1a0033 100%)' }}>
      {/* Navbar */}
      <nav className="h-16 border-b border-white/10 bg-black/30 backdrop-blur-lg px-6 flex items-center justify-between sticky top-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Image
              src="/favicon.ico"
              alt="AlignHQ Logo"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-lg font-bold text-white">AlignHQ</span>
          </div>

        </div>

        {/* Right Side Icons */}
        <div className="flex items-center gap-4">
          <div className="text-white/60 text-sm">
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-black/60 border border-white/10 rounded-lg shadow-xl z-50 backdrop-blur-md">
                <div className="p-3 border-b border-white/10">
                  <h3 className="text-sm font-medium text-white">Notifications</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-violet-300/60">No new notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer"
                        onClick={() => markAsRead(n.id)}
                      >
                        <p className="text-sm text-white">{n.payload.message as string || n.type}</p>
                        <p className="text-xs text-violet-300/60 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar */}
          <div className="w-9 h-9 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-medium cursor-pointer hover:shadow-lg transition-all">
            {profile.first_name[0]}{profile.last_name[0]}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex flex-1">
        {/* Sidebar - Fixed */}
        <aside className="w-64 fixed h-[calc(100vh-64px)] top-16 border-r border-white/10 bg-black/20 flex flex-col overflow-hidden">
          {/* Menu */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <div className="text-xs uppercase tracking-wider text-white/40 px-4 py-3 font-semibold">Menu</div>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  pathname === item.href
                    ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Logout */}
          <div className="border-t border-white/10 p-4">
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content - Offset for fixed sidebar */}
        <main className="flex-1 ml-64 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
'use client'

import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'
import Image from 'next/image'

const AVATAR_BUCKET = process.env.NEXT_PUBLIC_PROFILE_AVATAR_BUCKET || 'profile-pictures'

function getAvatarStoragePath(userId: string) {
  return `avatars/${userId}/avatar`
}

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
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showProfileDetails, setShowProfileDetails] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [departmentName, setDepartmentName] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  useEffect(() => {
    if (!profile) return

    const storedAvatar = window.localStorage.getItem(`profile-avatar:${profile.id}`)
    if (storedAvatar) {
      setAvatarUrl(storedAvatar)
      return
    }

    const { data } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(getAvatarStoragePath(profile.id))

    setAvatarUrl(data.publicUrl)
  }, [profile])

  useEffect(() => {
    if (!profile?.department_id) {
      setDepartmentName('')
      return
    }

    const loadDepartment = async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('name')
        .eq('id', profile.department_id)
        .single()

      if (!error && data) {
        setDepartmentName(data.name)
      }
    }

    void loadDepartment()
  }, [profile?.department_id, supabase])

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
        setShowProfileDetails(false)
      }
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfileMenu(false)
        setShowProfileDetails(false)
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onEscape)

    return () => {
      document.removeEventListener('mousedown', onDocumentClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(notifications.filter(n => n.id !== id))
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profile) return

    if (!file.type.startsWith('image/')) {
      setProfileMessage('Please choose an image file.')
      return
    }

    setSavingAvatar(true)
    setProfileMessage('')

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token

    if (!accessToken) {
      setProfileMessage('Please sign in again and try.')
      setSavingAvatar(false)
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })

    const result = await response.json().catch(() => null)

    if (!response.ok) {
      setProfileMessage(result?.error || 'Unable to save profile photo.')
      setSavingAvatar(false)
      return
    }

    const publicUrl = `${result.publicUrl}?v=${Date.now()}`
    window.localStorage.setItem(`profile-avatar:${profile.id}`, publicUrl)
    setAvatarUrl(publicUrl)
    setProfileMessage('Profile photo saved to Supabase Storage.')
    setSavingAvatar(false)
  }

  const handleResetPassword = async () => {
    if (!profile) return
    setResettingPassword(true)
    setProfileMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setProfileMessage(error.message)
    } else {
      setProfileMessage('Password reset link sent to your email.')
    }

    setResettingPassword(false)
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
      <nav className="h-16 border-b border-white/10 bg-black/30 backdrop-blur-lg px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-4 sm:gap-8">
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
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
          <div className="hidden sm:block text-white/60 text-sm">
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
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-black/60 border border-white/10 rounded-lg shadow-xl z-50 backdrop-blur-md">
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
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu)
                setShowNotifications(false)
              }}
              className="w-9 h-9 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-medium cursor-pointer hover:shadow-lg transition-all overflow-hidden"
              aria-label="Profile menu"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile photo" className="h-full w-full object-cover" />
              ) : (
                <>
                  {profile.first_name[0]}{profile.last_name[0]}
                </>
              )}
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-black/75 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-semibold overflow-hidden shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile photo" className="h-full w-full object-cover" />
                      ) : (
                        <span>{profile.first_name[0]}{profile.last_name[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{profile.first_name} {profile.last_name}</p>
                      <p className="text-xs text-violet-300/60 truncate">{profile.email}</p>
                    </div>
                  </div>
                  {profileMessage && (
                    <p className="mt-3 text-xs text-cyan-300">{profileMessage}</p>
                  )}
                </div>

                <div className="p-2 space-y-1">
                  <button
                    onClick={() => setShowProfileDetails(prev => !prev)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    View details
                  </button>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={savingAvatar}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {savingAvatar ? 'Saving photo...' : 'Add PFP'}
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resettingPassword}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {resettingPassword ? 'Sending reset link...' : 'Reset password'}
                  </button>
                  <button
                    onClick={signOut}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors"
                  >
                    Sign out
                  </button>
                </div>

                {showProfileDetails && (
                  <div className="border-t border-white/10 p-4 text-sm text-white/75 space-y-2">
                    <div className="flex justify-between gap-4">
                      <span className="text-white/45">Role</span>
                      <span className="capitalize">{profile.role}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-white/45">Department</span>
                      <span className="truncate">{departmentName || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-white/45">User ID</span>
                      <span className="truncate font-mono text-xs">{profile.id.slice(0, 8)}...</span>
                    </div>
                    <p className="text-xs text-white/40 pt-1">Profile photo is stored in Supabase Storage.</p>
                  </div>
                )}
              </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex flex-1">
        {mobileMenuOpen && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden fixed inset-0 top-16 z-30 bg-black/50"
            aria-label="Close menu overlay"
          />
        )}

        {/* Sidebar - Fixed */}
        <aside className={`w-64 fixed h-[calc(100vh-64px)] top-16 left-0 z-40 border-r border-white/10 bg-black/20 flex flex-col overflow-hidden transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Menu */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <div className="text-xs uppercase tracking-wider text-white/40 px-4 py-3 font-semibold">Menu</div>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
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
        <main className="flex-1 md:ml-64 overflow-auto flex flex-col min-w-0">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-auto border-t border-white/10 bg-black/20 px-6 py-4 text-center text-xs text-white/40">
            © 2026 AlignHQ. All rights reserved.
          </footer>
        </main>
      </div>
    </div>
  )
}
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

export default function DashboardPage() {
  const router = useRouter()
  const { profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && profile) {
      switch (profile.role) {
        case 'employee':
          router.replace('/employee/goals')
          break
        case 'manager':
          router.replace('/manager/team')
          break
        case 'admin':
          router.replace('/admin/users')
          break
        default:
          router.replace('/login')
      }
    } else if (!loading && !profile) {
      router.replace('/login')
    }
  }, [profile, loading, router])

  return (
    <div className="min-h-screen bg-[#081225] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-slate-400">Redirecting to your dashboard...</p>
      </div>
    </div>
  )
}
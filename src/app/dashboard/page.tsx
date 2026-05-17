'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { LoadingBar } from '@/components/ui/animations'

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
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <LoadingBar className="w-56" />
        </div>
        <p className="text-violet-300/70">Redirecting to your dashboard...</p>
      </div>
    </div>
  )
}
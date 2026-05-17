'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, GoalUpdate, ThrustArea, ProgressStatus } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'

const currentYear = new Date().getFullYear()
const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const

export default function EmployeeProgressPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const thrustMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t])), [thrustAreas])

  const myGoals = useMemo(() => goals.filter(g => g.employee_id === profile?.id && g.status === 'approved'), [goals, profile])
  const approvedGoals = useMemo(() => {
    if (filterStatus === 'all') return myGoals
    return myGoals.filter(g => {
      const goalUpdates = updates.filter(u => u.goal_id === g.id)
      if (filterStatus === 'completed') return goalUpdates.some(u => u.status === 'completed')
      if (filterStatus === 'on_track') return goalUpdates.some(u => u.status === 'on_track')
      if (filterStatus === 'not_started') return goalUpdates.every(u => u.status === 'not_started' || !u.id)
      return true
    })
  }, [myGoals, filterStatus, updates])

  const overallProgress = useMemo(() => {
    if (myGoals.length === 0) return 0
    const totalWeightage = myGoals.reduce((sum, g) => sum + g.weightage, 0)
    let weightedProgress = 0
    myGoals.forEach(g => {
      const goalUpdates = updates.filter(u => u.goal_id === g.id)
      const avgCompletion = goalUpdates.length > 0
        ? goalUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / goalUpdates.length
        : 0
      weightedProgress += (avgCompletion / 100) * g.weightage
    })
    return totalWeightage > 0 ? Math.round((weightedProgress / totalWeightage) * 100) : 0
  }, [myGoals, updates])

  const statusCounts = useMemo(() => {
    const counts = { not_started: 0, on_track: 0, completed: 0 }
    myGoals.forEach(g => {
      const goalUpdates = updates.filter(u => u.goal_id === g.id)
      const latestUpdate = goalUpdates[goalUpdates.length - 1]
      if (latestUpdate?.status) {
        counts[latestUpdate.status]++
      } else {
        counts.not_started++
      }
    })
    return counts
  }, [myGoals, updates])

  const fetchData = useCallback(async () => {
    if (!profile) return

    const [goalsRes, updatesRes, thrustRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('cycle_year', currentYear)
        .eq('status', 'approved')
        .eq('employee_id', profile.id),
      supabase
        .from('goal_updates')
        .select('*')
        .order('updated_at', { ascending: true }),
      supabase.from('thrust_areas').select('*'),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setUpdates((updatesRes.data || []) as GoalUpdate[])
    setThrustAreas((thrustRes.data || []) as ThrustArea[])
    setLoading(false)
  }, [supabase, profile])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getProgressStatus = (goalId: string): ProgressStatus => {
    const goalUpdates = updates.filter(u => u.goal_id === goalId)
    if (goalUpdates.length === 0) return 'not_started'
    const latest = goalUpdates[goalUpdates.length - 1]
    return latest.status as ProgressStatus
  }

  const getProgressPercent = (goalId: string): number => {
    const goalUpdates = updates.filter(u => u.goal_id === goalId)
    if (goalUpdates.length === 0) return 0
    const latest = goalUpdates[goalUpdates.length - 1]
    return latest.completion_percent
  }

  const getStatusColor = (status: ProgressStatus): string => {
    const colors: Record<ProgressStatus, string> = {
      not_started: 'bg-slate-500',
      on_track: 'bg-amber-500',
      completed: 'bg-emerald-500',
    }
    return colors[status]
  }

  const getStatusLabel = (status: ProgressStatus): string => {
    const labels: Record<ProgressStatus, string> = {
      not_started: 'Not Started',
      on_track: 'On Track',
      completed: 'Completed',
    }
    return labels[status]
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
      <div className="space-y-8 pb-8 px-6">
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Progress Dashboard</h1>
          <p className="text-violet-300/60">Track your goal completion and progress for {currentYear}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Overall Progress Card */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-violet-300/60">Overall Progress</p>
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{overallProgress}%</p>
            <div className="mt-4 h-2 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Total Goals Card */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-violet-300/60">Total Goals</p>
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{myGoals.length}</p>
          </div>

          {/* Completed Card */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-violet-300/60">Completed</p>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-400">{statusCounts.completed}</p>
          </div>

          {/* On Track Card */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-violet-300/60">On Track</p>
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-400">{statusCounts.on_track}</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'all', label: 'All Goals', icon: '📋' },
            { value: 'on_track', label: 'On Track', icon: '🚀' },
            { value: 'completed', label: 'Completed', icon: '✅' },
            { value: 'not_started', label: 'Not Started', icon: '⏳' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                filterStatus === f.value
                  ? 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg'
                  : 'bg-black/40 backdrop-blur-sm border border-white/10 text-violet-300/70 hover:text-violet-100 hover:border-white/20'
              }`}
            >
              <span>{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>

        {/* Empty State or Goals List */}
        {approvedGoals.length === 0 ? (
          <div className="text-center py-16 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-3xl">📭</div>
            </div>
            <p className="text-lg font-semibold text-white/80 mb-2">No approved goals to display</p>
            <p className="text-violet-300/60">Submit your goals for approval to see progress here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvedGoals.map(g => {
              const status = getProgressStatus(g.id)
              const progress = getProgressPercent(g.id)
              const goalUpdates = updates.filter(u => u.goal_id === g.id)
              const thrustArea = thrustMap.get(g.thrust_area_id)
              
              const statusIcon: Record<string, string> = {
                not_started: '⏳',
                on_track: '🚀',
                completed: '✅'
              }

              return (
                <div key={g.id} className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all hover:shadow-lg">
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{statusIcon[status]}</span>
                        <h3 className="text-lg font-semibold text-white">{g.title}</h3>
                      </div>
                      <p className="text-sm text-violet-300/60 mb-2">{thrustArea?.name}</p>
                      {g.description && (
                        <p className="text-sm text-white/60 line-clamp-1">{g.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 text-violet-300 mb-2">
                        {g.weightage}% Weightage
                      </span>
                      <p className="text-sm text-white/60">{getStatusLabel(status)}</p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-white/70">Progress</span>
                      <span className="text-white font-semibold">{progress}%</span>
                    </div>
                    <div className="h-3 bg-black/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Quarterly Updates */}
                  <div className="grid grid-cols-4 gap-3 pt-5 border-t border-white/10">
                    {quarters.map(q => {
                      const update = goalUpdates.find(u => u.quarter === q)
                      const qStatus = update?.status || 'not_started'
                      const qProgress = update?.completion_percent || 0
                      const qIcon: Record<string, string> = {
                        not_started: '⚪',
                        on_track: '🟡',
                        completed: '🟢'
                      }
                      return (
                        <div key={q} className="text-center">
                          <p className="text-xs font-medium text-white/70 mb-2">{q}</p>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg">{qIcon[qStatus]}</span>
                            <p className="text-xs text-white/50">{qProgress}%</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {goalUpdates.length > 0 && goalUpdates[goalUpdates.length - 1]?.comment && (
                    <div className="mt-5 pt-5 border-t border-white/10">
                      <p className="text-xs font-medium text-violet-300/60 mb-2">Latest Update</p>
                      <p className="text-sm text-white/70">{goalUpdates[goalUpdates.length - 1]?.comment}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Goal Distribution Section */}
        {myGoals.length > 0 && (
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>📊</span>
              Goal Distribution by Thrust Area
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {thrustAreas.map(ta => {
                const count = myGoals.filter(g => g.thrust_area_id === ta.id).length
                if (count === 0) return null
                const weightage = myGoals
                  .filter(g => g.thrust_area_id === ta.id)
                  .reduce((sum, g) => sum + g.weightage, 0)
                return (
                  <div key={ta.id} className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-center hover:border-white/20 transition-all">
                    <p className="text-2xl font-bold text-violet-400">{count}</p>
                    <p className="text-sm text-white/70 mt-1">{ta.name}</p>
                    <p className="text-xs text-violet-300/60 mt-2">{weightage}% weightage</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </RoleLayout>
  )
}
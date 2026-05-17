'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, GoalUpdate, ThrustArea, ProgressStatus } from '@/lib/types'

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
      on_track: 'bg-blue-500',
      completed: 'bg-green-500',
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
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </RoleLayout>
    )
  }

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Progress Dashboard</h1>
          <p className="text-slate-400 mt-1">Track your goal completion for {currentYear}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Overall Progress</p>
            <p className="text-3xl font-bold text-white mt-2">{overallProgress}%</p>
            <div className="mt-3 h-2 bg-[#081225] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Total Goals</p>
            <p className="text-3xl font-bold text-white mt-2">{myGoals.length}</p>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Completed</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{statusCounts.completed}</p>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">On Track</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{statusCounts.on_track}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { value: 'all', label: 'All Goals' },
            { value: 'on_track', label: 'On Track' },
            { value: 'completed', label: 'Completed' },
            { value: 'not_started', label: 'Not Started' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0d1a36] text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {approvedGoals.length === 0 ? (
          <div className="text-center py-12 bg-[#0d1a36] border border-white/10 rounded-xl">
            <p className="text-slate-400">No approved goals to display.</p>
            <p className="text-slate-500 text-sm mt-2">Submit your goals for approval to see progress here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvedGoals.map(g => {
              const status = getProgressStatus(g.id)
              const progress = getProgressPercent(g.id)
              const goalUpdates = updates.filter(u => u.goal_id === g.id)
              const thrustArea = thrustMap.get(g.thrust_area_id)

              return (
                <div key={g.id} className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{g.title}</h3>
                        {g.locked && (
                          <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{thrustArea?.name}</p>
                      {g.description && (
                        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{g.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)} text-white`}>
                        {getStatusLabel(status)}
                      </span>
                      <p className="text-sm text-slate-400 mt-2">{g.weightage}% weightage</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-400">Progress</span>
                      <span className="text-white font-medium">{progress}%</span>
                    </div>
                    <div className="h-3 bg-[#081225] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${getStatusColor(status)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-white/10">
                    {quarters.map(q => {
                      const update = goalUpdates.find(u => u.quarter === q)
                      return (
                        <div key={q} className="text-center">
                          <p className="text-xs text-slate-500 mb-1">{q}</p>
                          {update ? (
                            <div>
                              <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${getStatusColor(update.status)}`} />
                              <p className="text-xs text-slate-400">{update.completion_percent}%</p>
                            </div>
                          ) : (
                            <div className="w-3 h-3 rounded-full mx-auto mb-1 bg-slate-700" />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {goalUpdates.length > 0 && goalUpdates[goalUpdates.length - 1]?.comment && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-slate-500 mb-1">Latest comment:</p>
                      <p className="text-sm text-slate-300">{goalUpdates[goalUpdates.length - 1]?.comment}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 bg-[#0d1a36] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Goal Distribution by Thrust Area</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {thrustAreas.map(ta => {
              const count = myGoals.filter(g => g.thrust_area_id === ta.id).length
              if (count === 0) return null
              const weightage = myGoals
                .filter(g => g.thrust_area_id === ta.id)
                .reduce((sum, g) => sum + g.weightage, 0)
              return (
                <div key={ta.id} className="p-4 bg-[#081225] rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-sm text-slate-400">{ta.name}</p>
                  <p className="text-xs text-blue-400 mt-1">{weightage}% weightage</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </RoleLayout>
  )
}
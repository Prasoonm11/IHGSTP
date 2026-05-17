'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, Profile, GoalUpdate } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'

const currentYear = new Date().getFullYear()

interface CycleStats {
  total: number
  draft: number
  submitted: number
  approved: number
  rework: number
  completed: number
}

const statusConfig: Record<string, { label: string; gradient: string; icon: string; glow: string }> = {
  total: { label: 'Total Goals', gradient: 'from-indigo-500 to-purple-600', icon: '🎯', glow: 'shadow-indigo-500/30' },
  draft: { label: 'Draft', gradient: 'from-slate-500 to-slate-600', icon: '📝', glow: 'shadow-slate-500/30' },
  submitted: { label: 'Submitted', gradient: 'from-amber-500 to-orange-600', icon: '📤', glow: 'shadow-amber-500/30' },
  approved: { label: 'Approved', gradient: 'from-emerald-500 to-teal-600', icon: '✅', glow: 'shadow-emerald-500/30' },
  rework: { label: 'Needs Rework', gradient: 'from-rose-500 to-red-600', icon: '🔄', glow: 'shadow-rose-500/30' },
  completed: { label: 'Completed', gradient: 'from-cyan-500 to-blue-600', icon: '🏆', glow: 'shadow-cyan-500/30' },
}

const timelineData = [
  { quarter: 'Q1', months: 'July - September', phase: 'Goal Setting', description: 'Employees set annual goals' },
  { quarter: 'Q2', months: 'October - December', phase: 'Q1 Check-in', description: 'Progress review & updates' },
  { quarter: 'Q3', months: 'January - February', phase: 'Mid-Year Review', description: 'Mid-cycle assessment' },
  { quarter: 'Q4', months: 'March - April', phase: 'Final Review', description: 'Year-end evaluation' },
]

function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTime: number | null = null
    const startValue = 0

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.floor(startValue + (value - startValue) * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return <span>{displayValue}</span>
}

function StatCard({ type, value, delay }: { type: string; value: number; delay: number }) {
  const config = statusConfig[type]
  const isCurrent = type === 'total' || type === 'approved'

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl p-6
        bg-gradient-to-br ${config.gradient}
        shadow-lg ${config.glow}
        transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl
        animate-fade-in-up
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{config.icon}</span>
          <p className="text-white/80 text-sm font-medium">{config.label}</p>
        </div>
        <p className="text-4xl font-bold text-white drop-shadow-lg">
          <AnimatedNumber value={value} />
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </div>
  )
}

function GoalCard({ goal, employeeName, status }: { goal: Goal; employeeName: string; status: string }) {
  const statusColors: Record<string, { bg: string; border: string; glow: string }> = {
    draft: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', glow: 'hover:shadow-slate-500/20' },
    submitted: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', glow: 'hover:shadow-amber-500/20' },
    approved: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', glow: 'hover:shadow-emerald-500/20' },
    rework: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', glow: 'hover:shadow-rose-500/20' },
    completed: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', glow: 'hover:shadow-cyan-500/20' },
  }

  const colors = statusColors[status] || statusColors.draft

  return (
    <div
      className={`
        group p-4 rounded-xl ${colors.bg} ${colors.border} border
        hover:bg-opacity-30 transition-all duration-300
        hover:transform hover:scale-[1.01]
        hover:shadow-lg ${colors.glow}
        cursor-pointer
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium truncate group-hover:text-cyan-300 transition-colors">
            {goal.title}
          </h4>
          <p className="text-white/60 text-sm mt-1 truncate">{employeeName}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-white/50 text-xs">Weightage: {goal.weightage}%</span>
            {goal.locked && (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-400/80">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Locked
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{goal.weightage}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineItem({ item, index, isActiveYear }: { item: typeof timelineData[0]; index: number; isActiveYear: boolean }) {
  const isPast = isActiveYear && index < 1
  const isCurrent = isActiveYear && index === 1
  const isUpcoming = isActiveYear && index > 1

  const statusStyles = {
    past: 'bg-slate-500/50 text-slate-300',
    current: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30',
    upcoming: 'bg-white/10 text-white/60 border border-white/20',
  }

  return (
    <div className="relative flex items-center gap-4 group">
      <div className={`
        relative flex items-center justify-center w-14 h-14 rounded-2xl
        transition-all duration-500 group-hover:scale-110
        ${isCurrent ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30' : 'bg-white/10'}
      `}>
        <div className={`absolute inset-0 rounded-2xl ${isCurrent ? 'bg-gradient-to-br from-emerald-400 to-teal-400 animate-pulse' : ''} opacity-50`} />
        <span className="relative text-white font-bold text-lg">{item.quarter}</span>
        {isCurrent && (
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 opacity-30 animate-ping" />
        )}
      </div>

      <div className="flex-1 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 group-hover:bg-white/10 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-semibold">{item.phase}</h4>
            <p className="text-white/50 text-sm mt-1">{item.months}</p>
            <p className="text-white/40 text-xs mt-1">{item.description}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyles[isCurrent ? 'current' : isPast ? 'past' : 'upcoming']}`}>
            {isActiveYear ? (isCurrent ? 'Active' : isPast ? 'Completed' : 'Upcoming') : 'Past'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function AdminCyclesPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [goalUpdates, setGoalUpdates] = useState<GoalUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [refreshing, setRefreshing] = useState(false)

  const years = [currentYear - 1, currentYear, currentYear + 1]

  const cycleStats = useMemo((): CycleStats => {
    const yearGoals = goals.filter(g => g.cycle_year === selectedYear)
    const completedGoalIds = new Set(
      goalUpdates.filter(u => u.status === 'completed').map(u => u.goal_id)
    )
    const completedCount = yearGoals.filter(g => completedGoalIds.has(g.id)).length
    return {
      total: yearGoals.length,
      draft: yearGoals.filter(g => g.status === 'draft').length,
      submitted: yearGoals.filter(g => g.status === 'submitted').length,
      approved: yearGoals.filter(g => g.status === 'approved').length,
      rework: yearGoals.filter(g => g.status === 'rework').length,
      completed: completedCount,
    }
  }, [goals, goalUpdates, selectedYear])

  const goalsByStatus = useMemo(() => {
    const yearGoals = goals.filter(g => g.cycle_year === selectedYear)
    const completedGoalIds = new Set(
      goalUpdates.filter(u => u.status === 'completed').map(u => u.goal_id)
    )
    return {
      draft: yearGoals.filter(g => g.status === 'draft'),
      submitted: yearGoals.filter(g => g.status === 'submitted'),
      approved: yearGoals.filter(g => g.status === 'approved'),
      rework: yearGoals.filter(g => g.status === 'rework'),
      completed: yearGoals.filter(g => completedGoalIds.has(g.id)),
    }
  }, [goals, goalUpdates, selectedYear])

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    const [goalsRes, profilesRes, updatesRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('goal_updates').select('*'),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setProfiles((profilesRes.data || []) as Profile[])
    setGoalUpdates((updatesRes.data || []) as GoalUpdate[])
    setLoading(false)
    setRefreshing(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUnlockAllGoals = async () => {
    if (!confirm('Are you sure you want to unlock all approved goals for this cycle?')) return
    try {
      const { error } = await supabase
        .from('goals')
        .update({ locked: false })
        .eq('cycle_year', selectedYear)
        .eq('locked', true)

      if (!error) {
        alert('All goals unlocked successfully!')
        fetchData()
      }
    } catch (err) {
      alert('Failed to unlock goals')
    }
  }

  const handleResetCycle = async () => {
    if (!confirm('Are you sure you want to reset all goals to draft for this cycle? This cannot be undone?')) return
    try {
      const { error } = await supabase
        .from('goals')
        .update({ status: 'draft', locked: false } as { status: 'draft'; locked: false })
        .eq('cycle_year', selectedYear)

      if (!error) {
        alert('Cycle reset successfully!')
        fetchData()
      }
    } catch (err) {
      alert('Failed to reset cycle')
    }
  }

  if (loading) {
    return (
      <RoleLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingBar className="w-56" />
        </div>
      </RoleLayout>
    )
  }

  const getEmployeeName = (id: string) => {
    const emp = profileMap.get(id)
    return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'
  }

  const statusOrder: Array<keyof typeof goalsByStatus> = ['draft', 'submitted', 'approved', 'rework', 'completed']

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Goal Cycles</h1>
              <p className="text-white/80 text-lg">Manage and track organizational goal progress</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="appearance-none px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white font-semibold cursor-pointer hover:bg-white/30 transition-all pr-12"
                >
                  {years.map(y => (
                    <option key={y} value={y} className="bg-slate-800">{y}</option>
                  ))}
                </select>
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <button
                onClick={fetchData}
                disabled={refreshing}
                className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all hover:rotate-180 duration-500 disabled:opacity-50"
              >
                <svg className={`w-6 h-6 text-white ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(cycleStats).map(([type, value], index) => (
            <StatCard key={type} type={type} value={value} delay={index * 100} />
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Goals by Status */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
              Goals by Status
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {statusOrder.map(status => {
                const statusGoals = goalsByStatus[status]
                const config = statusConfig[status]
                return (
                  <div key={status} className="group">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                        <span className="text-lg">{config.icon}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold capitalize">{config.label}</h3>
                        <p className="text-white/50 text-sm">{statusGoals.length} goals</p>
                      </div>
                      <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${config.gradient} rounded-full transition-all duration-1000`}
                          style={{ width: `${cycleStats.total > 0 ? (statusGoals.length / cycleStats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                      {statusGoals.length === 0 ? (
                        <p className="text-white/30 text-sm italic py-4 text-center">No goals in this category</p>
                      ) : (
                        statusGoals.slice(0, 8).map(goal => (
                          <GoalCard
                            key={goal.id}
                            goal={goal}
                            employeeName={getEmployeeName(goal.employee_id)}
                            status={status}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <span className="w-1 h-8 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full" />
              Cycle Timeline
            </h2>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="space-y-3">
                {timelineData.map((item, index) => (
                  <TimelineItem
                    key={item.quarter}
                    item={item}
                    index={index}
                    isActiveYear={selectedYear === currentYear}
                  />
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleUnlockAllGoals}
                className="group relative overflow-hidden p-4 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold">Unlock Goals</p>
                    <p className="text-white/70 text-xs">Enable editing</p>
                  </div>
                </div>
              </button>

              <button
                onClick={handleResetCycle}
                className="group relative overflow-hidden p-4 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold">Reset Cycle</p>
                    <p className="text-white/70 text-xs">Clear all statuses</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-900/80 p-6 border border-white/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <h3 className="text-lg font-semibold text-white mb-4">Progress Overview - {selectedYear}</h3>
            <div className="flex items-center gap-6">
              <div className="flex-1 space-y-3">
                {Object.entries(cycleStats).filter(([k]) => k !== 'total').map(([key, value]) => {
                  const percentage = cycleStats.total > 0 ? Math.round((value / cycleStats.total) * 100) : 0
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-white/60 text-sm w-24 capitalize">{statusConfig[key]?.label}</span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${statusConfig[key]?.gradient}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-white/80 text-sm w-12 text-right">{percentage}%</span>
                    </div>
                  )
                })}
              </div>
              <div className="w-40 h-40 relative">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="white/10" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(cycleStats.approved / (cycleStats.total || 1)) * 251.2} 251.2`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">{cycleStats.total > 0 ? Math.round((cycleStats.approved / cycleStats.total) * 100) : 0}%</span>
                  <span className="text-white/50 text-xs">Approved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out forwards;
          opacity: 0;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </RoleLayout>
  )
}
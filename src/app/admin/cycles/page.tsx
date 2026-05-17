'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, Profile } from '@/lib/types'

const currentYear = new Date().getFullYear()

interface CycleStats {
  total: number
  draft: number
  submitted: number
  approved: number
  rework: number
}

export default function AdminCyclesPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const years = [currentYear - 1, currentYear, currentYear + 1]

  const cycleStats = useMemo((): CycleStats => {
    const yearGoals = goals.filter(g => g.cycle_year === selectedYear)
    return {
      total: yearGoals.length,
      draft: yearGoals.filter(g => g.status === 'draft').length,
      submitted: yearGoals.filter(g => g.status === 'submitted').length,
      approved: yearGoals.filter(g => g.status === 'approved').length,
      rework: yearGoals.filter(g => g.status === 'rework').length,
    }
  }, [goals, selectedYear])

  const goalsByStatus = useMemo(() => {
    const yearGoals = goals.filter(g => g.cycle_year === selectedYear)
    return {
      draft: yearGoals.filter(g => g.status === 'draft'),
      submitted: yearGoals.filter(g => g.status === 'submitted'),
      approved: yearGoals.filter(g => g.status === 'approved'),
      rework: yearGoals.filter(g => g.status === 'rework'),
    }
  }, [goals, selectedYear])

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])

  const fetchData = useCallback(async () => {
    const [goalsRes, profilesRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setProfiles((profilesRes.data || []) as Profile[])
    setLoading(false)
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
    if (!confirm('Are you sure you want to reset all goals to draft for this cycle? This cannot be undone.')) return

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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </RoleLayout>
    )
  }

  const getEmployeeName = (id: string) => {
    const emp = profileMap.get(id)
    return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'
  }

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Goal Cycles</h1>
            <p className="text-slate-400 mt-1">Manage goal cycles and track overall progress</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
            >
              {years.map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>

            <button
              onClick={handleUnlockAllGoals}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium"
            >
              Unlock All Goals
            </button>

            <button
              onClick={handleResetCycle}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            >
              Reset Cycle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Total Goals</p>
            <p className="text-3xl font-bold text-white mt-2">{cycleStats.total}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Draft</p>
            <p className="text-3xl font-bold text-slate-400 mt-2">{cycleStats.draft}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Submitted</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{cycleStats.submitted}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Approved</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{cycleStats.approved}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Needs Rework</p>
            <p className="text-3xl font-bold text-red-400 mt-2">{cycleStats.rework}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(['draft', 'submitted', 'approved', 'rework'] as const).map(status => {
            const statusGoals = goalsByStatus[status]
            const statusColors: Record<string, string> = {
              draft: 'bg-slate-600',
              submitted: 'bg-yellow-600',
              approved: 'bg-green-600',
              rework: 'bg-red-600',
            }

            return (
              <div key={status} className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white capitalize">
                    {status} ({statusGoals.length})
                  </h2>
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[status]} text-white`}>
                    {status}
                  </span>
                </div>

                {statusGoals.length === 0 ? (
                  <p className="text-slate-400 text-sm">No goals in this status.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {statusGoals.slice(0, 10).map(g => (
                      <div key={g.id} className="p-3 bg-[#081225] rounded-lg">
                        <p className="text-white font-medium text-sm">{g.title}</p>
                        <p className="text-xs text-slate-400">{getEmployeeName(g.employee_id)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{g.weightage}%</span>
                          {g.locked && (
                            <span className="text-xs text-yellow-500 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {statusGoals.length > 10 && (
                      <p className="text-sm text-slate-500 text-center">
                        + {statusGoals.length - 10} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 bg-[#0d1a36] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Cycle Timeline</h3>
          <div className="space-y-4">
            {[
              { quarter: 'Q1', months: 'July - September', phase: 'Active', status: selectedYear === currentYear ? 'Current' : 'Past' },
              { quarter: 'Q2', months: 'October - December', phase: 'Check-in', status: selectedYear === currentYear ? 'Upcoming' : 'Past' },
              { quarter: 'Q3', months: 'January - February', phase: 'Check-in', status: 'Upcoming' },
              { quarter: 'Q4', months: 'March - April', phase: 'Final Review', status: 'Upcoming' },
            ].map(item => (
              <div key={item.quarter} className="flex items-center gap-4 p-3 bg-[#081225] rounded-lg">
                <div className="w-16">
                  <p className="text-white font-medium">{item.quarter}</p>
                  <p className="text-xs text-slate-500">{item.months}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-300">{item.phase}</p>
                </div>
                <div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.status === 'Current' ? 'bg-green-600' :
                    item.status === 'Upcoming' ? 'bg-blue-600' : 'bg-slate-600'
                  } text-white`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleLayout>
  )
}
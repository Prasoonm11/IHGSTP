'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Goal, GoalUpdate, ThrustArea } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'

const currentYear = new Date().getFullYear()
const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const

export default function ManagerReportsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)

  const [reportType, setReportType] = useState<'team_progress' | 'employee_wise'>('team_progress')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')

  const teamMemberIds = useMemo(() => {
    if (!profile) return new Set<string>()
    return new Set(profiles.filter(p => p.manager_id === profile.id).map(p => p.id))
  }, [profiles, profile])

  const teamGoals = useMemo(() => {
    return goals.filter(g => teamMemberIds.has(g.employee_id) && g.cycle_year === currentYear)
  }, [goals, teamMemberIds])

  const teamEmployees = useMemo(() => {
    const empIds = new Set(teamGoals.map(g => g.employee_id))
    return profiles.filter(p => empIds.has(p.id))
  }, [profiles, teamGoals])

  const filteredGoals = useMemo(() => {
    if (selectedEmployee === 'all') return teamGoals
    return teamGoals.filter(g => g.employee_id === selectedEmployee)
  }, [teamGoals, selectedEmployee])

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])
  const thrustMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t])), [thrustAreas])

  const fetchData = useCallback(async () => {
    const [goalsRes, updatesRes, profilesRes, thrustRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('cycle_year', currentYear),
      supabase.from('goal_updates').select('*'),
      supabase.from('profiles').select('*').order('first_name'),
      supabase.from('thrust_areas').select('*'),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setUpdates((updatesRes.data || []) as GoalUpdate[])
    setProfiles((profilesRes.data || []) as Profile[])
    setThrustAreas((thrustRes.data || []) as ThrustArea[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const exportToCSV = () => {
    const headers = reportType === 'team_progress'
      ? ['Employee', 'Goal', 'Thrust Area', 'Weightage', 'Status', 'Q1 Progress', 'Q2 Progress', 'Q3 Progress', 'Q4 Progress', 'Overall Progress']
      : ['Goal', 'Thrust Area', 'Weightage', 'Target', 'Q1 Actual', 'Q1 Status', 'Q2 Actual', 'Q2 Status', 'Q3 Actual', 'Q3 Status', 'Q4 Actual', 'Q4 Status']

    const rows = filteredGoals.map(g => {
      const emp = profileMap.get(g.employee_id)
      const goalUpdates = updates.filter(u => u.goal_id === g.id)

      if (reportType === 'team_progress') {
        const quarterProgress = quarters.map(q => {
          const update = goalUpdates.find(u => u.quarter === q)
          return update ? `${update.completion_percent}%` : '-'
        })
        const overallProgress = goalUpdates.length > 0
          ? Math.round(goalUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / goalUpdates.length)
          : 0

        return [
          `${emp?.first_name} ${emp?.last_name}`,
          g.title,
          thrustMap.get(g.thrust_area_id)?.name || '-',
          `${g.weightage}%`,
          g.status,
          ...quarterProgress,
          `${overallProgress}%`,
        ]
      } else {
        const quarterData = quarters.flatMap(q => {
          const update = goalUpdates.find(u => u.quarter === q)
          return [
            update?.actual_value?.toString() || '-',
            update?.status || '-',
          ]
        })

        return [
          g.title,
          thrustMap.get(g.thrust_area_id)?.name || '-',
          `${g.weightage}%`,
          g.target_value?.toString() || '-',
          ...quarterData,
        ]
      }
    })

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `team_report_${currentYear}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const calculateEmployeeStats = (employeeId: string) => {
    const empGoals = teamGoals.filter(g => g.employee_id === employeeId)
    const goalIds = new Set(empGoals.map(g => g.id))
    const empUpdates = updates.filter(u => goalIds.has(u.goal_id))

    const totalWeightage = empGoals.reduce((sum, g) => sum + g.weightage, 0)
    const approved = empGoals.filter(g => g.status === 'approved').length
    const draft = empGoals.filter(g => g.status === 'draft').length
    const submitted = empGoals.filter(g => g.status === 'submitted').length

    const overallProgress = empUpdates.length > 0
      ? Math.round(empUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / empUpdates.length)
      : 0

    return { totalWeightage, approved, draft, submitted, overallProgress }
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
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Reports</h1>
            <p className="text-slate-400 mt-1">Export and analyze team goal progress</p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:shadow-lg text-white rounded-lg font-medium transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setReportType('team_progress')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                reportType === 'team_progress'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0d1a36] text-slate-400 hover:text-white'
              }`}
            >
              Team Progress
            </button>
            <button
              onClick={() => setReportType('employee_wise')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                reportType === 'employee_wise'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0d1a36] text-slate-400 hover:text-white'
              }`}
            >
              Planned vs Actual
            </button>
          </div>

          <select
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
            className="px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
          >
            <option value="all">All Employees</option>
            {teamEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>

        {reportType === 'team_progress' ? (
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                    <th className="p-4 font-medium">Employee</th>
                    <th className="p-4 font-medium">Goals</th>
                    <th className="p-4 font-medium">Approved</th>
                    <th className="p-4 font-medium">Pending</th>
                    <th className="p-4 font-medium">Draft</th>
                    <th className="p-4 font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {teamEmployees.map(emp => {
                    const stats = calculateEmployeeStats(emp.id)
                    return (
                      <tr key={emp.id} className="border-b border-white/5">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-medium">
                              {emp.first_name[0]}{emp.last_name[0]}
                            </div>
                            <div>
                              <p className="text-white font-medium">
                                {emp.first_name} {emp.last_name}
                              </p>
                              <p className="text-sm text-slate-500">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-white">{stats.totalWeightage}% total weightage</td>
                        <td className="p-4">
                          <span className="text-green-400 font-medium">{stats.approved}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-yellow-400 font-medium">{stats.submitted}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-400 font-medium">{stats.draft}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-[#081225] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  stats.overallProgress >= 75 ? 'bg-green-500' :
                                  stats.overallProgress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${stats.overallProgress}%` }}
                              />
                            </div>
                            <span className="text-white font-medium">{stats.overallProgress}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                    <th className="p-4 font-medium">Goal</th>
                    <th className="p-4 font-medium">Thrust Area</th>
                    <th className="p-4 font-medium">Weightage</th>
                    <th className="p-4 font-medium">Target</th>
                    {quarters.map(q => (
                      <th key={q} className="p-4 font-medium text-center">{q}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGoals.map(g => {
                    const emp = profileMap.get(g.employee_id)
                    const goalUpdates = updates.filter(u => u.goal_id === g.id)

                    return (
                      <tr key={g.id} className="border-b border-white/5">
                        <td className="p-4">
                          <p className="text-white font-medium">{g.title}</p>
                          <p className="text-sm text-slate-500">{emp?.first_name} {emp?.last_name}</p>
                        </td>
                        <td className="p-4 text-slate-300">{thrustMap.get(g.thrust_area_id)?.name}</td>
                        <td className="p-4 text-white">{g.weightage}%</td>
                        <td className="p-4 text-white">{g.target_value ?? '-'}</td>
                        {quarters.map(q => {
                          const update = goalUpdates.find(u => u.quarter === q)
                          return (
                            <td key={q} className="p-4 text-center">
                              {update ? (
                                <div>
                                  <p className="text-white">{update.actual_value ?? '-'}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    update.status === 'completed' ? 'bg-green-600' :
                                    update.status === 'on_track' ? 'bg-violet-600' : 'bg-slate-600'
                                  } text-white`}>
                                    {update.status.replace('_', ' ')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Department Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#081225] rounded-lg text-center">
                <p className="text-3xl font-bold text-white">{teamGoals.length}</p>
                <p className="text-sm text-slate-400">Total Goals</p>
              </div>
              <div className="p-4 bg-[#081225] rounded-lg text-center">
                <p className="text-3xl font-bold text-green-400">
                  {teamGoals.filter(g => g.status === 'approved').length}
                </p>
                <p className="text-sm text-slate-400">Approved</p>
              </div>
              <div className="p-4 bg-[#081225] rounded-lg text-center">
                <p className="text-3xl font-bold text-yellow-400">
                  {teamGoals.filter(g => g.status === 'submitted').length}
                </p>
                <p className="text-sm text-slate-400">Pending</p>
              </div>
              <div className="p-4 bg-[#081225] rounded-lg text-center">
                <p className="text-3xl font-bold text-blue-400">
                  {Math.round(teamGoals.reduce((sum, g) => sum + g.weightage, 0) / (teamGoals.length || 1))}%
                </p>
                <p className="text-sm text-slate-400">Avg Weightage</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Goal Distribution</h3>
            <div className="space-y-3">
              {thrustAreas.map(ta => {
                const count = teamGoals.filter(g => g.thrust_area_id === ta.id).length
                if (count === 0) return null
                const percentage = Math.round((count / teamGoals.length) * 100)
                return (
                  <div key={ta.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-400">{ta.name}</span>
                      <span className="text-sm text-white">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-[#081225] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </RoleLayout>
  )
}
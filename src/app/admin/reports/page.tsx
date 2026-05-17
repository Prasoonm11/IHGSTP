'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, GoalUpdate, Profile, Department, ThrustArea } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'

const currentYear = new Date().getFullYear()
const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const

export default function AdminReportsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedYear, setSelectedYear] = useState(currentYear)

  const yearGoals = useMemo(() => goals.filter(g => g.cycle_year === selectedYear), [goals, selectedYear])
  const goalIds = useMemo(() => new Set(yearGoals.map(g => g.id)), [yearGoals])
  const yearUpdates = useMemo(() => updates.filter(u => goalIds.has(u.goal_id)), [updates, goalIds])

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])
  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments])
  const thrustMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t.name])), [thrustAreas])

  const stats = useMemo(() => {
    const totalGoals = yearGoals.length
    const approved = yearGoals.filter(g => g.status === 'approved').length
    const submitted = yearGoals.filter(g => g.status === 'submitted').length
    const draft = yearGoals.filter(g => g.status === 'draft').length

    const employeesWithGoals = new Set(yearGoals.map(g => g.employee_id)).size
    const totalEmployees = profiles.filter(p => p.role === 'employee').length
    const participationRate = totalEmployees > 0 ? Math.round((employeesWithGoals / totalEmployees) * 100) : 0

    const avgProgress = yearUpdates.length > 0
      ? Math.round(yearUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / yearUpdates.length)
      : 0

    return { totalGoals, approved, submitted, draft, employeesWithGoals, totalEmployees, participationRate, avgProgress }
  }, [yearGoals, yearUpdates, profiles])

  const quarterTrends = useMemo(() => {
    return quarters.map(q => {
      const quarterUpdates = yearUpdates.filter(u => u.quarter === q)
      const avgProgress = quarterUpdates.length > 0
        ? Math.round(quarterUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / quarterUpdates.length)
        : 0
      const completed = quarterUpdates.filter(u => u.status === 'completed').length

      return { quarter: q, avgProgress, completed, total: quarterUpdates.length }
    })
  }, [yearUpdates])

  const departmentStats = useMemo(() => {
    return departments.map(dept => {
      const deptEmployees = profiles.filter(p => p.department_id === dept.id && p.role === 'employee')
      const deptGoals = yearGoals.filter(g => {
        const emp = profileMap.get(g.employee_id)
        return emp?.department_id === dept.id
      })

      const goalIds = new Set(deptGoals.map(g => g.id))
      const deptUpdates = yearUpdates.filter(u => goalIds.has(u.goal_id))
      const avgProgress = deptUpdates.length > 0
        ? Math.round(deptUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / deptUpdates.length)
        : 0

      return {
        department: dept.name,
        employees: deptEmployees.length,
        goals: deptGoals.length,
        avgProgress,
      }
    }).filter(d => d.employees > 0)
  }, [departments, profiles, yearGoals, yearUpdates, profileMap])

  const thrustDistribution = useMemo(() => {
    const dist: Record<string, number> = {}
    yearGoals.forEach(g => {
      const area = thrustMap.get(g.thrust_area_id) || 'Unknown'
      dist[area] = (dist[area] || 0) + 1
    })
    return Object.entries(dist).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / yearGoals.length) * 100) || 0,
    }))
  }, [yearGoals, thrustMap])

  const managerStats = useMemo(() => {
    const managers = profiles.filter(p => p.role === 'manager')
    return managers.map(m => {
      const directReports = profiles.filter(p => p.manager_id === m.id)
      const reportIds = new Set(directReports.map(r => r.id))
      const teamGoals = yearGoals.filter(g => reportIds.has(g.employee_id))
      const teamGoalIds = new Set(teamGoals.map(g => g.id))
      const teamUpdates = yearUpdates.filter(u => teamGoalIds.has(u.goal_id))

      const avgProgress = teamUpdates.length > 0
        ? Math.round(teamUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / teamUpdates.length)
        : 0
      const approvedGoals = teamGoals.filter(g => g.status === 'approved').length
      const approvalRate = teamGoals.length > 0 ? Math.round((approvedGoals / teamGoals.length) * 100) : 0

      return {
        manager: `${m.first_name} ${m.last_name}`,
        teamSize: directReports.length,
        teamGoals: teamGoals.length,
        avgProgress,
        approvalRate,
      }
    }).filter(m => m.teamSize > 0)
  }, [profiles, yearGoals, yearUpdates])

  const fetchData = useCallback(async () => {
    const [goalsRes, updatesRes, profilesRes, deptRes, thrustRes] = await Promise.all([
      supabase.from('goals').select('*'),
      supabase.from('goal_updates').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('departments').select('*'),
      supabase.from('thrust_areas').select('*'),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setUpdates((updatesRes.data || []) as GoalUpdate[])
    setProfiles((profilesRes.data || []) as Profile[])
    setDepartments((deptRes.data || []) as Department[])
    setThrustAreas((thrustRes.data || []) as ThrustArea[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <RoleLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingBar />
        </div>
      </RoleLayout>
    )
  }

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const rows = data.map(row => headers.map(h => String(row[h] ?? '')).join(','))
    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-slate-400 mt-1">Organization-wide goal performance insights</p>
          </div>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>Year {y}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Total Goals</p>
            <p className="text-3xl font-bold text-white mt-2">{stats.totalGoals}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Participation Rate</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{stats.participationRate}%</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Approved Goals</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{stats.approved}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Avg Progress</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.avgProgress}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quarterly Trends</h3>
            <div className="space-y-4">
              {quarterTrends.map(q => (
                <div key={q.quarter}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400">{q.quarter}</span>
                    <span className="text-sm text-white">{q.avgProgress}%</span>
                  </div>
                  <div className="h-4 bg-[#081225] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        q.avgProgress >= 75 ? 'bg-green-500' :
                        q.avgProgress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${q.avgProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{q.completed} of {q.total} completed</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Goal Distribution by Thrust Area</h3>
            <div className="space-y-3">
              {thrustDistribution.map(td => (
                <div key={td.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400">{td.name}</span>
                    <span className="text-sm text-white">{td.count} ({td.percentage}%)</span>
                  </div>
                  <div className="h-3 bg-[#081225] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500"
                      style={{ width: `${td.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Department Performance</h3>
              <button
                onClick={() => exportToCSV(departmentStats as unknown as Record<string, unknown>[], 'department_performance')}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="pb-2 font-medium">Department</th>
                    <th className="pb-2 font-medium text-center">Employees</th>
                    <th className="pb-2 font-medium text-center">Goals</th>
                    <th className="pb-2 font-medium text-center">Avg Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentStats.map(ds => (
                    <tr key={ds.department} className="border-b border-white/5">
                      <td className="py-2 text-white">{ds.department}</td>
                      <td className="py-2 text-center text-slate-300">{ds.employees}</td>
                      <td className="py-2 text-center text-slate-300">{ds.goals}</td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          ds.avgProgress >= 75 ? 'bg-green-600' :
                          ds.avgProgress >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                        } text-white`}>
                          {ds.avgProgress}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Manager Effectiveness</h3>
              <button
                onClick={() => exportToCSV(managerStats as unknown as Record<string, unknown>[], 'manager_effectiveness')}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/10">
                    <th className="pb-2 font-medium">Manager</th>
                    <th className="pb-2 font-medium text-center">Team</th>
                    <th className="pb-2 font-medium text-center">Goals</th>
                    <th className="pb-2 font-medium text-center">Progress</th>
                    <th className="pb-2 font-medium text-center">Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {managerStats.map(ms => (
                    <tr key={ms.manager} className="border-b border-white/5">
                      <td className="py-2 text-white">{ms.manager}</td>
                      <td className="py-2 text-center text-slate-300">{ms.teamSize}</td>
                      <td className="py-2 text-center text-slate-300">{ms.teamGoals}</td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          ms.avgProgress >= 75 ? 'bg-green-600' :
                          ms.avgProgress >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                        } text-white`}>
                          {ms.avgProgress}%
                        </span>
                      </td>
                      <td className="py-2 text-center text-slate-300">{ms.approvalRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Goal Status Overview</h3>
          <div className="flex items-center gap-8">
            {[
              { label: 'Draft', value: stats.draft, color: 'bg-slate-500', total: stats.totalGoals },
              { label: 'Submitted', value: stats.submitted, color: 'bg-yellow-500', total: stats.totalGoals },
              { label: 'Approved', value: stats.approved, color: 'bg-green-500', total: stats.totalGoals },
            ].map(item => (
              <div key={item.label} className="flex-1 text-center">
                <div className="relative w-32 h-32 mx-auto">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="56" stroke="#081225" strokeWidth="12" fill="none" />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(item.value / item.total) * 352} 352`}
                      className={`${item.color} text-[#081225]`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{item.value}</span>
                    <span className="text-xs text-slate-400">{item.label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleLayout>
  )
}
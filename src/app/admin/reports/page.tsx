'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { createClient } from '@/lib/supabase/client'
import type { Department, Goal, GoalUpdate, Profile, ThrustArea, UomType } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'

const currentYear = new Date().getFullYear()
const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const

const uomLabels: Record<UomType, string> = {
  numeric_min: 'Numeric Min',
  numeric_max: 'Numeric Max',
  percent_min: '% Min',
  percent_max: '% Max',
  timeline: 'Timeline',
  zero: 'Zero-based',
}

type HeatmapCell = {
  quarter: string
  completionRate: number
}

function avg(values: number[]) {
  return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
}

function completionClass(value: number) {
  if (value >= 75) return 'bg-green-500/80'
  if (value >= 50) return 'bg-yellow-500/80'
  if (value >= 25) return 'bg-orange-500/80'
  return 'bg-red-500/80'
}

export default function AdminReportsPage() {
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [selectedManagerId, setSelectedManagerId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

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

  const yearGoals = useMemo(() => goals.filter(goal => goal.cycle_year === selectedYear), [goals, selectedYear])
  const yearGoalIds = useMemo(() => new Set(yearGoals.map(goal => goal.id)), [yearGoals])
  const yearUpdates = useMemo(() => updates.filter(update => yearGoalIds.has(update.goal_id)), [updates, yearGoalIds])

  const thrustMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t.name])), [thrustAreas])
  const departmentMap = useMemo(() => new Map(departments.map(d => [d.id, d])), [departments])

  const departmentManagers = useMemo(() => {
    return profiles.filter(profile => {
      const matchesRole = profile.role === 'manager'
      const matchesDepartment = !selectedDepartmentId || profile.department_id === selectedDepartmentId
      return matchesRole && matchesDepartment
    })
  }, [profiles, selectedDepartmentId])

  const scopedEmployees = useMemo(() => {
    return profiles.filter(profile => {
      if (profile.role !== 'employee') return false
      if (selectedDepartmentId && profile.department_id !== selectedDepartmentId) return false
      if (selectedManagerId && profile.manager_id !== selectedManagerId) return false
      return true
    })
  }, [profiles, selectedDepartmentId, selectedManagerId])

  const selectedDepartment = selectedDepartmentId ? departmentMap.get(selectedDepartmentId) || null : null
  const selectedManager = selectedManagerId ? profiles.find(profile => profile.id === selectedManagerId) || null : null
  const selectedEmployee = selectedEmployeeId ? profiles.find(profile => profile.id === selectedEmployeeId) || null : null

  useEffect(() => {
    if (selectedManagerId && !departmentManagers.some(manager => manager.id === selectedManagerId)) {
      setSelectedManagerId('')
      setSelectedEmployeeId('')
    }
  }, [departmentManagers, selectedManagerId])

  useEffect(() => {
    if (selectedEmployeeId && !scopedEmployees.some(employee => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId('')
    }
  }, [scopedEmployees, selectedEmployeeId])

  const stats = useMemo(() => {
    const totalGoals = yearGoals.length
    const approved = yearGoals.filter(goal => goal.status === 'approved').length
    const submitted = yearGoals.filter(goal => goal.status === 'submitted').length
    const draft = yearGoals.filter(goal => goal.status === 'draft').length

    const employees = profiles.filter(p => p.role === 'employee')
    const employeesWithGoals = new Set(yearGoals.map(goal => goal.employee_id)).size
    const orgCoverage = employees.length > 0 ? Math.round((employeesWithGoals / employees.length) * 100) : 0
    const avgProgress = avg(yearUpdates.map(update => update.completion_percent))

    return { totalGoals, approved, submitted, draft, employeesWithGoals, orgCoverage, avgProgress }
  }, [yearGoals, yearUpdates, profiles])

  const qoqScopeGoals = useMemo(() => {
    if (selectedEmployeeId) {
      return yearGoals.filter(goal => goal.employee_id === selectedEmployeeId)
    }
    if (selectedManagerId) {
      const employeeIds = new Set(scopedEmployees.map(employee => employee.id))
      return yearGoals.filter(goal => employeeIds.has(goal.employee_id))
    }
    if (selectedDepartmentId) {
      const employeeIds = new Set(scopedEmployees.map(employee => employee.id))
      return yearGoals.filter(goal => employeeIds.has(goal.employee_id))
    }
    return yearGoals
  }, [scopedEmployees, selectedDepartmentId, selectedEmployeeId, selectedManagerId, yearGoals])

  const qoqScopeUpdates = useMemo(() => {
    const goalIds = new Set(qoqScopeGoals.map(goal => goal.id))
    return yearUpdates.filter(update => goalIds.has(update.goal_id))
  }, [qoqScopeGoals, yearUpdates])

  const qoqScopeLabel = useMemo(() => {
    if (selectedEmployee) return `${selectedEmployee.first_name} ${selectedEmployee.last_name}`
    if (selectedManager) return `${selectedManager.first_name} ${selectedManager.last_name}'s team`
    if (selectedDepartment) return selectedDepartment.name
    return 'All employees'
  }, [selectedDepartment, selectedEmployee, selectedManager])

  const quarterTrends = useMemo(() => {
    return quarters.map(quarter => {
      const quarterUpdates = qoqScopeUpdates.filter(update => update.quarter === quarter)
      return {
        quarter,
        completionRate: avg(quarterUpdates.map(update => update.completion_percent)),
        completedUpdates: quarterUpdates.length,
      }
    })
  }, [qoqScopeUpdates])

  const heatmapRows = useMemo(() => {
    return departments
      .map(dept => {
        const deptEmployees = profiles.filter(profile => profile.department_id === dept.id && profile.role === 'employee')
        const employeeIds = new Set(deptEmployees.map(employee => employee.id))
        const cells: HeatmapCell[] = quarters.map(quarter => {
          const quarterUpdates = yearUpdates.filter(update => {
            const goal = yearGoals.find(g => g.id === update.goal_id)
            return goal ? employeeIds.has(goal.employee_id) && update.quarter === quarter : false
          })

          return {
            quarter,
            completionRate: avg(quarterUpdates.map(update => update.completion_percent)),
          }
        })
        return { department: dept.name, cells }
      })
  }, [departments, profiles, yearGoals, yearUpdates])

  const thrustDistribution = useMemo(() => {
    const dist: Record<string, number> = {}
    yearGoals.forEach(goal => {
      const label = thrustMap.get(goal.thrust_area_id) || 'Unknown'
      dist[label] = (dist[label] || 0) + 1
    })
    return Object.entries(dist)
      .map(([name, count]) => ({ name, count, percentage: yearGoals.length > 0 ? Math.round((count / yearGoals.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
  }, [thrustMap, yearGoals])

  const uomDistribution = useMemo(() => {
    const dist: Record<string, number> = {}
    yearGoals.forEach(goal => {
      const label = uomLabels[goal.uom_type]
      dist[label] = (dist[label] || 0) + 1
    })
    return Object.entries(dist)
      .map(([name, count]) => ({ name, count, percentage: yearGoals.length > 0 ? Math.round((count / yearGoals.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
  }, [yearGoals])

  const statusDistribution = useMemo(() => {
    const dist: Record<string, number> = {}
    yearGoals.forEach(goal => {
      dist[goal.status] = (dist[goal.status] || 0) + 1
    })
    return Object.entries(dist).map(([name, count]) => ({
      name,
      count,
      percentage: yearGoals.length > 0 ? Math.round((count / yearGoals.length) * 100) : 0,
    }))
  }, [yearGoals])

  const managerStats = useMemo(() => {
    return profiles
      .filter(profile => profile.role === 'manager')
      .map(manager => {
        const directReports = profiles.filter(profile => profile.manager_id === manager.id)
        const reportIds = new Set(directReports.map(report => report.id))
        const teamGoals = yearGoals.filter(goal => reportIds.has(goal.employee_id))
        const teamUpdates = yearUpdates.filter(update => {
          const goal = yearGoals.find(g => g.id === update.goal_id)
          return goal ? reportIds.has(goal.employee_id) : false
        })

        const expectedCheckIns = teamGoals.length * quarters.length
        const completedCheckIns = teamUpdates.length
        const checkInRate = expectedCheckIns > 0 ? Math.round((completedCheckIns / expectedCheckIns) * 100) : 0
        const avgCompletion = avg(teamUpdates.map(update => update.completion_percent))

        return {
          manager: `${manager.first_name} ${manager.last_name}`,
          teamSize: directReports.length,
          goals: teamGoals.length,
          completedCheckIns,
          expectedCheckIns,
          checkInRate,
          avgCompletion,
        }
      })
      .filter(item => item.teamSize > 0)
      .sort((a, b) => b.checkInRate - a.checkInRate)
  }, [profiles, yearGoals, yearUpdates])

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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics Module</h1>
            <p className="text-slate-400 mt-1">Quarterly goal achievement, progress heatmaps, and manager insights</p>
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
            <p className="text-sm text-slate-400">Org Coverage</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{stats.orgCoverage}%</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Approved Goals</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{stats.approved}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Avg Completion</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.avgProgress}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">QoQ Goal Achievement Trends</h3>
              <button
                onClick={() => exportToCSV(quarterTrends as unknown as Record<string, unknown>[], 'qoq_trends')}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Export
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Department</label>
                <select
                  value={selectedDepartmentId}
                  onChange={e => {
                    setSelectedDepartmentId(e.target.value)
                    setSelectedManagerId('')
                    setSelectedEmployeeId('')
                  }}
                  className="w-full px-4 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Manager</label>
                <select
                  value={selectedManagerId}
                  onChange={e => {
                    setSelectedManagerId(e.target.value)
                    setSelectedEmployeeId('')
                  }}
                  className="w-full px-4 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                >
                  <option value="">All Managers</option>
                  {departmentManagers.map(manager => (
                    <option key={manager.id} value={manager.id}>
                      {manager.first_name} {manager.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Person</label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-4 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                >
                  <option value="">All People</option>
                  {scopedEmployees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-white/5 bg-[#081225] p-4">
              <p className="text-sm text-slate-400">Viewing QoQ report for</p>
              <p className="mt-1 text-lg font-semibold text-white">{qoqScopeLabel}</p>
            </div>

            <div className="space-y-4">
              {quarterTrends.map(q => (
                <div key={q.quarter} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{q.quarter}</span>
                    <span className="text-white">{q.completionRate}% · {q.completedUpdates} updates</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${completionClass(q.completionRate)}`}
                      style={{ width: `${q.completionRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Organization Heatmap</h3>
              <span className="text-xs text-slate-400">Completion rates by department and quarter</span>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(120px,1.2fr)_repeat(4,minmax(0,1fr))] gap-2 text-[10px] text-slate-400">
                <div className="truncate" />
                {quarters.map(quarter => (
                  <div key={quarter} className="text-center">{quarter}</div>
                ))}
              </div>
              {heatmapRows.map(row => (
                <div key={row.department} className="grid grid-cols-[minmax(120px,1.2fr)_repeat(4,minmax(0,1fr))] gap-2 items-center">
                  <div className="truncate text-sm text-white pr-2">{row.department}</div>
                  {row.cells.map(cell => (
                    <div
                      key={`${row.department}-${cell.quarter}`}
                      className={`rounded-md px-2 py-2 text-center text-xs font-semibold text-white ${completionClass(cell.completionRate)}`}
                    >
                      {cell.completionRate}%
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Thrust Area Distribution</h3>
            <div className="space-y-3">
              {thrustDistribution.map(item => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400">{item.name}</span>
                    <span className="text-sm text-white">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="h-3 bg-[#081225] rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">UoM Distribution</h3>
            <div className="space-y-3">
              {uomDistribution.map(item => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400">{item.name}</span>
                    <span className="text-sm text-white">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="h-3 bg-[#081225] rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Goal Status Distribution</h3>
            <div className="space-y-3">
              {statusDistribution.map(item => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400 capitalize">{item.name}</span>
                    <span className="text-sm text-white">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="h-3 bg-[#081225] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.name === 'approved' ? 'bg-green-500' : item.name === 'submitted' ? 'bg-yellow-500' : 'bg-slate-500'}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Manager Effectiveness Dashboard</h3>
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
                  <th className="pb-2 font-medium text-center">Check-ins</th>
                  <th className="pb-2 font-medium text-center">Completion Rate</th>
                  <th className="pb-2 font-medium text-center">Avg Progress</th>
                </tr>
              </thead>
              <tbody>
                {managerStats.map(manager => (
                  <tr key={manager.manager} className="border-b border-white/5">
                    <td className="py-2 text-white">{manager.manager}</td>
                    <td className="py-2 text-center text-slate-300">{manager.teamSize}</td>
                    <td className="py-2 text-center text-slate-300">{manager.goals}</td>
                    <td className="py-2 text-center text-slate-300">{manager.completedCheckIns}/{manager.expectedCheckIns}</td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${completionClass(manager.checkInRate)} text-white`}>
                        {manager.checkInRate}%
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${completionClass(manager.avgCompletion)} text-white`}>
                        {manager.avgCompletion}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Department Performance</h3>
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
                {departments
                  .map(dept => {
                    const deptEmployees = profiles.filter(profile => profile.department_id === dept.id && profile.role === 'employee')
                    const deptGoalIds = new Set(
                      yearGoals.filter(goal => deptEmployees.some(employee => employee.id === goal.employee_id)).map(goal => goal.id)
                    )
                    const deptUpdates = yearUpdates.filter(update => deptGoalIds.has(update.goal_id))

                    return {
                      department: dept.name,
                      employees: deptEmployees.length,
                      goals: deptGoalIds.size,
                      avgProgress: avg(deptUpdates.map(update => update.completion_percent)),
                    }
                  })
                  .filter(row => row.employees > 0)
                  .map(row => (
                    <tr key={row.department} className="border-b border-white/5">
                      <td className="py-2 text-white">{row.department}</td>
                      <td className="py-2 text-center text-slate-300">{row.employees}</td>
                      <td className="py-2 text-center text-slate-300">{row.goals}</td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${completionClass(row.avgProgress)} text-white`}>
                          {row.avgProgress}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RoleLayout>
  )
}

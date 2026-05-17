'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Goal, GoalUpdate } from '@/lib/types'

const currentYear = new Date().getFullYear()

export default function ManagerTeamPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [teamMembers, setTeamMembers] = useState<Profile[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)

  const teamGoals = useMemo(() => {
    if (!profile) return []
    return goals.filter(g => {
      const teamMember = teamMembers.find(t => t.id === g.employee_id)
      return teamMember?.manager_id === profile.id
    })
  }, [goals, teamMembers, profile])

  const teamUpdates = useMemo(() => {
    const goalIds = new Set(teamGoals.map(g => g.id))
    return updates.filter(u => goalIds.has(u.goal_id))
  }, [updates, teamGoals])

  const teamStats = useMemo(() => {
    return teamMembers.map(member => {
      const memberGoals = teamGoals.filter(g => g.employee_id === member.id)
      const approved = memberGoals.filter(g => g.status === 'approved').length
      const submitted = memberGoals.filter(g => g.status === 'submitted').length
      const draft = memberGoals.filter(g => g.status === 'draft').length

      let progress = 0
      const memberGoalUpdates = teamUpdates.filter(u =>
        memberGoals.some(g => g.id === u.goal_id)
      )
      if (memberGoalUpdates.length > 0) {
        const totalProgress = memberGoalUpdates.reduce((sum, u) => sum + u.completion_percent, 0)
        progress = Math.round(totalProgress / memberGoalUpdates.length)
      }

      return {
        member,
        totalGoals: memberGoals.length,
        approved,
        submitted,
        draft,
        progress,
      }
    })
  }, [teamMembers, teamGoals, teamUpdates])

  const overallStats = useMemo(() => {
    const totalGoals = teamGoals.length
    const approved = teamGoals.filter(g => g.status === 'approved').length
    const submitted = teamGoals.filter(g => g.status === 'submitted').length
    const totalWeightage = teamGoals.reduce((sum, g) => sum + g.weightage, 0)

    return { totalGoals, approved, submitted, totalWeightage }
  }, [teamGoals])

  const fetchData = useCallback(async () => {
    if (!profile) return

    const [teamRes, goalsRes, updatesRes, deptRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('manager_id', profile.id)
        .eq('role', 'employee')
        .order('first_name'),
      supabase
        .from('goals')
        .select('*')
        .eq('cycle_year', currentYear),
      supabase.from('goal_updates').select('*'),
      supabase.from('departments').select('*'),
    ])

    setTeamMembers((teamRes.data || []) as Profile[])
    setGoals((goalsRes.data || []) as Goal[])
    setUpdates((updatesRes.data || []) as GoalUpdate[])
    setDepartments((deptRes.data || []) as { id: string; name: string }[])
    setLoading(false)
  }, [supabase, profile])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const selectedMemberGoals = useMemo(() => {
    if (!selectedEmployee) return []
    return teamGoals.filter(g => g.employee_id === selectedEmployee)
  }, [selectedEmployee, teamGoals])

  const getDeptName = (deptId: string | null) => {
    if (!deptId) return 'No Department'
    return departments.find(d => d.id === deptId)?.name || 'Unknown'
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
          <h1 className="text-2xl font-bold text-white">Team Dashboard</h1>
          <p className="text-slate-400 mt-1">Overview of your team's goal progress</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Team Members</p>
            <p className="text-3xl font-bold text-white mt-2">{teamMembers.length}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Total Goals</p>
            <p className="text-3xl font-bold text-white mt-2">{overallStats.totalGoals}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Approved</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{overallStats.approved}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Pending Approval</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{overallStats.submitted}</p>
          </div>
        </div>

        {teamMembers.length === 0 ? (
          <div className="text-center py-12 bg-[#0d1a36] border border-white/10 rounded-xl">
            <p className="text-slate-400">No team members found.</p>
            <p className="text-slate-500 text-sm mt-2">Team members will appear here when they set you as their manager.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold text-white">Team Members</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamStats.map(stat => (
                  <button
                    key={stat.member.id}
                    onClick={() => setSelectedEmployee(stat.member.id)}
                    className={`p-4 bg-[#0d1a36] border rounded-xl text-left transition-colors ${
                      selectedEmployee === stat.member.id
                        ? 'border-blue-500'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                        {stat.member.first_name[0]}{stat.member.last_name[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          {stat.member.first_name} {stat.member.last_name}
                        </p>
                        <p className="text-sm text-slate-400">{getDeptName(stat.member.department_id)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-[#081225] rounded p-2">
                        <p className="text-lg font-bold text-white">{stat.totalGoals}</p>
                        <p className="text-xs text-slate-500">Goals</p>
                      </div>
                      <div className="bg-[#081225] rounded p-2">
                        <p className="text-lg font-bold text-green-400">{stat.approved}</p>
                        <p className="text-xs text-slate-500">Approved</p>
                      </div>
                      <div className="bg-[#081225] rounded p-2">
                        <p className="text-lg font-bold text-yellow-400">{stat.submitted}</p>
                        <p className="text-xs text-slate-500">Pending</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-white">{stat.progress}%</span>
                      </div>
                      <div className="h-2 bg-[#081225] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${stat.progress}%` }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                {selectedEmployee
                  ? `Goals - ${teamStats.find(s => s.member.id === selectedEmployee)?.member.first_name}`
                  : 'Select a team member'}
              </h2>

              {selectedEmployee ? (
                selectedMemberGoals.length === 0 ? (
                  <p className="text-slate-400 text-sm">No goals set for this year.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedMemberGoals.map(g => {
                      const statusColors: Record<string, string> = {
                        draft: 'bg-slate-600',
                        submitted: 'bg-yellow-600',
                        approved: 'bg-green-600',
                        rework: 'bg-red-600',
                      }
                      return (
                        <div key={g.id} className="p-3 bg-[#081225] rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-white font-medium">{g.title}</p>
                              <p className="text-sm text-slate-400">{g.weightage}%</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${statusColors[g.status]} text-white`}>
                              {g.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                <p className="text-slate-400 text-sm">Click on a team member to view their goals.</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 bg-[#0d1a36] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quarterly Progress by Team Member</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium text-center">Q1 Progress</th>
                  <th className="pb-3 font-medium text-center">Q2 Progress</th>
                  <th className="pb-3 font-medium text-center">Q3 Progress</th>
                  <th className="pb-3 font-medium text-center">Q4 Progress</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.map(stat => {
                  const memberGoals = teamGoals.filter(g => g.employee_id === stat.member.id)
                  const goalIds = new Set(memberGoals.map(g => g.id))
                  const memberUpdates = teamUpdates.filter(u => goalIds.has(u.goal_id))

                  const getQuarterProgress = (quarter: string) => {
                    const quarterUpdates = memberUpdates.filter(u => u.quarter === quarter)
                    if (quarterUpdates.length === 0) return null
                    return Math.round(
                      quarterUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / quarterUpdates.length
                    )
                  }

                  return (
                    <tr key={stat.member.id} className="border-b border-white/5">
                      <td className="py-3 text-white">
                        {stat.member.first_name} {stat.member.last_name}
                      </td>
                      {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
                        const progress = getQuarterProgress(q)
                        return (
                          <td key={q} className="py-3 text-center">
                            {progress !== null ? (
                              <div className="inline-flex items-center gap-2">
                                <div className="w-16 h-2 bg-[#081225] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      progress >= 75 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-sm text-slate-400">{progress}%</span>
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
      </div>
    </RoleLayout>
  )
}
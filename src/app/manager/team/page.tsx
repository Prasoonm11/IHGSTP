'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Goal, GoalUpdate } from '@/lib/types'
import { AnimatedNumber, CardGradient, PageHeader, LoadingSpinner, Badge, ProgressBar, EmptyState, statusColors, animationStyles } from '@/components/ui/animations'
import { getTimeGreeting, formatISTDate } from '@/lib/time'

const currentYear = new Date().getFullYear()

interface TeamMemberStat {
  member: Profile
  totalGoals: number
  approved: number
  submitted: number
  progress: number
}

function TeamMemberCard({
  stat,
  isSelected,
  onClick,
  getDeptName
}: {
  stat: TeamMemberStat
  isSelected: boolean
  onClick: () => void
  getDeptName: (id: string | null) => string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        group p-4 rounded-2xl text-left transition-all duration-300
        ${isSelected
          ? 'bg-linear-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/50'
          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
        }
        hover:transform hover:scale-[1.01] hover:shadow-lg
      `}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {stat.member.first_name[0]}{stat.member.last_name[0]}
        </div>
        <div className="flex-1 text-left">
          <p className="text-white font-semibold group-hover:text-violet-300 transition-colors">
            {stat.member.first_name} {stat.member.last_name}
          </p>
          <p className="text-white/50 text-sm">{getDeptName(stat.member.department_id)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-xl font-bold text-white">{stat.totalGoals}</p>
          <p className="text-white/40 text-xs">Goals</p>
        </div>
        <div className="bg-emerald-500/10 rounded-lg p-2 text-center border border-emerald-500/20">
          <p className="text-xl font-bold text-emerald-400">{stat.approved}</p>
          <p className="text-emerald-400/60 text-xs">Approved</p>
        </div>
        <div className="bg-amber-500/10 rounded-lg p-2 text-center border border-amber-500/20">
          <p className="text-xl font-bold text-amber-400">{stat.submitted}</p>
          <p className="text-amber-400/60 text-xs">Pending</p>
        </div>
      </div>

      <ProgressBar value={stat.progress} gradient={stat.progress >= 75 ? 'from-emerald-500 to-teal-500' : stat.progress >= 50 ? 'from-amber-500 to-orange-500' : 'from-rose-500 to-red-500'} />
    </button>
  )
}

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
        progress,
      }
    })
  }, [teamMembers, teamGoals, teamUpdates])

  const overallStats = useMemo(() => {
    const totalGoals = teamGoals.length
    const approved = teamGoals.filter(g => g.status === 'approved').length
    const submitted = teamGoals.filter(g => g.status === 'submitted').length

    return { totalGoals, approved, submitted }
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
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      </RoleLayout>
    )
  }

  return (
    <RoleLayout>
      <style>{animationStyles}</style>
      <div className="max-w-7xl mx-auto space-y-8 pb-8 px-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">{getTimeGreeting()}, {profile?.first_name}</h1>
            <p className="text-violet-300/60 mt-2">Track your team's goal progress for {currentYear}</p>
          </div>
          <div className="text-right bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <p className="text-sm text-violet-300/60 mb-2">Today's Date</p>
            <p className="text-2xl font-bold text-white">{formatISTDate()}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Team Members', value: teamMembers.length, gradient: 'from-violet-500/20 to-fuchsia-500/20', icon: '👤', color: 'violet' },
            { label: 'Total Goals', value: overallStats.totalGoals, gradient: 'from-purple-500/20 to-pink-500/20', icon: '🎯', color: 'purple' },
            { label: 'Approved', value: overallStats.approved, gradient: 'from-emerald-500/20 to-teal-500/20', icon: '✅', color: 'emerald' },
            { label: 'Pending', value: overallStats.submitted, gradient: 'from-amber-500/20 to-orange-500/20', icon: '⏳', color: 'amber' },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-2xl p-6 bg-black/40 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all animate-fade-in-up`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-violet-300/60">{stat.label}</p>
                <div className={`w-12 h-12 rounded-lg bg-${stat.color}-500/20 flex items-center justify-center text-xl`}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-3xl font-bold text-white">
                <AnimatedNumber value={stat.value} />
              </p>
            </div>
          ))}
        </div>

        {teamMembers.length === 0 ? (
          <CardGradient gradient="from-slate-800/80 to-slate-900/80" className="p-12">
            <EmptyState
              icon="👥"
              title="No team members"
              description="Team members will appear here when they set you as their manager."
            />
          </CardGradient>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <h2 className="text-2xl font-bold text-white mb-1">Team Members</h2>
                <p className="text-violet-300/60 mb-6 text-sm">Overview of your team's performance and goals</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamStats.map(stat => (
                    <TeamMemberCard
                      key={stat.member.id}
                      stat={stat}
                      isSelected={selectedEmployee === stat.member.id}
                      onClick={() => setSelectedEmployee(stat.member.id)}
                      getDeptName={getDeptName}
                    />
                  ))}  
                </div>
              </div>
            </div>

            {/* Sidebar - Goals Detail */}
            <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-fit">
              <h2 className="text-lg font-bold text-white mb-2">{selectedEmployee
                  ? `${teamStats.find(s => s.member.id === selectedEmployee)?.member.first_name}'s Goals`
                  : 'Select Member'}</h2>
              <p className="text-violet-300/60 text-sm mb-4">Goal tracking and status</p>

              {selectedEmployee ? (
                selectedMemberGoals.length === 0 ? (
                  <EmptyState icon="📭" title="No goals set" description="No goals for this year." />
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
                    {selectedMemberGoals.map((g) => {
                      const statusIcon: Record<string, string> = {
                        not_started: '⏳',
                        on_track: '🚀',
                        approved: '✅',
                        submitted: '📝',
                        rework: '🔄',
                        draft: '✏️'
                      }
                      return (
                        <div key={g.id} className="p-3 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-all">
                          <div className="flex items-start gap-3">
                            <span className="text-lg mt-0.5">{statusIcon[g.status] || '📌'}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-medium text-sm truncate">{g.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-white/50 text-xs bg-white/10 px-2 py-0.5 rounded">{g.weightage}%</span>
                                {g.locked && <span className="text-yellow-400 text-xs">🔒</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                <p className="text-white/40 text-center py-8">Click on a team member to view their goals.</p>
              )}
            </div>
          </div>
        )}

        {/* Quarterly Progress Section */}
        <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            📊 Quarterly Progress
          </h2>
          <p className="text-violet-300/60 text-sm mb-6">Team performance across quarters</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-white/60 text-sm border-b border-white/10">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium text-center">Q1</th>
                  <th className="pb-3 font-medium text-center">Q2</th>
                  <th className="pb-3 font-medium text-center">Q3</th>
                  <th className="pb-3 font-medium text-center">Q4</th>
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
                    <tr key={stat.member.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 text-white font-medium">{stat.member.first_name} {stat.member.last_name}</td>
                      {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
                        const progress = getQuarterProgress(q)
                        return (
                          <td key={q} className="py-3 text-center">
                            {progress !== null ? (
                              <div className="inline-flex items-center gap-2 justify-center">
                                <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      progress >= 75 ? 'bg-linear-to-r from-emerald-500 to-teal-500' :
                                      progress >= 50 ? 'bg-linear-to-r from-amber-500 to-orange-500' :
                                      'bg-linear-to-r from-rose-500 to-red-500'
                                    }`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-white/60 text-sm w-8">{progress}%</span>
                              </div>
                            ) : (
                              <span className="text-white/30">-</span>
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
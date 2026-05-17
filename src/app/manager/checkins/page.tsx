'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Goal, GoalUpdate, ThrustArea, CheckinComment } from '@/lib/types'

const currentYear = new Date().getFullYear()
const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const

export default function ManagerCheckinsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [comments, setComments] = useState<CheckinComment[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q1')
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const teamMemberIds = useMemo(() => {
    if (!profile) return new Set<string>()
    return new Set(profiles.filter(p => p.manager_id === profile.id).map(p => p.id))
  }, [profiles, profile])

  const teamGoals = useMemo(() => {
    return goals.filter(g => teamMemberIds.has(g.employee_id) && g.status === 'approved' && g.cycle_year === currentYear)
  }, [goals, teamMemberIds])

  const teamEmployees = useMemo(() => {
    const empIds = new Set(teamGoals.map(g => g.employee_id))
    return profiles.filter(p => empIds.has(p.id))
  }, [profiles, teamGoals])

  const selectedGoalUpdates = useMemo(() => {
    if (!selectedEmployee || !selectedQuarter) return []
    const empGoals = teamGoals.filter(g => g.employee_id === selectedEmployee)
    const goalIds = new Set(empGoals.map(g => g.id))
    return updates.filter(u => goalIds.has(u.goal_id) && u.quarter === selectedQuarter)
  }, [selectedEmployee, selectedQuarter, teamGoals, updates])

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])
  const thrustMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t])), [thrustAreas])

  const fetchData = useCallback(async () => {
    const [goalsRes, updatesRes, commentsRes, profilesRes, thrustRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('cycle_year', currentYear)
        .eq('status', 'approved'),
      supabase.from('goal_updates').select('*'),
      supabase.from('checkin_comments').select('*'),
      supabase.from('profiles').select('*').order('first_name'),
      supabase.from('thrust_areas').select('*'),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setUpdates((updatesRes.data || []) as GoalUpdate[])
    setComments((commentsRes.data || []) as CheckinComment[])
    setProfiles((profilesRes.data || []) as Profile[])
    setThrustAreas((thrustRes.data || []) as ThrustArea[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddFeedback = async () => {
    if (!profile || !selectedEmployee || !feedbackText.trim()) return

    setSaving(true)
    try {
      const empGoals = teamGoals.filter(g => g.employee_id === selectedEmployee)
      for (const goal of empGoals) {
        const { error } = await supabase.from('checkin_comments').insert({
          goal_id: goal.id,
          quarter: selectedQuarter as 'Q1' | 'Q2' | 'Q3' | 'Q4',
          manager_id: profile.id,
          employee_id: selectedEmployee,
          comment: feedbackText,
        })
        if (error) throw error
      }

      setSuccess('Feedback added successfully!')
      setFeedbackText('')
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add feedback')
    } finally {
      setSaving(false)
    }
  }

  const getQuarterProgress = (employeeId: string, quarter: string) => {
    const empGoals = teamGoals.filter(g => g.employee_id === employeeId)
    const goalIds = new Set(empGoals.map(g => g.id))
    const quarterUpdates = updates.filter(u => goalIds.has(u.goal_id) && u.quarter === quarter)

    if (quarterUpdates.length === 0) return null
    const totalProgress = quarterUpdates.reduce((sum, u) => sum + u.completion_percent, 0)
    return Math.round(totalProgress / quarterUpdates.length)
  }

  const getEmployeeQuarterComment = (employeeId: string, quarter: string) => {
    const empGoals = teamGoals.filter(g => g.employee_id === employeeId)
    const goalIds = new Set(empGoals.map(g => g.id))
    return comments.find(c => goalIds.has(c.goal_id) && c.quarter === quarter && c.manager_id === profile?.id)
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
          <h1 className="text-2xl font-bold text-white">Check-ins & Feedback</h1>
          <p className="text-slate-400 mt-1">Review team progress and provide feedback</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {quarters.map(q => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedQuarter === q
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0d1a36] text-slate-400 hover:text-white'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-4">Team Progress - {selectedQuarter}</h2>

            {teamEmployees.length === 0 ? (
              <p className="text-slate-400">No team members found.</p>
            ) : (
              <div className="space-y-4">
                {teamEmployees.map(emp => {
                  const empGoals = teamGoals.filter(g => g.employee_id === emp.id)
                  const goalIds = new Set(empGoals.map(g => g.id))
                  const quarterUpdates = updates.filter(u => goalIds.has(u.goal_id) && u.quarter === selectedQuarter)

                  const plannedTotal = quarterUpdates.reduce((sum, u) => sum + (u.planned_value || 0), 0)
                  const actualTotal = quarterUpdates.reduce((sum, u) => sum + (u.actual_value || 0), 0)
                  const progress = quarterUpdates.length > 0
                    ? Math.round(quarterUpdates.reduce((sum, u) => sum + u.completion_percent, 0) / quarterUpdates.length)
                    : 0

                  const comment = getEmployeeQuarterComment(emp.id, selectedQuarter)

                  return (
                    <div
                      key={emp.id}
                      className={`bg-[#0d1a36] border rounded-xl p-4 cursor-pointer transition-colors ${
                        selectedEmployee === emp.id
                          ? 'border-blue-500'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                      onClick={() => setSelectedEmployee(emp.id)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {emp.first_name} {emp.last_name}
                            </p>
                            <p className="text-sm text-slate-400">{empGoals.length} goals</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">{progress}%</p>
                          <p className="text-xs text-slate-500">Progress</p>
                        </div>
                      </div>

                      <div className="h-2 bg-[#081225] rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full ${
                            progress >= 75 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Planned Value</p>
                          <p className="text-white">{plannedTotal.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Actual Value</p>
                          <p className="text-white">{actualTotal.toLocaleString()}</p>
                        </div>
                      </div>

                      {comment && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-xs text-slate-500 mb-1">Your feedback:</p>
                          <p className="text-sm text-slate-300">{comment.comment}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {selectedEmployee
                ? `Feedback - ${selectedQuarter}`
                : 'Select an employee'}
            </h2>

            {selectedEmployee ? (
              <div className="space-y-4">
                <div className="p-3 bg-[#081225] rounded-lg">
                  <p className="text-sm text-slate-400 mb-2">Goal Updates</p>
                  {selectedGoalUpdates.length === 0 ? (
                    <p className="text-slate-500 text-sm">No updates for this quarter.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedGoalUpdates.map(update => {
                        const goal = teamGoals.find(g => g.id === update.goal_id)
                        return (
                          <div key={update.id} className="border-b border-white/5 pb-2 last:border-0">
                            <p className="text-white text-sm">{goal?.title}</p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs text-slate-500">
                                Actual: {update.actual_value ?? '-'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                update.status === 'completed' ? 'bg-green-600' :
                                update.status === 'on_track' ? 'bg-blue-600' : 'bg-slate-600'
                              } text-white`}>
                                {update.status.replace('_', ' ')}
                              </span>
                            </div>
                            {update.comment && (
                              <p className="text-xs text-slate-400 mt-2 italic">{update.comment}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Add Feedback / Notes</label>
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    placeholder="Enter your feedback, coaching notes, or review comments..."
                  />
                </div>

                <button
                  onClick={handleAddFeedback}
                  disabled={saving || !feedbackText.trim()}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Feedback'}
                </button>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-sm text-slate-400 mb-2">Previous Feedback</p>
                  {quarters.map(q => {
                    const c = getEmployeeQuarterComment(selectedEmployee, q)
                    if (!c) return null
                    return (
                      <div key={q} className="mb-2 p-2 bg-[#081225] rounded">
                        <p className="text-xs text-slate-500">{q}</p>
                        <p className="text-sm text-slate-300">{c.comment}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-slate-400">Click on a team member to add feedback.</p>
            )}
          </div>
        </div>

        <div className="mt-6 bg-[#0d1a36] border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quarterly Trend</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                  <th className="pb-3 font-medium">Employee</th>
                  {quarters.map(q => (
                    <th key={q} className="pb-3 font-medium text-center">{q}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamEmployees.map(emp => (
                  <tr key={emp.id} className="border-b border-white/5">
                    <td className="py-3 text-white">
                      {emp.first_name} {emp.last_name}
                    </td>
                    {quarters.map(q => {
                      const progress = getQuarterProgress(emp.id, q)
                      return (
                        <td key={q} className="py-3 text-center">
                          {progress !== null ? (
                            <div className="inline-flex items-center gap-2">
                              <div className="w-20 h-2 bg-[#081225] rounded-full overflow-hidden">
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RoleLayout>
  )
}
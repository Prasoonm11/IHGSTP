'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Goal, GoalUpdate, ThrustArea, ProgressStatus } from '@/lib/types'
import { quarterWindows } from '@/lib/constants'

const currentYear = new Date().getFullYear()

const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const

function getCurrentQuarterWindow(): string {
  const month = new Date().getMonth() + 1
  if (month >= 7 && month <= 9) return 'Q1'
  if (month >= 10 && month <= 12) return 'Q2'
  if (month >= 1 && month <= 2) return 'Q3'
  return 'Q4'
}

function isQuarterOpen(quarter: string): boolean {
  return quarter === getCurrentQuarterWindow()
}

function getQuarterWindowInfo(quarter: string): { start: string; end: string } {
  const windows: Record<string, { start: string; end: string }> = {
    Q1: { start: 'July', end: 'September' },
    Q2: { start: 'October', end: 'December' },
    Q3: { start: 'January', end: 'February' },
    Q4: { start: 'March', end: 'April' },
  }
  return windows[quarter] || { start: '', end: '' }
}

export default function EmployeeCheckinsPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [updates, setUpdates] = useState<GoalUpdate[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedQuarter, setSelectedQuarter] = useState<string>(getCurrentQuarterWindow())
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [actualValue, setActualValue] = useState('')
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>('on_track')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const approvedGoals = useMemo(() => goals.filter(g => g.status === 'approved' && g.employee_id === profile?.id), [goals, profile])
  const thrustMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t])), [thrustAreas])

  const currentUpdate = useMemo(() => {
    if (!selectedGoalId) return null
    return updates.find(u => u.goal_id === selectedGoalId && u.quarter === selectedQuarter)
  }, [updates, selectedGoalId, selectedQuarter])

  const quarterWindowOpen = useMemo(() => isQuarterOpen(selectedQuarter), [selectedQuarter])

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
        .order('quarter', { ascending: true }),
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

  const handleSaveUpdate = async () => {
    if (!profile || !selectedGoalId) return

    setError('')
    setSaving(true)

    try {
      const updateData = {
        goal_id: selectedGoalId,
        quarter: selectedQuarter,
        actual_value: actualValue ? Number(actualValue) : null,
        status: progressStatus,
        completion_percent: progressStatus === 'completed' ? 100 : progressStatus === 'not_started' ? 0 : 50,
        comment: comment || null,
        updated_by: profile.id,
      }

      if (currentUpdate) {
        const { error: updateError } = await supabase
          .from('goal_updates')
          .update(updateData)
          .eq('id', currentUpdate.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('goal_updates')
          .insert(updateData)

        if (insertError) throw insertError
      }

      setSuccess('Check-in saved!')
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save check-in')
    } finally {
      setSaving(false)
    }
  }

  const getProgressColor = (status: ProgressStatus): string => {
    const colors: Record<ProgressStatus, string> = {
      not_started: 'bg-slate-500',
      on_track: 'bg-blue-500',
      completed: 'bg-green-500',
    }
    return colors[status]
  }

  const getProgressLabel = (status: ProgressStatus): string => {
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

  const windowInfo = getQuarterWindowInfo(selectedQuarter)

  return (
    <RoleLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Quarterly Check-ins</h1>
          <p className="text-slate-400 mt-1">Update your progress on approved goals</p>
        </div>

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
              {isQuarterOpen(q) && <span className="ml-1 text-xs text-green-400">●</span>}
            </button>
          ))}
        </div>

        <div className={`p-4 rounded-lg mb-6 ${quarterWindowOpen ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
          <p className={`text-sm ${quarterWindowOpen ? 'text-green-400' : 'text-yellow-400'}`}>
            {quarterWindowOpen
              ? `✓ ${selectedQuarter} window is open (${windowInfo.start} - ${windowInfo.end}). You can update your progress.`
              : `⚠ ${selectedQuarter} window is closed (${windowInfo.start} - ${windowInfo.end}). Updates are locked.`}
          </p>
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

        {approvedGoals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No approved goals to check in on.</p>
            <p className="text-slate-500 text-sm mt-2">Create and submit goals in the My Goals section first.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Select Goal to Update</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {approvedGoals.map(g => {
                  const goalUpdate = updates.find(u => u.goal_id === g.id && u.quarter === selectedQuarter)
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        setSelectedGoalId(g.id)
                        if (goalUpdate) {
                          setActualValue(goalUpdate.actual_value?.toString() || '')
                          setProgressStatus(goalUpdate.status)
                          setComment(goalUpdate.comment || '')
                        } else {
                          setActualValue('')
                          setProgressStatus('on_track')
                          setComment('')
                        }
                      }}
                      className={`p-4 rounded-lg text-left transition-colors ${
                        selectedGoalId === g.id
                          ? 'bg-blue-600 border-2 border-blue-400'
                          : 'bg-[#081225] border-2 border-transparent hover:border-white/10'
                      }`}
                    >
                      <p className="text-white font-medium">{g.title}</p>
                      <p className="text-sm text-slate-400">{thrustMap.get(g.thrust_area_id)?.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-slate-500">{g.weightage}%</span>
                        {goalUpdate && (
                          <span className={`px-2 py-0.5 rounded text-xs ${getProgressColor(goalUpdate.status)} text-white`}>
                            {getProgressLabel(goalUpdate.status)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedGoalId && (
              <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Update Progress - {selectedQuarter}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Actual Achievement</label>
                    <input
                      type="number"
                      value={actualValue}
                      onChange={e => setActualValue(e.target.value)}
                      disabled={!quarterWindowOpen}
                      className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white disabled:opacity-50"
                      placeholder="Enter actual value achieved"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Status</label>
                    <div className="flex gap-2">
                      {(['not_started', 'on_track', 'completed'] as ProgressStatus[]).map(status => (
                        <button
                          key={status}
                          onClick={() => setProgressStatus(status)}
                          disabled={!quarterWindowOpen}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                            progressStatus === status
                              ? getProgressColor(status) + ' text-white'
                              : 'bg-[#081225] text-slate-400 hover:text-white'
                          }`}
                        >
                          {getProgressLabel(status)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Comments / Remarks</label>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      disabled={!quarterWindowOpen}
                      rows={3}
                      className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white disabled:opacity-50"
                      placeholder="Describe your progress, challenges, or achievements..."
                    />
                  </div>

                  <button
                    onClick={handleSaveUpdate}
                    disabled={saving || !quarterWindowOpen}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Check-in'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Check-in History</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                      <th className="pb-3 font-medium">Goal</th>
                      <th className="pb-3 font-medium">Q1</th>
                      <th className="pb-3 font-medium">Q2</th>
                      <th className="pb-3 font-medium">Q3</th>
                      <th className="pb-3 font-medium">Q4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedGoals.map(g => (
                      <tr key={g.id} className="border-b border-white/5">
                        <td className="py-3 text-white">{g.title}</td>
                        {quarters.map(q => {
                          const update = updates.find(u => u.goal_id === g.id && u.quarter === q)
                          return (
                            <td key={q} className="py-3">
                              {update ? (
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${getProgressColor(update.status)} text-white`}>
                                  {getProgressLabel(update.status)}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-xs">-</span>
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
        )}
      </div>
    </RoleLayout>
  )
}
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Goal, GoalStatus, ThrustArea, UomType } from '@/lib/types'
import { uomOptions } from '@/lib/constants'

const currentYear = new Date().getFullYear()

export default function ManagerApprovalsPage() {
  const { profile, refreshProfile } = useAuth()
  const supabase = createClient()

  const [goals, setGoals] = useState<Goal[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [filter, setFilter] = useState<'pending' | 'approved' | 'rework'>('pending')
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [editForm, setEditForm] = useState({ target_value: '', weightage: '' })
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const teamMemberIds = useMemo(() => {
    if (!profile) return new Set<string>()
    return new Set(profiles.filter(p => p.manager_id === profile.id).map(p => p.id))
  }, [profiles, profile])

  const pendingGoals = useMemo(() => {
    return goals.filter(g =>
      g.status === 'submitted' && teamMemberIds.has(g.employee_id) && g.cycle_year === currentYear
    )
  }, [goals, teamMemberIds])

  const processedGoals = useMemo(() => {
    return goals.filter(g =>
      (g.status === 'approved' || g.status === 'rework') &&
      teamMemberIds.has(g.employee_id) &&
      g.cycle_year === currentYear
    )
  }, [goals, teamMemberIds])

  const displayGoals = filter === 'pending' ? pendingGoals : processedGoals.filter(g => g.status === filter)

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])
  const thrustMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t])), [thrustAreas])

  const fetchData = useCallback(async () => {
    const [goalsRes, profilesRes, thrustRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('cycle_year', currentYear)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('first_name'),
      supabase.from('thrust_areas').select('*'),
    ])

    setGoals((goalsRes.data || []) as Goal[])
    setProfiles((profilesRes.data || []) as Profile[])
    setThrustAreas((thrustRes.data || []) as ThrustArea[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleApprove = async (goalId: string) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('goals')
        .update({ status: 'approved', locked: true } as { status: GoalStatus; locked: boolean })
        .eq('id', goalId)

      if (error) throw error

      await supabase.from('notifications').insert({
        user_id: goals.find(g => g.id === goalId)?.employee_id,
        type: 'goal_approved',
        payload: { message: 'Your goal has been approved!', goal_id: goalId },
      })

      setSuccess('Goal approved successfully!')
      await fetchData()
      setSelectedGoal(null)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedGoal || !rejectReason.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('goals')
        .update({ status: 'rework' } as { status: GoalStatus })
        .eq('id', selectedGoal.id)

      if (error) throw error

      await supabase.from('notifications').insert({
        user_id: selectedGoal.employee_id,
        type: 'goal_rejected',
        payload: { message: `Goal rejected: ${rejectReason}`, goal_id: selectedGoal.id },
      })

      setSuccess('Goal sent back for rework')
      setShowRejectModal(false)
      setRejectReason('')
      await fetchData()
      setSelectedGoal(null)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setSaving(false)
    }
  }

  const handleInlineUpdate = async () => {
    if (!selectedGoal) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('goals')
        .update({
          target_value: editForm.target_value ? Number(editForm.target_value) : selectedGoal.target_value,
          weightage: editForm.weightage ? Number(editForm.weightage) : selectedGoal.weightage,
        })
        .eq('id', selectedGoal.id)

      if (error) throw error

      setSuccess('Goal updated')
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const selectGoal = (goal: Goal) => {
    setSelectedGoal(goal)
    setEditForm({
      target_value: goal.target_value?.toString() || '',
      weightage: goal.weightage.toString(),
    })
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

  const employee = selectedGoal ? profileMap.get(selectedGoal.employee_id) : null
  const thrustArea = selectedGoal ? thrustMap.get(selectedGoal.thrust_area_id) : null

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Goal Approvals</h1>
            <p className="text-slate-400 mt-1">Review and approve your team's goals</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-yellow-500/20 rounded-lg">
              <span className="text-yellow-400 font-medium">{pendingGoals.length} Pending</span>
            </div>
          </div>
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
          {[
            { value: 'pending', label: `Pending (${pendingGoals.length})` },
            { value: 'approved', label: 'Approved' },
            { value: 'rework', label: 'Sent Back' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as 'pending' | 'approved' | 'rework')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0d1a36] text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Goals</h2>
            {displayGoals.length === 0 ? (
              <p className="text-slate-400">No goals found.</p>
            ) : (
              displayGoals.map(g => {
                const emp = profileMap.get(g.employee_id)
                const statusColors: Record<GoalStatus, string> = {
                  draft: 'bg-slate-600',
                  submitted: 'bg-yellow-600',
                  approved: 'bg-green-600',
                  rework: 'bg-red-600',
                }
                return (
                  <button
                    key={g.id}
                    onClick={() => selectGoal(g)}
                    className={`w-full p-4 bg-[#0d1a36] border rounded-xl text-left transition-colors ${
                      selectedGoal?.id === g.id
                        ? 'border-blue-500'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-medium">{g.title}</p>
                        <p className="text-sm text-slate-400">
                          {emp?.first_name} {emp?.last_name}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${statusColors[g.status]} text-white`}>
                        {g.status}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-4 text-sm text-slate-500">
                      <span>{g.weightage}%</span>
                      <span>{thrustMap.get(g.thrust_area_id)?.name}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              {selectedGoal ? 'Goal Details' : 'Select a goal'}
            </h2>

            {selectedGoal ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#081225] rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                      {employee?.first_name[0]}{employee?.last_name[0]}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {employee?.first_name} {employee?.last_name}
                      </p>
                      <p className="text-sm text-slate-400">{employee?.email}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Goal Title</label>
                  <p className="text-white">{selectedGoal.title}</p>
                </div>

                {selectedGoal.description && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Description</label>
                    <p className="text-slate-300 text-sm">{selectedGoal.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Thrust Area</label>
                    <p className="text-white">{thrustArea?.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Unit of Measure</label>
                    <p className="text-white">
                      {uomOptions.find(o => o.value === selectedGoal.uom_type)?.label || selectedGoal.uom_type}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Target Value</label>
                    {filter === 'pending' ? (
                      <input
                        type="number"
                        value={editForm.target_value}
                        onChange={e => setEditForm({ ...editForm, target_value: e.target.value })}
                        className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                      />
                    ) : (
                      <p className="text-white">{selectedGoal.target_value || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Weightage (%)</label>
                    {filter === 'pending' ? (
                      <input
                        type="number"
                        value={editForm.weightage}
                        onChange={e => setEditForm({ ...editForm, weightage: e.target.value })}
                        min="10"
                        max="100"
                        className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                      />
                    ) : (
                      <p className="text-white">{selectedGoal.weightage}%</p>
                    )}
                  </div>
                </div>

                {filter === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t border-white/10">
                    {editForm.target_value !== String(selectedGoal.target_value || '') ||
                    editForm.weightage !== String(selectedGoal.weightage) ? (
                      <button
                        onClick={handleInlineUpdate}
                        disabled={saving}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Update & Review'}
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleApprove(selectedGoal.id)}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Send Back
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400">Click on a goal to view details and take action.</p>
            )}
          </div>
        </div>

        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Send Back for Rework</h3>
              <p className="text-sm text-slate-400 mb-4">
                Provide feedback to help the employee improve their goal.
              </p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white mb-4"
                placeholder="Enter reason for rejection..."
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={saving || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? 'Sending...' : 'Send Back'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleLayout>
  )
}
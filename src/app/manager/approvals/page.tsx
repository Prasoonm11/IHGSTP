'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Goal, GoalStatus, ThrustArea } from '@/lib/types'
import { uomOptions } from '@/lib/constants'
import { AnimatedNumber, CardGradient, PageHeader, LoadingSpinner, Badge, EmptyState, statusColors, GradientButton, animationStyles } from '@/components/ui/animations'
import { getTimeGreeting } from '@/lib/time'

const currentYear = new Date().getFullYear()

function GoalListItem({
  goal,
  employee,
  isSelected,
  onClick,
  thrustMap
}: {
  goal: Goal
  employee: Profile | undefined
  isSelected: boolean
  onClick: () => void
  thrustMap: Map<string, string>
}) {
  const colors = statusColors[goal.status] || statusColors.draft

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-4 rounded-xl text-left transition-all duration-300
        ${isSelected
          ? 'bg-linear-to-r from-violet-500/20 to-fuchsia-500/20 border-violet-500/50'
          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
        }
        hover:transform hover:scale-[1.01]
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{goal.title}</p>
          <p className="text-white/50 text-sm truncate">
            {employee?.first_name} {employee?.last_name}
          </p>
        </div>
        <Badge variant={goal.status === 'approved' ? 'success' : goal.status === 'rework' ? 'danger' : 'warning'}>
          {goal.status}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-white/40 text-sm">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {goal.weightage}%
        </span>
        <span>{thrustMap.get(goal.thrust_area_id)}</span>
      </div>
    </button>
  )
}

export default function ManagerApprovalsPage() {
  const { profile } = useAuth()
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
  const thrustMap = useMemo(() => new Map(thrustAreas.map(t => [t.id, t.name])), [thrustAreas])

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
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      </RoleLayout>
    )
  }

  const employee = selectedGoal ? profileMap.get(selectedGoal.employee_id) : null
  const thrustArea = selectedGoal ? thrustMap.get(selectedGoal.thrust_area_id) : null

  return (
    <RoleLayout>
      <style>{animationStyles}</style>
      <div className="max-w-7xl mx-auto space-y-8 pb-8 px-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">{getTimeGreeting()}, {profile?.first_name}</h1>
            <p className="text-violet-300/60 mt-2">Review and approve goals from your team members</p>
          </div>
          <div className="text-right bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <p className="text-sm text-amber-300/60 mb-2">Pending Approvals</p>
            <p className="text-3xl font-bold text-amber-400"><AnimatedNumber value={pendingGoals.length} /></p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 animate-fade-in-up">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 animate-fade-in-up">
            {success}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-violet-300/60">Pending Approvals</p>
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center text-xl">⏳</div>
            </div>
            <p className="text-3xl font-bold text-amber-400"><AnimatedNumber value={pendingGoals.length} /></p>
          </div>
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-violet-300/60">Approved Goals</p>
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xl">✅</div>
            </div>
            <p className="text-3xl font-bold text-emerald-400"><AnimatedNumber value={processedGoals.filter(g => g.status === 'approved').length} /></p>
          </div>
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-violet-300/60">Sent Back</p>
              <div className="w-12 h-12 rounded-lg bg-rose-500/20 flex items-center justify-center text-xl">🔄</div>
            </div>
            <p className="text-3xl font-bold text-rose-400"><AnimatedNumber value={processedGoals.filter(g => g.status === 'rework').length} /></p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'pending', label: `⏳ Pending (${pendingGoals.length})`, color: 'amber' },
            { value: 'approved', label: `✅ Approved (${processedGoals.filter(g => g.status === 'approved').length})`, color: 'emerald' },
            { value: 'rework', label: `🔄 Sent Back (${processedGoals.filter(g => g.status === 'rework').length})`, color: 'rose' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as 'pending' | 'approved' | 'rework')}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                filter === f.value
                  ? `bg-linear-to-r from-${f.color}-500 to-${f.color}-600 text-white shadow-lg`
                  : 'bg-black/40 backdrop-blur-sm border border-white/10 text-violet-300/70 hover:text-violet-100 hover:border-white/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Goals List */}
          <div className="lg:col-span-2 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-1">Goals to Review</h2>
            <p className="text-violet-300/60 text-sm mb-6">Showing {displayGoals.length} goal(s)</p>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin">
              {displayGoals.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-white/40 text-lg">📭</p>
                  <p className="text-white/60 mt-2">{filter === 'pending' ? 'No pending approvals' : `No ${filter} goals`}</p>
                </div>
              ) : (
                displayGoals.map(g => (
                  <button
                    key={g.id}
                    onClick={() => selectGoal(g)}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      selectedGoal?.id === g.id
                        ? 'bg-linear-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/50'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{g.title}</p>
                        <p className="text-white/50 text-sm truncate">
                          {profileMap.get(g.employee_id)?.first_name} {profileMap.get(g.employee_id)?.last_name}
                        </p>
                      </div>
                      <span className="ml-2 inline-block px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 text-violet-300">
                        {g.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-white/40 text-sm">
                      <span>{g.weightage}% •</span>
                      <span>{thrustMap.get(g.thrust_area_id)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Details Panel */}
          <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-fit">
            <h2 className="text-xl font-bold text-white mb-2">{selectedGoal ? 'Goal Details' : 'Select a Goal'}</h2>
            <p className="text-violet-300/60 text-sm mb-6">Review and take action</p>

            {selectedGoal ? (
              <div className="space-y-4">
                {/* Employee Info */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-linear-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm">
                      {employee?.first_name[0]}{employee?.last_name[0]}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{employee?.first_name} {employee?.last_name}</p>
                      <p className="text-white/50 text-xs">{employee?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Goal Info */}
                <div>
                  <label className="text-white/50 text-xs font-medium mb-1 block">GOAL</label>
                  <p className="text-white font-semibold">{selectedGoal.title}</p>
                </div>

                {selectedGoal.description && (
                  <div>
                    <label className="text-white/50 text-xs font-medium mb-1 block">DESCRIPTION</label>
                    <p className="text-white/70 text-sm">{selectedGoal.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/50 text-xs font-medium mb-1 block">THRUST AREA</label>
                    <p className="text-white text-sm">{thrustArea}</p>
                  </div>
                  <div>
                    <label className="text-white/50 text-xs font-medium mb-1 block">UOM</label>
                    <p className="text-white text-sm">{uomOptions.find(o => o.value === selectedGoal.uom_type)?.label || selectedGoal.uom_type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/50 text-xs font-medium mb-1 block">TARGET VALUE</label>
                    {filter === 'pending' ? (
                      <input
                        type="number"
                        value={editForm.target_value}
                        onChange={e => setEditForm({ ...editForm, target_value: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    ) : (
                      <p className="text-white text-sm">{selectedGoal.target_value || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-white/50 text-xs font-medium mb-1 block">WEIGHTAGE</label>
                    {filter === 'pending' ? (
                      <input
                        type="number"
                        value={editForm.weightage}
                        onChange={e => setEditForm({ ...editForm, weightage: e.target.value })}
                        min="10"
                        max="100"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                      />
                    ) : (
                      <p className="text-white text-sm">{selectedGoal.weightage}%</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {filter === 'pending' && (
                  <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                    {editForm.target_value !== String(selectedGoal.target_value || '') ||
                    editForm.weightage !== String(selectedGoal.weightage) ? (
                      <button
                        onClick={handleInlineUpdate}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all text-sm font-medium disabled:opacity-50"
                      >
                        Update
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleApprove(selectedGoal.id)}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg transition-all text-sm font-medium disabled:opacity-50"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="px-4 py-2 rounded-lg bg-linear-to-r from-rose-500 to-red-500 text-white hover:shadow-lg transition-all text-sm font-medium"
                    >
                      🔄 Send Back
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-white/40 text-sm">Select a goal to view details</p>
              </div>
            )}
          </div>
        </div>

        {showRejectModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
            <CardGradient gradient="from-slate-800/90 to-slate-900/90" className="p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-white mb-2">Send Back for Rework</h3>
              <p className="text-white/50 text-sm mb-4">
                Provide feedback to help the employee improve their goal.
              </p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 mb-4"
                placeholder="Enter reason for rejection..."
              />
              <div className="flex gap-3">
                <GradientButton
                  onClick={() => setShowRejectModal(false)}
                  gradient="from-slate-500 to-slate-600"
                >
                  Cancel
                </GradientButton>
                <GradientButton
                  onClick={handleReject}
                  disabled={saving || !rejectReason.trim()}
                  gradient="from-rose-500 to-red-500"
                >
                  Send Back
                </GradientButton>
              </div>
            </CardGradient>
          </div>
        )}
      </div>
    </RoleLayout>
  )
}
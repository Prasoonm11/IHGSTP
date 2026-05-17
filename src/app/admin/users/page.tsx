'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Department, Role } from '@/lib/types'

const currentYear = new Date().getFullYear()

export default function AdminUsersPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [users, setUsers] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'employee' as Role,
    department_id: '',
    manager_id: '',
    is_active: true,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = searchQuery
        ? `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(searchQuery.toLowerCase())
        : true
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesDept = deptFilter === 'all' || u.department_id === deptFilter
      return matchesSearch && matchesRole && matchesDept
    })
  }, [users, searchQuery, roleFilter, deptFilter])

  const managers = useMemo(() => users.filter(u => u.role === 'manager' || u.role === 'admin'), [users])
  const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments])

  const fetchData = useCallback(async () => {
    const [usersRes, deptRes] = await Promise.all([
      supabase.from('profiles').select('*').order('first_name'),
      supabase.from('departments').select('*').order('name'),
    ])

    setUsers((usersRes.data || []) as Profile[])
    setDepartments((deptRes.data || []) as Department[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleOpenModal = (user?: Profile) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        department_id: user.department_id || '',
        manager_id: user.manager_id || '',
        is_active: true,
      })
    } else {
      setEditingUser(null)
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        role: 'employee',
        department_id: '',
        manager_id: '',
        is_active: true,
      })
    }
    setShowModal(true)
    setError('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    try {
      if (editingUser) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: formData.role,
            department_id: formData.department_id || null,
            manager_id: formData.manager_id || null,
          })
          .eq('id', editingUser.id)

        if (updateError) throw updateError
        setSuccess('User updated successfully!')
      } else {
        setError('New user creation requires registration through the auth system')
      }

      setShowModal(false)
      await fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: Profile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id)

      if (!error) {
        setSuccess(`User ${user.is_active ? 'deactivated' : 'activated'}`)
        await fetchData()
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleUnlockGoal = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .update({ locked: false })
        .eq('employee_id', userId)
        .eq('cycle_year', currentYear)
        .eq('locked', true)

      if (!error) {
        setSuccess('All locked goals unlocked for this user')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unlock')
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

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-slate-400 mt-1">Manage users, roles, and organization hierarchy</p>
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

        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white placeholder-slate-500"
          />

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
          >
            <option value="all">All Roles</option>
            <option value="employee">Employees</option>
            <option value="manager">Managers</option>
            <option value="admin">Admins</option>
          </select>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-[#0d1a36] border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Department</th>
                  <th className="p-4 font-medium">Manager</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const manager = users.find(u => u.id === user.manager_id)
                  const roleColors: Record<Role, string> = {
                    employee: 'bg-blue-600',
                    manager: 'bg-purple-600',
                    admin: 'bg-red-600',
                  }

                  return (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                            {user.first_name[0]}{user.last_name[0]}
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${roleColors[user.role]} text-white`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">
                        {user.department_id ? deptMap.get(user.department_id) : '-'}
                      </td>
                      <td className="p-4 text-slate-300">
                        {manager ? `${manager.first_name} ${manager.last_name}` : '-'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs ${user.is_active ? 'bg-green-600' : 'bg-slate-600'} text-white`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal(user)}
                            className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`px-3 py-1 text-sm rounded transition-colors ${
                              user.is_active
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleUnlockGoal(user.id)}
                            className="px-3 py-1 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
                          >
                            Unlock Goals
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Total Users</p>
            <p className="text-3xl font-bold text-white mt-2">{users.length}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Employees</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">
              {users.filter(u => u.role === 'employee').length}
            </p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Managers</p>
            <p className="text-3xl font-bold text-purple-400 mt-2">
              {users.filter(u => u.role === 'manager').length}
            </p>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">
                {editingUser ? 'Edit User' : 'Add User'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">First Name</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Department</label>
                  <select
                    value={formData.department_id}
                    onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                  >
                    <option value="">No Department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Manager</label>
                  <select
                    value={formData.manager_id}
                    onChange={e => setFormData({ ...formData, manager_id: e.target.value })}
                    className="w-full px-3 py-2 bg-[#081225] border border-white/10 rounded-lg text-white"
                  >
                    <option value="">No Manager</option>
                    {managers.filter(m => m.id !== editingUser?.id).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleLayout>
  )
}
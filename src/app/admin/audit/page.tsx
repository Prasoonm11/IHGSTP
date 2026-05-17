'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import RoleLayout from '@/components/layout/role-layout'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import type { AuditLog, Profile } from '@/lib/types'
import { LoadingBar } from '@/components/ui/animations'

export default function AdminAuditPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [actorFilter, setActorFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter
      const matchesActor = actorFilter === 'all' || log.actor_id === actorFilter
      const matchesDate = (!dateRange.start || new Date(log.created_at) >= new Date(dateRange.start)) &&
        (!dateRange.end || new Date(log.created_at) <= new Date(dateRange.end))
      return matchesEntity && matchesActor && matchesDate
    })
  }, [auditLogs, entityFilter, actorFilter, dateRange])

  const uniqueEntities = useMemo(() =>
    [...new Set(auditLogs.map(l => l.entity_type))],
  [auditLogs])

  const fetchData = useCallback(async () => {
    const [logsRes, profilesRes] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('profiles').select('*'),
    ])

    setAuditLogs((logsRes.data || []) as AuditLog[])
    setProfiles((profilesRes.data || []) as Profile[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getActorName = (id: string | null) => {
    if (!id) return 'System'
    const actor = profileMap.get(id)
    return actor ? `${actor.first_name} ${actor.last_name}` : 'Unknown'
  }

  const formatDiff = (oldVals: Record<string, unknown> | null, newVals: Record<string, unknown> | null) => {
    if (!oldVals || !newVals) return null

    const changes: string[] = []
    for (const key of Object.keys(newVals)) {
      if (oldVals[key] !== newVals[key]) {
        changes.push(`${key}: ${oldVals[key]} → ${newVals[key]}`)
      }
    }
    return changes
  }

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID', 'Changes']
    const rows = filteredLogs.map(log => {
      const changes = formatDiff(log.old_values as Record<string, unknown> | null, log.new_values as Record<string, unknown> | null)
      return [
        new Date(log.created_at).toISOString(),
        getActorName(log.actor_id),
        log.action,
        log.entity_type,
        log.entity_id || '',
        changes?.join('; ') || '',
      ]
    })

    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`
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

  const lockedChanges = filteredLogs.filter(l => l.action === 'UPDATED_AFTER_LOCK')

  return (
    <RoleLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
            <p className="text-slate-400 mt-1">Track all changes to goals and system entities</p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:shadow-lg text-white rounded-lg font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
          >
            <option value="all">All Entity Types</option>
            {uniqueEntities.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
          >
            <option value="all">All Actors</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
            ))}
          </select>

          <input
            type="date"
            value={dateRange.start}
            onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
          />
          <span className="text-slate-400 self-center">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-4 py-2 bg-[#0d1a36] border border-white/10 rounded-lg text-white"
          />
        </div>

        {lockedChanges.length > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92A5.502 5.502 0 0014.42 19H5.58a5.502 5.502 0 00-2.823-6.901l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h3 className="text-red-400 font-medium">Post-Lock Modifications ({lockedChanges.length})</h3>
            </div>
            <p className="text-sm text-slate-400">
              These are changes made to goals after they were approved and locked.
            </p>
          </div>
        )}

        <div className="bg-[#0d1a36] border border-white/10 rounded-xl overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400">No audit logs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                    <th className="p-4 font-medium">Timestamp</th>
                    <th className="p-4 font-medium">Actor</th>
                    <th className="p-4 font-medium">Action</th>
                    <th className="p-4 font-medium">Entity</th>
                    <th className="p-4 font-medium">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => {
                    const changes = formatDiff(
                      log.old_values as Record<string, unknown> | null,
                      log.new_values as Record<string, unknown> | null
                    )
                    const isLockedChange = log.action === 'UPDATED_AFTER_LOCK'

                    return (
                      <tr key={log.id} className={`border-b border-white/5 ${isLockedChange ? 'bg-red-500/5' : ''}`}>
                        <td className="p-4">
                          <p className="text-white text-sm">
                            {new Date(log.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </p>
                        </td>
                        <td className="p-4 text-slate-300">{getActorName(log.actor_id)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            isLockedChange ? 'bg-red-600' :
                            log.action.includes('CREATE') ? 'bg-green-600' :
                            log.action.includes('UPDATE') ? 'bg-violet-600' :
                            'bg-slate-600'
                          } text-white`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="text-white text-sm">{log.entity_type}</p>
                          <p className="text-xs text-slate-500 font-mono">{log.entity_id?.slice(0, 8)}...</p>
                        </td>
                        <td className="p-4">
                          {changes && changes.length > 0 ? (
                            <div className="space-y-1">
                              {changes.slice(0, 3).map((change, i) => (
                                <p key={i} className="text-xs text-slate-400 font-mono">{change}</p>
                              ))}
                              {changes.length > 3 && (
                                <p className="text-xs text-slate-500">+{changes.length - 3} more</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Total Logs</p>
            <p className="text-3xl font-bold text-white mt-2">{filteredLogs.length}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Locked Goal Changes</p>
            <p className="text-3xl font-bold text-red-400 mt-2">{lockedChanges.length}</p>
          </div>
          <div className="bg-[#0d1a36] border border-white/10 rounded-xl p-6">
            <p className="text-sm text-slate-400">Unique Actors</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">
              {new Set(filteredLogs.map(l => l.actor_id)).size}
            </p>
          </div>
        </div>
      </div>
    </RoleLayout>
  )
}
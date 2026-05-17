export type Role = 'employee' | 'manager' | 'admin'

export type UomType =
  | 'numeric_min'
  | 'numeric_max'
  | 'percent_min'
  | 'percent_max'
  | 'timeline'
  | 'zero'

export type GoalStatus = 'draft' | 'submitted' | 'approved' | 'rework'

export type ProgressStatus = 'not_started' | 'on_track' | 'completed'

export interface Profile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: Role
  department_id: string | null
  manager_id: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface Department {
  id: string
  name: string
}

export interface ThrustArea {
  id: string
  name: string
}

export interface Goal {
  id: string
  employee_id: string
  thrust_area_id: string
  title: string
  description: string | null
  uom_type: UomType
  target_value: number | null
  target_date: string | null
  weightage: number
  status: GoalStatus
  cycle_year: number
  locked: boolean
  is_shared: boolean
  primary_goal_id: string | null
  created_at: string
}

export interface GoalUpdate {
  id: string
  goal_id: string
  quarter: string
  planned_value: number | null
  actual_value: number | null
  status: ProgressStatus
  completion_percent: number
  comment: string | null
  updated_by: string
  updated_at: string
}

export type GoalSheetStatus = 'draft' | 'submitted' | 'approved' | 'rework'

export interface GoalSheet {
  id: string
  employee_id: string
  cycle_year: number
  status: GoalSheetStatus
  created_at: string
  updated_at: string
}

export interface SharedGoal {
  id: string
  origin_goal_id: string | null
  department_id: string | null
  title: string
  description: string | null
  uom_type: UomType
  target_value: number | null
  target_date: string | null
  weightage: number
  read_only_fields: string[]
  created_by: string | null
  created_at: string
}

export type NotificationType = 'goal_submitted' | 'goal_approved' | 'goal_rejected' | 'checkin_reminder' | 'escalation' | 'system'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  payload: Record<string, unknown>
  is_read: boolean
  sent_at: string | null
  created_at: string
}

export interface CheckinComment {
  id: string
  goal_id: string
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  manager_id: string
  employee_id: string
  comment: string
  created_at: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export interface TeamGoalSummary {
  employee: Profile
  goalsCount: number
  approvedCount: number
  pendingApproval: number
  overallProgress: number
}

export interface GoalWithUpdates extends Goal {
  updates?: GoalUpdate[]
  employee?: Profile
  thrust_area?: ThrustArea
}

export interface QuarterlyMetrics {
  quarter: string
  plannedTotal: number
  actualTotal: number
  completionRate: number
}

export interface GoalCycle {
  id: string
  year: number
  name: string
  start_date: string
  end_date: string
  submission_deadline: string
  is_active: boolean
  created_at: string
}

export interface EscalationRule {
  id: string
  name: string
  trigger_type: 'missed_submission' | 'overdue_approval' | 'checkin_overdue'
  condition: Record<string, unknown>
  actions: Record<string, unknown>[]
  is_active: boolean
  created_at: string
}

export interface NotificationChannel {
  id: string
  name: string
  provider: 'email' | 'teams' | 'in_app' | 'webhook'
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
}

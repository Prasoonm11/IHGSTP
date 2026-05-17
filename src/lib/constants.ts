export const roleOptions = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager (L1)' },
  { value: 'admin', label: 'Admin / HR' }
] as const

export const uomOptions = [
  { value: 'numeric_min', label: 'Numeric Min (higher is better)' },
  { value: 'numeric_max', label: 'Numeric Max (lower is better)' },
  { value: 'percent_min', label: '% Min (higher is better)' },
  { value: 'percent_max', label: '% Max (lower is better)' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'zero', label: 'Zero-based' }
] as const

export const statusOptions = ['not_started', 'on_track', 'completed'] as const

export const quarterWindows = [
  { quarter: 'Q1', months: [7, 8, 9], label: 'July-Sep' },
  { quarter: 'Q2', months: [10, 11, 12], label: 'Oct-Dec' },
  { quarter: 'Q3', months: [1, 2], label: 'Jan-Feb' },
  { quarter: 'Q4', months: [3, 4], label: 'Mar-Apr' }
] as const

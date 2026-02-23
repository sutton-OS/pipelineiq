export interface Team {
  id: string
  user_id: string
  name: string
  goal_monthly: number
  created_at: string
}

export interface Report {
  id: string
  user_id: string
  team_id: string
  name: string
  period_type: 'weekly' | 'monthly'
  period_start: string
  period_end: string
  created_at: string
}

export interface Rep {
  id: string
  user_id: string
  team_id: string
  name: string
  role: string | null
  created_at: string
}

export interface RepMetrics {
  id: string
  rep_id: string
  report_id: string
  user_id: string
  revenue: number
  quota: number
  deals_closed: number
  calls: number
  emails: number
  demos: number
  leads: number
  contacts: number
  qualified: number
  avg_deal_size: number
  avg_days_to_close: number
  created_at: string
}

export interface RepWithMetrics extends Rep {
  metrics: RepMetrics | null
}

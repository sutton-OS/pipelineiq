"use server"

import { requireUserId } from "@/lib/auth"
import { checkReportLimit } from "@/lib/subscription"
import { createServerClient } from "@/lib/supabase"

type UploadRow = {
  rep_name: string
  role?: string
  revenue: number
  quota: number
  deals_closed?: number
  calls?: number
  emails?: number
  demos?: number
  leads?: number
  contacts?: number
  qualified?: number
  avg_deal_size?: number
  avg_days_to_close?: number
}

type SaveReportInput = {
  reportName: string
  periodType: "weekly" | "monthly"
  periodStart: string
  periodEnd: string
  rows: UploadRow[]
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return 0
}

export async function saveReport({
  reportName,
  periodType,
  periodStart,
  periodEnd,
  rows,
}: SaveReportInput): Promise<{ reportId: string } | { error: string }> {
  try {
    const userId = await requireUserId()
    const supabase = createServerClient()

    if (!reportName.trim()) {
      return { error: "Report name is required." }
    }

    if (!periodStart || !periodEnd) {
      return { error: "Period start and end are required." }
    }

    const reportLimitResult = await checkReportLimit(userId)
    if (!reportLimitResult.canCreate) {
      return { error: reportLimitResult.reason ?? "Report limit reached." }
    }

    const { data: team, error: teamLookupError } = await supabase
      .from("teams")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    if (teamLookupError) {
      return { error: `Unable to load team: ${teamLookupError.message}` }
    }

    let teamId = team?.id

    if (!teamId) {
      const { data: createdTeam, error: teamCreateError } = await supabase
        .from("teams")
        .insert({
          user_id: userId,
          name: "My Team",
          goal_monthly: 0,
        })
        .select("id")
        .single()

      if (teamCreateError) {
        return { error: `Unable to create team: ${teamCreateError.message}` }
      }

      teamId = createdTeam.id
    }

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        user_id: userId,
        team_id: teamId,
        name: reportName.trim(),
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
      })
      .select("id")
      .single()

    if (reportError) {
      return { error: `Unable to create report: ${reportError.message}` }
    }

    for (const row of rows) {
      const repName = row.rep_name?.trim()
      if (!repName) continue

      const { data: rep, error: repError } = await supabase
        .from("reps")
        .upsert(
          {
            user_id: userId,
            team_id: teamId,
            name: repName,
            role: row.role?.trim() || null,
          },
          { onConflict: "user_id,name" }
        )
        .select("id")
        .single()

      if (repError) {
        return {
          error: `Unable to save rep "${repName}": ${repError.message}`,
        }
      }

      const { error: metricsError } = await supabase.from("rep_metrics").insert({
        rep_id: rep.id,
        report_id: report.id,
        user_id: userId,
        revenue: toNumber(row.revenue),
        quota: toNumber(row.quota),
        deals_closed: toNumber(row.deals_closed),
        calls: toNumber(row.calls),
        emails: toNumber(row.emails),
        demos: toNumber(row.demos),
        leads: toNumber(row.leads),
        contacts: toNumber(row.contacts),
        qualified: toNumber(row.qualified),
        avg_deal_size: toNumber(row.avg_deal_size),
        avg_days_to_close: toNumber(row.avg_days_to_close),
      })

      if (metricsError) {
        return {
          error: `Unable to save metrics for "${repName}": ${metricsError.message}`,
        }
      }
    }

    return { reportId: report.id }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save report."
    return { error: message }
  }
}

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { ensureOrgAndLocation, listAuditEntriesForExport } from "@/lib/goldbot";
import { logServerError } from "@/lib/server-error";

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const context = await ensureOrgAndLocation(userId);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "5000");

    const rows = await listAuditEntriesForExport(context, Number.isFinite(limit) ? limit : 5000);
    const header = [
      "id",
      "created_at",
      "action_type",
      "policy_version",
      "success",
      "error_message",
      "lead_id",
      "conversation_id",
      "decision_json",
      "result_json",
    ];

    const lines = [header.join(",")];
    for (const row of rows) {
      lines.push(
        [
          row.id,
          row.createdAt,
          row.actionType,
          row.policyVersion,
          row.success ? "true" : "false",
          row.errorMessage ?? "",
          row.leadId ?? "",
          row.conversationId ?? "",
          JSON.stringify(row.decisionJson ?? {}),
          JSON.stringify(row.resultJson ?? {}),
        ]
          .map((value) => csvEscape(value))
          .join(","),
      );
    }

    const filename = `audit-export-${context.orgId}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.csv`;

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export audit logs";
    const status = message === "Unauthorized" ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    const referenceId = logServerError("app/api/audit/export", error, { status });
    return NextResponse.json({ error: message, referenceId }, { status });
  }
}

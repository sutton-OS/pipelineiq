import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { pgPool } from "@/lib/pg";
import { logServerError } from "@/lib/server-error";

const REQUIRED_TABLES = [
  "orgs",
  "org_memberships",
  "locations",
  "leads",
  "conversations",
  "messages",
  "appointments",
  "jobs",
  "audit_log",
  "kill_switch",
] as const;

export async function GET() {
  try {
    const authContext = await requireAuthContext();

    if (authContext.role !== "owner") {
      return NextResponse.json(
        { ok: false, error: "Forbidden: owner role required" },
        { status: 403 },
      );
    }

    const dbPingResult = await pgPool.query<{ ok: number }>("SELECT 1 AS ok");
    const dbConnected = dbPingResult.rows[0]?.ok === 1;

    const tableResult = await pgPool.query<{
      table_name: string;
      table_exists: boolean;
    }>(
      `
        SELECT
          required.table_name,
          to_regclass(format('public.%I', required.table_name)) IS NOT NULL AS table_exists
        FROM unnest($1::text[]) AS required(table_name)
      `,
      [REQUIRED_TABLES],
    );

    const missingTables = tableResult.rows
      .filter((row) => !row.table_exists)
      .map((row) => row.table_name);

    const checks = {
      clerkAuthContext: {
        ok: Boolean(authContext.userId),
        userId: authContext.userId,
        role: authContext.role,
        clerkOrgId: authContext.clerkOrgId,
      },
      dbConnectivity: {
        ok: dbConnected,
      },
      requiredTables: {
        ok: missingTables.length === 0,
        missing: missingTables,
      },
    };

    const ok = checks.clerkAuthContext.ok && checks.dbConnectivity.ok && checks.requiredTables.ok;
    return NextResponse.json(
      {
        ok,
        checks,
      },
      { status: ok ? 200 : 503 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const referenceId = logServerError("app/api/dev/health", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Health check failed",
        referenceId,
      },
      { status: 500 },
    );
  }
}

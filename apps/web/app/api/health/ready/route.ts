import { NextResponse } from "next/server";
import { pgPool } from "@/lib/pg";
import { pingRedis } from "@/lib/redis-health";
import { logServerError } from "@/lib/server-error";

export const dynamic = "force-dynamic";

type DependencyCheck = {
  ok: boolean;
  latencyMs: number | null;
  detail?: string;
};

async function checkDatabase(): Promise<DependencyCheck> {
  const startedAt = Date.now();

  try {
    await pgPool.query("SELECT 1");
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  try {
    const [database, cache] = await Promise.all([checkDatabase(), pingRedis()]);
    const ok = database.ok && cache.ok;

    return NextResponse.json(
      {
        ok,
        service: "web",
        timestamp: new Date().toISOString(),
        checks: {
          database,
          cache,
        },
      },
      { status: ok ? 200 : 503 },
    );
  } catch (error) {
    const referenceId = logServerError("app/api/health/ready", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Readiness check failed",
        referenceId,
      },
      { status: 500 },
    );
  }
}

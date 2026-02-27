import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { exportUserData } from "@/lib/privacy";
import { logServerError } from "@/lib/server-error";

export async function GET() {
  try {
    const userId = await requireUserId();
    const payload = await exportUserData(userId);
    const filename = `pipelineiq-data-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export user data";
    const status = message === "Unauthorized" ? 401 : 500;
    const referenceId = logServerError("app/api/privacy/export", error, { status });

    return NextResponse.json({ error: message, referenceId }, { status });
  }
}

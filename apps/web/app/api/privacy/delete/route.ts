import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { processPrivacyRequest, type PrivacyRequestMode } from "@/lib/privacy";
import { logServerError } from "@/lib/server-error";

type DeleteRequestBody = {
  mode?: PrivacyRequestMode;
  confirmation?: string;
};

function toMode(value: unknown): PrivacyRequestMode {
  return value === "anonymize" ? "anonymize" : "delete";
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();

    let body: DeleteRequestBody = {};
    try {
      body = (await request.json()) as DeleteRequestBody;
    } catch {
      body = {};
    }

    const mode = toMode(body.mode);

    if (mode === "delete" && body.confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Missing confirmation. Send { confirmation: 'DELETE' } to permanently delete." },
        { status: 400 },
      );
    }

    const summary = await processPrivacyRequest(userId, mode);

    return NextResponse.json({ ok: true, mode, summary }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process privacy request";
    const status = message === "Unauthorized" ? 401 : 500;
    const referenceId = logServerError("app/api/privacy/delete", error, { status });

    return NextResponse.json({ error: message, referenceId }, { status });
  }
}

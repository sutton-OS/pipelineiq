import { NextResponse } from "next/server";

async function enqueueHello() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Dev enqueue endpoint is deprecated. Use /dashboard/intake or /dashboard/inbound-sim to create real jobs.",
  });
}

export async function POST() {
  return enqueueHello();
}

export async function GET() {
  return enqueueHello();
}

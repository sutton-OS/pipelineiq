import { NextResponse } from "next/server";

async function enqueueHello() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { pgPool } = await import("@/lib/pg");

  await pgPool.query(
    `
      INSERT INTO jobs (org_id, location_id, type, run_at, payload_json)
      VALUES ($1, $2, $3, now(), $4::jsonb)
    `,
    [
      "dev-org",
      "dev-location",
      "hello_world",
      JSON.stringify({ msg: "hello from web" }),
    ],
  );

  return NextResponse.json({ ok: true });
}

export async function POST() {
  return enqueueHello();
}

export async function GET() {
  return enqueueHello();
}

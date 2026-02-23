import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../db";
import { __testables } from "../runner";
import {
  DEFAULT_AUTONOMY_MODE,
  DEFAULT_BOOKING_PROVIDER,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_THROTTLE_CAPS,
  DEFAULT_TEMPLATES,
  ensureSchema,
} from "../schema";

function canRunIntegrationTests(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.WORKER_DATABASE_URL);
}

async function ensureDbAvailable(): Promise<boolean> {
  if (!canRunIntegrationTests()) {
    return false;
  }

  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function createOrgAndLocation(seed: string): Promise<{ orgId: string; locationId: string }> {
  const orgInsert = await pool.query<{ id: string }>(
    `
      INSERT INTO orgs (owner_user_id, name, slug)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [`retry-user-${seed}`, `Retry Org ${seed}`, `retry-org-${seed}`],
  );
  const orgId = orgInsert.rows[0]?.id;
  assert.ok(orgId);

  const locationInsert = await pool.query<{ id: string }>(
    `
      INSERT INTO locations (
        org_id,
        name,
        timezone,
        autonomy_mode,
        booking_provider,
        booking_settings_json,
        business_hours_json,
        templates_json,
        throttle_caps_json
      )
      VALUES ($1, 'Retry Location', 'America/New_York', $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)
      RETURNING id
    `,
    [
      orgId,
      DEFAULT_AUTONOMY_MODE,
      DEFAULT_BOOKING_PROVIDER,
      JSON.stringify(DEFAULT_BOOKING_SETTINGS),
      JSON.stringify(DEFAULT_BUSINESS_HOURS),
      JSON.stringify(DEFAULT_TEMPLATES),
      JSON.stringify(DEFAULT_THROTTLE_CAPS),
    ],
  );
  const locationId = locationInsert.rows[0]?.id;
  assert.ok(locationId);

  return { orgId, locationId };
}

test("failed job is retried with backoff until max attempts", async (t) => {
  if (!(await ensureDbAvailable())) {
    t.skip("DATABASE_URL/WORKER_DATABASE_URL not configured or Postgres unavailable");
    return;
  }

  await ensureSchema();
  const seed = Date.now().toString();
  const { orgId, locationId } = await createOrgAndLocation(seed);

  try {
    await pool.query(
      `
        INSERT INTO jobs (org_id, location_id, type, run_at, max_attempts, payload_json)
        VALUES ($1, $2, 'send_outbound', now(), 3, $3::jsonb)
      `,
      [
        orgId,
        locationId,
        JSON.stringify({
          orgId,
          locationId,
          messageId: "missing-message-id",
        }),
      ],
    );

    const claimed = await __testables.claimDueJobs(1);
    assert.equal(claimed.length, 1);
    await __testables.handleClaimedJob(claimed[0]);

    const jobRow = await pool.query<{
      status: string;
      attempts: number;
      last_error: string | null;
      finished_at: string | null;
      seconds_until_run: string;
    }>(
      `
        SELECT
          status,
          attempts,
          last_error,
          finished_at,
          EXTRACT(EPOCH FROM (run_at - now()))::text AS seconds_until_run
        FROM jobs
        WHERE id = $1
      `,
      [claimed[0]?.id],
    );

    assert.equal(jobRow.rows[0]?.status, "queued");
    assert.equal(jobRow.rows[0]?.attempts, 1);
    assert.equal((jobRow.rows[0]?.last_error ?? "").includes("message_not_found"), true);
    assert.equal(jobRow.rows[0]?.finished_at, null);
    assert.equal(Number(jobRow.rows[0]?.seconds_until_run ?? "0") > 0, true);
  } finally {
    await pool.query(`DELETE FROM orgs WHERE id = $1`, [orgId]);
  }
});

test("job is dead-lettered when max attempts is reached", async (t) => {
  if (!(await ensureDbAvailable())) {
    t.skip("DATABASE_URL/WORKER_DATABASE_URL not configured or Postgres unavailable");
    return;
  }

  await ensureSchema();
  const seed = `${Date.now()}-dead`;
  const { orgId, locationId } = await createOrgAndLocation(seed);

  try {
    await pool.query(
      `
        INSERT INTO jobs (org_id, location_id, type, run_at, max_attempts, payload_json)
        VALUES ($1, $2, 'send_outbound', now(), 1, $3::jsonb)
      `,
      [
        orgId,
        locationId,
        JSON.stringify({
          orgId,
          locationId,
          messageId: "missing-message-id-dead",
        }),
      ],
    );

    const claimed = await __testables.claimDueJobs(1);
    assert.equal(claimed.length, 1);
    await __testables.handleClaimedJob(claimed[0]);

    const jobRow = await pool.query<{
      status: string;
      attempts: number;
      last_error: string | null;
      finished_at: string | null;
    }>(
      `
        SELECT status, attempts, last_error, finished_at
        FROM jobs
        WHERE id = $1
      `,
      [claimed[0]?.id],
    );

    assert.equal(jobRow.rows[0]?.status, "dead");
    assert.equal(jobRow.rows[0]?.attempts, 1);
    assert.equal((jobRow.rows[0]?.last_error ?? "").includes("message_not_found"), true);
    assert.equal(Boolean(jobRow.rows[0]?.finished_at), true);
  } finally {
    await pool.query(`DELETE FROM orgs WHERE id = $1`, [orgId]);
  }
});

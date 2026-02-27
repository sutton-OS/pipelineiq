import { pool, query } from "./db";
import {
  DEFAULT_AUTONOMY_MODE,
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_BOOKING_PROVIDER,
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_THROTTLE_CAPS,
  DEFAULT_TEMPLATES,
  ensureSchema,
} from "./schema";

async function main(): Promise<void> {
  await ensureSchema();

  const insertedOrgResult = await query<{ id: string }>(
    `
      INSERT INTO orgs (owner_user_id, name, slug)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    ["dev-user-123", "PipelineIQ Demo Org", "pipelineiq-demo-org"],
  );

  const orgId =
    insertedOrgResult.rows[0]?.id ??
    (
      await query<{ id: string }>(
        `
          SELECT id
          FROM orgs
          WHERE owner_user_id = $1
            AND lower(name) = lower($2)
          LIMIT 1
        `,
        ["dev-user-123", "PipelineIQ Demo Org"],
      )
    ).rows[0]?.id;

  if (!orgId) {
    throw new Error("Failed to resolve seeded org");
  }

  const locationResult = await query<{ id: string }>(
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
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
      ON CONFLICT (org_id, name)
      DO UPDATE SET
        timezone = EXCLUDED.timezone,
        autonomy_mode = EXCLUDED.autonomy_mode,
        booking_provider = EXCLUDED.booking_provider,
        booking_settings_json = EXCLUDED.booking_settings_json,
        business_hours_json = EXCLUDED.business_hours_json,
        templates_json = EXCLUDED.templates_json,
        throttle_caps_json = EXCLUDED.throttle_caps_json,
        updated_at = now()
      RETURNING id
    `,
    [
      orgId,
      "Main Location",
      "America/New_York",
      DEFAULT_AUTONOMY_MODE,
      DEFAULT_BOOKING_PROVIDER,
      JSON.stringify(DEFAULT_BOOKING_SETTINGS),
      JSON.stringify(DEFAULT_BUSINESS_HOURS),
      JSON.stringify(DEFAULT_TEMPLATES),
      JSON.stringify(DEFAULT_THROTTLE_CAPS),
    ],
  );

  const locationId = locationResult.rows[0].id;

  const leadResult = await query<{ id: string }>(
    `
      INSERT INTO leads (
        org_id,
        location_id,
        full_name,
        first_name,
        phone,
        normalized_phone,
        consent_status,
        source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (org_id, location_id, normalized_phone)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        first_name = EXCLUDED.first_name,
        phone = EXCLUDED.phone,
        consent_status = EXCLUDED.consent_status,
        source = EXCLUDED.source,
        updated_at = now()
      RETURNING id
    `,
    [
      orgId,
      locationId,
      "Demo Lead",
      "Demo",
      "+1 (555) 555-0101",
      "+15555550101",
      "consented",
      "seed",
    ],
  );

  const leadId = leadResult.rows[0].id;

  const conversationResult = await query<{ id: string }>(
    `
      INSERT INTO conversations (org_id, location_id, lead_id, state, stale_after_at)
      VALUES ($1, $2, $3, $4, now() + interval '48 hours')
      ON CONFLICT (org_id, lead_id)
      DO UPDATE SET updated_at = now()
      RETURNING id
    `,
    [orgId, locationId, leadId, "awaiting_yes"],
  );

  const conversationId = conversationResult.rows[0].id;

  await query(
    `
      INSERT INTO org_memberships (org_id, user_id, role, status)
      VALUES ($1, $2, 'owner', 'active')
      ON CONFLICT (org_id, user_id)
      DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        updated_at = now()
    `,
    [orgId, "dev-user-123"],
  );

  await query(
    `
      INSERT INTO jobs (
        org_id,
        location_id,
        type,
        dedupe_key,
        run_at,
        payload_json
      )
      VALUES ($1, $2, $3, $4, now(), $5::jsonb)
      ON CONFLICT (org_id, dedupe_key)
      DO NOTHING
    `,
    [
      orgId,
      locationId,
      "lead_created",
      `seed:lead_created:${leadId}`,
      JSON.stringify({
        orgId,
        locationId,
        leadId,
        conversationId,
        source: "seed",
      }),
    ],
  );

  console.log(`seeded org=${orgId} location=${locationId} lead=${leadId}`);
}

void main()
  .catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(error.message);
      return;
    }
    console.error(error);
  })
  .finally(async () => {
    await pool.end();
  });

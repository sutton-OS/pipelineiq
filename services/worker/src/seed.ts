import { pool, query } from "./db";
import { ensureSchema } from "./schema";

async function main(): Promise<void> {
  await ensureSchema();

  const result = await query<{ id: string }>(
    `
      INSERT INTO jobs (org_id, location_id, type, run_at, payload_json)
      VALUES ($1, $2, $3, now(), $4::jsonb)
      RETURNING id
    `,
    ["dev-org", "dev-location", "hello_world", JSON.stringify({ msg: "hello" })],
  );

  console.log(`seeded job id=${result.rows[0].id}`);
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

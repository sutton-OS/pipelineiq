import os from "node:os";
import { pool, query } from "./db";

type JobRow = {
  id: string;
  type: string;
  payload_json: unknown;
  attempts: number;
};

const POLL_INTERVAL_MS = 1000;
const CLAIM_LIMIT = 5;
const MAX_ATTEMPTS = 5;
const WORKER_ID = `${os.hostname()}/${process.pid}`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimDueJobs(limit: number): Promise<JobRow[]> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query<JobRow>(
      `
        WITH due_jobs AS (
          SELECT id
          FROM jobs
          WHERE status = 'queued' AND run_at <= now()
          ORDER BY run_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE jobs
        SET
          status = 'running',
          locked_at = now(),
          locked_by = $2,
          attempts = jobs.attempts + 1
        FROM due_jobs
        WHERE jobs.id = due_jobs.id
        RETURNING jobs.id, jobs.type, jobs.payload_json, jobs.attempts
      `,
      [limit, WORKER_ID],
    );
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function markDone(jobId: string): Promise<void> {
  await query(
    `
      UPDATE jobs
      SET
        status = 'done',
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL
      WHERE id = $1
    `,
    [jobId],
  );
}

async function markFailure(
  jobId: string,
  attempts: number,
  errorMessage: string,
): Promise<void> {
  const shouldDeadLetter = attempts >= MAX_ATTEMPTS;
  const backoffSeconds = Math.min(300, 2 ** attempts);

  if (shouldDeadLetter) {
    await query(
      `
        UPDATE jobs
        SET
          status = 'dead',
          locked_at = NULL,
          locked_by = NULL,
          last_error = $2
        WHERE id = $1
      `,
      [jobId, errorMessage],
    );
    return;
  }

  await query(
    `
      UPDATE jobs
      SET
        status = 'queued',
        run_at = now() + make_interval(secs => $3),
        locked_at = NULL,
        locked_by = NULL,
        last_error = $2
      WHERE id = $1
    `,
    [jobId, errorMessage, backoffSeconds],
  );
}

async function processJob(job: JobRow): Promise<void> {
  switch (job.type) {
    case "hello_world": {
      console.log("[job] hello_world", job.payload_json);
      return;
    }
    default: {
      throw new Error(`Unsupported job type: ${job.type}`);
    }
  }
}

async function handleClaimedJob(job: JobRow): Promise<void> {
  try {
    await processJob(job);
    await markDone(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailure(job.id, job.attempts, message);
  }
}

export async function runLoop(): Promise<never> {
  for (;;) {
    try {
      const jobs = await claimDueJobs(CLAIM_LIMIT);
      for (const job of jobs) {
        await handleClaimedJob(job);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] runLoop error: ${message}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

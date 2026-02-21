import { query } from "./db";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  type TEXT NOT NULL,
  dedupe_key TEXT,
  run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_status_run_at_idx
  ON jobs (status, run_at);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_org_dedupe_key_uidx
  ON jobs (org_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  org_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  request_json JSONB NOT NULL,
  decision_json JSONB,
  result_json JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kill_switch (
  org_id TEXT NOT NULL,
  location_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, location_id)
);
`;

export async function ensureSchema(): Promise<void> {
  await query(SCHEMA_SQL);
}

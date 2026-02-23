-- GoldBot v1 schema for PipelineIQ SaaS migration
-- Mirrors services/worker/src/schema.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT UNIQUE,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orgs_owner_user_idx ON orgs (owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS orgs_owner_name_uidx ON orgs (owner_user_id, lower(name));

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  business_hours_json JSONB NOT NULL DEFAULT '{"mon":[{"start":"09:00","end":"17:00"}],"tue":[{"start":"09:00","end":"17:00"}],"wed":[{"start":"09:00","end":"17:00"}],"thu":[{"start":"09:00","end":"17:00"}],"fri":[{"start":"09:00","end":"17:00"}],"sat":[],"sun":[]}'::jsonb,
  templates_json JSONB NOT NULL DEFAULT '{"intro":"Hi {{first_name}}, thanks for reaching out. Reply YES if you''d like to book your free trial.","follow_up":"Checking in on your trial request. Reply YES and I can help book a time.","slot_prompt":"Great. Reply with 1, 2, or 3 to pick a time: {{slot_1}}, {{slot_2}}, {{slot_3}}.","booked_confirmation":"Booked. We have you down for {{slot}}. Reply STOP to opt out.","reminder":"Reminder: your appointment is at {{slot}}. Reply if you need help.","invalid":"Sorry, I didn''t catch that. Reply YES to continue or STOP to opt out.","invalid_slot":"Please reply with 1, 2, or 3 to pick a time. Reply STOP to opt out."}'::jsonb,
  throttle_caps_json JSONB NOT NULL DEFAULT '{"per_hour":2,"per_day":6,"invalid_response_limit":3}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS locations_org_idx ON locations (org_id);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  consent_status TEXT NOT NULL DEFAULT 'unknown' CHECK (consent_status IN ('unknown', 'consented', 'revoked')),
  opted_out BOOLEAN NOT NULL DEFAULT false,
  opted_out_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, location_id, normalized_phone)
);

CREATE INDEX IF NOT EXISTS leads_org_location_created_idx ON leads (org_id, location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_org_location_opted_out_idx ON leads (org_id, location_id, opted_out);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'awaiting_yes' CHECK (state IN ('awaiting_yes', 'awaiting_time_choice', 'booked', 'needs_staff_attention', 'closed')),
  invalid_response_count INT NOT NULL DEFAULT 0,
  needs_staff_attention BOOLEAN NOT NULL DEFAULT false,
  stale_after_at TIMESTAMPTZ,
  last_transition_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  flags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, lead_id)
);

CREATE INDEX IF NOT EXISTS conversations_org_state_idx ON conversations (org_id, state, needs_staff_attention);
CREATE INDEX IF NOT EXISTS conversations_location_state_idx ON conversations (location_id, state);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL DEFAULT 'sms',
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'received', 'blocked')),
  provider_message_id TEXT,
  idempotency_key TEXT,
  error_message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_lead_direction_created_idx ON messages (lead_id, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_org_status_created_idx ON messages (org_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS messages_org_idempotency_uidx
  ON messages (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('proposed', 'booked', 'canceled')),
  idempotency_key TEXT,
  notes TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);

CREATE INDEX IF NOT EXISTS appointments_org_location_start_idx ON appointments (org_id, location_id, starts_at);
CREATE INDEX IF NOT EXISTS appointments_lead_created_idx ON appointments (lead_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_org_idempotency_uidx
  ON appointments (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  dedupe_key TEXT,
  run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'dead')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 8,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS jobs_status_run_at_idx ON jobs (status, run_at, id);
CREATE INDEX IF NOT EXISTS jobs_org_status_run_at_idx ON jobs (org_id, status, run_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_org_dedupe_key_uidx
  ON jobs (org_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  job_id BIGINT,
  action_type TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  request_json JSONB NOT NULL,
  decision_json JSONB,
  result_json JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_org_created_idx ON audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_conversation_created_idx ON audit_log (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS kill_switch (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS kill_switch_scope_uidx
  ON kill_switch (org_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS kill_switch_org_enabled_idx ON kill_switch (org_id, enabled);

-- Seed one org and one location for local development.
INSERT INTO orgs (owner_user_id, name, slug)
SELECT 'dev-user-123', 'GoldBot Demo Org', 'goldbot-demo-org'
WHERE NOT EXISTS (
  SELECT 1 FROM orgs WHERE owner_user_id = 'dev-user-123' AND name = 'GoldBot Demo Org'
);

INSERT INTO locations (
  org_id,
  name,
  timezone,
  business_hours_json,
  templates_json,
  throttle_caps_json
)
SELECT
  o.id,
  'Main Location',
  'America/New_York',
  '{"mon":[{"start":"09:00","end":"17:00"}],"tue":[{"start":"09:00","end":"17:00"}],"wed":[{"start":"09:00","end":"17:00"}],"thu":[{"start":"09:00","end":"17:00"}],"fri":[{"start":"09:00","end":"17:00"}],"sat":[],"sun":[]}'::jsonb,
  '{"intro":"Hi {{first_name}}, thanks for reaching out. Reply YES if you''d like to book your free trial.","follow_up":"Checking in on your trial request. Reply YES and I can help book a time.","slot_prompt":"Great. Reply with 1, 2, or 3 to pick a time: {{slot_1}}, {{slot_2}}, {{slot_3}}.","booked_confirmation":"Booked. We have you down for {{slot}}. Reply STOP to opt out.","reminder":"Reminder: your appointment is at {{slot}}. Reply if you need help.","invalid":"Sorry, I didn''t catch that. Reply YES to continue or STOP to opt out.","invalid_slot":"Please reply with 1, 2, or 3 to pick a time. Reply STOP to opt out."}'::jsonb,
  '{"per_hour":2,"per_day":6,"invalid_response_limit":3}'::jsonb
FROM orgs o
WHERE o.owner_user_id = 'dev-user-123'
  AND o.name = 'GoldBot Demo Org'
  AND NOT EXISTS (
    SELECT 1
    FROM locations l
    WHERE l.org_id = o.id
      AND l.name = 'Main Location'
  );

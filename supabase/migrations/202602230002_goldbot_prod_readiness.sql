-- GoldBot production-readiness extensions:
-- - RBAC memberships
-- - per-location autonomy mode + booking provider config
-- - provider IDs/payload on appointments

CREATE TABLE IF NOT EXISTS org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_memberships_user_idx ON org_memberships (user_id);
CREATE INDEX IF NOT EXISTS org_memberships_org_role_idx ON org_memberships (org_id, role, status);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS autonomy_mode TEXT NOT NULL DEFAULT 'safe_auto';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS booking_provider TEXT NOT NULL DEFAULT 'none';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS booking_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS provider_appointment_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS provider_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_provider_id_uidx
  ON appointments (org_id, provider, provider_appointment_id)
  WHERE provider_appointment_id IS NOT NULL;

INSERT INTO org_memberships (org_id, user_id, role, status)
SELECT id, owner_user_id, 'owner', 'active'
FROM orgs
WHERE owner_user_id IS NOT NULL
ON CONFLICT (org_id, user_id)
DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = now();

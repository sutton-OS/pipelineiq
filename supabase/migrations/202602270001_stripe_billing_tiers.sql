-- Stripe billing subscription lifecycle support:
-- - single Pro pricing
-- - trial windows
-- - invoice/receipt tracking fields

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  active_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS last_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS last_invoice_pdf TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_subscriptions_plan_tier_check'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD CONSTRAINT user_subscriptions_plan_tier_check
      CHECK (plan_tier IN ('free', 'pro'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_user_uidx
  ON user_subscriptions (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_customer_uidx
  ON user_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_subscription_uidx
  ON user_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_subscriptions_status_plan_idx
  ON user_subscriptions (status, plan_tier);

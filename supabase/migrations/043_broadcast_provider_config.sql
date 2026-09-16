-- ============================================================
-- 043_broadcast_provider_config.sql
--
-- Account-scoped credentials for Email and SMS broadcast channels.
-- Mirrors the patterns used by `whatsapp_config` and `ai_configs`:
-- any account member can read the config for status display, but only
-- admin+ may create/update/delete it.
-- ============================================================

CREATE TABLE IF NOT EXISTS broadcast_provider_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  mailchimp_api_key text,
  mailchimp_from_email text,
  mailchimp_from_name text DEFAULT 'Andalabot',

  twilio_account_sid text,
  twilio_auth_token text,
  twilio_from_number text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE broadcast_provider_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broadcast_provider_config_select ON broadcast_provider_config;
CREATE POLICY broadcast_provider_config_select ON broadcast_provider_config FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS broadcast_provider_config_insert ON broadcast_provider_config;
CREATE POLICY broadcast_provider_config_insert ON broadcast_provider_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS broadcast_provider_config_update ON broadcast_provider_config;
CREATE POLICY broadcast_provider_config_update ON broadcast_provider_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS broadcast_provider_config_delete ON broadcast_provider_config;
CREATE POLICY broadcast_provider_config_delete ON broadcast_provider_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

CREATE OR REPLACE FUNCTION public.update_broadcast_provider_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broadcast_provider_config_updated_at ON broadcast_provider_config;
CREATE TRIGGER broadcast_provider_config_updated_at
  BEFORE UPDATE ON broadcast_provider_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_broadcast_provider_config_updated_at();

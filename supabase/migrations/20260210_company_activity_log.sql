-- Company Activity Log — Ambient Team Awareness
-- Tracks view, export, and triage actions per company per user

CREATE TABLE IF NOT EXISTS company_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain TEXT NOT NULL,
  user_name TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('view','export','triage')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cal_domain_recent ON company_activity_log(company_domain, created_at DESC);
CREATE INDEX idx_cal_recent ON company_activity_log(created_at DESC);

-- RLS
ALTER TABLE company_activity_log ENABLE ROW LEVEL SECURITY;

-- service_role: full access
CREATE POLICY "service_role_all" ON company_activity_log FOR ALL USING (auth.role() = 'service_role');

-- anon: insert + select
CREATE POLICY "anon_select" ON company_activity_log FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON company_activity_log FOR INSERT WITH CHECK (true);

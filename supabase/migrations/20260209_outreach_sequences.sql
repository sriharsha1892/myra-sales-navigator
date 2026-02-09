-- =============================================================
-- myRA Sales Navigator — Outreach Sequences Migration
-- 2026-02-09
-- =============================================================
-- Tables: outreach_drafts, user_config, call_logs,
--         outreach_sequences, outreach_enrollments, outreach_step_logs
-- =============================================================

-- -----------------------------------------------
-- 1. outreach_drafts — fire-and-forget draft log
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_drafts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id     TEXT,
  contact_email  TEXT,
  company_domain TEXT,
  channel        TEXT NOT NULL,
  template       TEXT,
  tone           TEXT,
  generated_by   TEXT,
  subject        TEXT,
  message        TEXT NOT NULL,
  writing_rules  TEXT,
  generated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_drafts_contact ON outreach_drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_domain  ON outreach_drafts(company_domain);

-- -----------------------------------------------
-- 2. user_config — per-user settings
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS user_config (
  user_name             TEXT PRIMARY KEY,
  freshsales_domain     TEXT,
  has_linkedin_sales_nav BOOLEAN DEFAULT FALSE,
  preferences           JSONB DEFAULT '{}'::jsonb,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------
-- 3. call_logs — call outcome tracking
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS call_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id       TEXT NOT NULL,
  company_domain   TEXT NOT NULL,
  user_name        TEXT NOT NULL,
  outcome          TEXT NOT NULL CHECK (outcome IN ('connected', 'voicemail', 'no_answer', 'busy', 'wrong_number')),
  notes            TEXT,
  duration_seconds INT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_contact ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_domain  ON call_logs(company_domain);

-- -----------------------------------------------
-- 4. outreach_sequences — sequence definitions
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_by  TEXT NOT NULL,
  is_template BOOLEAN DEFAULT FALSE,
  steps       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------
-- 5. outreach_enrollments — contact-sequence enrollments
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id      UUID NOT NULL REFERENCES outreach_sequences(id),
  contact_id       TEXT NOT NULL,
  company_domain   TEXT NOT NULL,
  enrolled_by      TEXT NOT NULL,
  current_step     INT DEFAULT 0,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed', 'unenrolled')),
  next_step_due_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_sequence   ON outreach_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact    ON outreach_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status     ON outreach_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_due        ON outreach_enrollments(next_step_due_at);

-- -----------------------------------------------
-- 6. outreach_step_logs — step execution logs
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_step_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id  UUID NOT NULL REFERENCES outreach_enrollments(id),
  step_index     INT NOT NULL,
  channel        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at   TIMESTAMPTZ,
  outcome        TEXT,
  notes          TEXT,
  draft_content  TEXT
);

CREATE INDEX IF NOT EXISTS idx_step_logs_enrollment ON outreach_step_logs(enrollment_id);

-- -----------------------------------------------
-- Row-Level Security
-- -----------------------------------------------

ALTER TABLE outreach_drafts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sequences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_step_logs   ENABLE ROW LEVEL SECURITY;

-- service_role: full access
DROP POLICY IF EXISTS "service_role_all" ON outreach_drafts;
DROP POLICY IF EXISTS "service_role_all" ON user_config;
DROP POLICY IF EXISTS "service_role_all" ON call_logs;
DROP POLICY IF EXISTS "service_role_all" ON outreach_sequences;
DROP POLICY IF EXISTS "service_role_all" ON outreach_enrollments;
DROP POLICY IF EXISTS "service_role_all" ON outreach_step_logs;

CREATE POLICY "service_role_all" ON outreach_drafts      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON user_config          FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON call_logs            FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON outreach_sequences   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON outreach_enrollments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON outreach_step_logs   FOR ALL USING (auth.role() = 'service_role');

-- anon: read + write on outreach_drafts
DROP POLICY IF EXISTS "anon_select" ON outreach_drafts;
DROP POLICY IF EXISTS "anon_insert" ON outreach_drafts;
CREATE POLICY "anon_select" ON outreach_drafts FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON outreach_drafts FOR INSERT WITH CHECK (true);

-- anon: read + write on user_config
DROP POLICY IF EXISTS "anon_select" ON user_config;
DROP POLICY IF EXISTS "anon_insert" ON user_config;
DROP POLICY IF EXISTS "anon_update" ON user_config;
CREATE POLICY "anon_select" ON user_config FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON user_config FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON user_config FOR UPDATE USING (true);

-- anon: read + write on call_logs
DROP POLICY IF EXISTS "anon_select" ON call_logs;
DROP POLICY IF EXISTS "anon_insert" ON call_logs;
CREATE POLICY "anon_select" ON call_logs FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON call_logs FOR INSERT WITH CHECK (true);

-- anon: read + write on outreach_sequences
DROP POLICY IF EXISTS "anon_select" ON outreach_sequences;
DROP POLICY IF EXISTS "anon_insert" ON outreach_sequences;
DROP POLICY IF EXISTS "anon_update" ON outreach_sequences;
CREATE POLICY "anon_select" ON outreach_sequences FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON outreach_sequences FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON outreach_sequences FOR UPDATE USING (true);

-- anon: read + write on outreach_enrollments
DROP POLICY IF EXISTS "anon_select" ON outreach_enrollments;
DROP POLICY IF EXISTS "anon_insert" ON outreach_enrollments;
DROP POLICY IF EXISTS "anon_update" ON outreach_enrollments;
CREATE POLICY "anon_select" ON outreach_enrollments FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON outreach_enrollments FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON outreach_enrollments FOR UPDATE USING (true);

-- anon: read + write on outreach_step_logs
DROP POLICY IF EXISTS "anon_select" ON outreach_step_logs;
DROP POLICY IF EXISTS "anon_insert" ON outreach_step_logs;
DROP POLICY IF EXISTS "anon_update" ON outreach_step_logs;
CREATE POLICY "anon_select" ON outreach_step_logs FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON outreach_step_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON outreach_step_logs FOR UPDATE USING (true);

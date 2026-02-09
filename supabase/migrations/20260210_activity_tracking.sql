-- Activity Tracking: Sessions, Search Performance, Clipboard Logging

-- 1. User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name           TEXT NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  search_count        INT NOT NULL DEFAULT 0,
  export_count        INT NOT NULL DEFAULT 0,
  company_view_count  INT NOT NULL DEFAULT 0,
  triage_count        INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_name, started_at DESC);

-- RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON user_sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_select" ON user_sessions FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON user_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON user_sessions FOR UPDATE USING (true);

-- 2. Search performance columns on existing search_history table
ALTER TABLE search_history
  ADD COLUMN IF NOT EXISTS total_duration_ms     INTEGER,
  ADD COLUMN IF NOT EXISTS reformulation_ms      INTEGER,
  ADD COLUMN IF NOT EXISTS exa_duration_ms       INTEGER,
  ADD COLUMN IF NOT EXISTS apollo_duration_ms    INTEGER,
  ADD COLUMN IF NOT EXISTS nl_icp_scoring_ms     INTEGER,
  ADD COLUMN IF NOT EXISTS exa_cache_hit         BOOLEAN,
  ADD COLUMN IF NOT EXISTS exa_result_count      INTEGER,
  ADD COLUMN IF NOT EXISTS apollo_enriched_count INTEGER,
  ADD COLUMN IF NOT EXISTS high_fit_count        INTEGER,
  ADD COLUMN IF NOT EXISTS exa_error             TEXT,
  ADD COLUMN IF NOT EXISTS apollo_error          TEXT,
  ADD COLUMN IF NOT EXISTS nl_icp_error          TEXT,
  ADD COLUMN IF NOT EXISTS query_text            TEXT;

-- 3. Add email_copy + excel to contact_extractions destination CHECK
ALTER TABLE contact_extractions
  DROP CONSTRAINT IF EXISTS contact_extractions_destination_check,
  ADD CONSTRAINT contact_extractions_destination_check
    CHECK (destination IN ('clipboard', 'csv', 'clearout', 'apollo', 'email_copy', 'excel'));

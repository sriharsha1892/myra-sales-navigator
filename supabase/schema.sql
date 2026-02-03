-- =============================================================
-- myRA Sales Navigator — Schema (Anchor + Cache Model)
-- =============================================================
--
-- Setup instructions:
--   1. Go to supabase.com → New Project
--   2. Name: myra-sales-navigator, region: pick nearest
--   3. Copy Project URL        → .env.local  NEXT_PUBLIC_SUPABASE_URL
--   4. Copy anon key           → .env.local  NEXT_PUBLIC_SUPABASE_ANON_KEY
--   5. Copy service_role key   → .env.local  SUPABASE_SERVICE_ROLE_KEY
--   6. Open SQL Editor → paste this file → Run
--   7. Open SQL Editor → paste seed.sql  → Run
--   8. Verify: Table Editor should show 8 tables with seed data
-- =============================================================

-- Drop old tables if migrating
DROP TABLE IF EXISTS signals CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS company_notes CASCADE;
DROP TABLE IF EXISTS contact_extractions CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS exclusions CASCADE;
DROP TABLE IF EXISTS search_presets CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS admin_config CASCADE;

-- -----------------------------------------------
-- 1. admin_config — single-row global config
-- -----------------------------------------------
CREATE TABLE admin_config (
  id                text PRIMARY KEY DEFAULT 'global',
  icp_weights       jsonb NOT NULL DEFAULT '{}',
  verticals         jsonb NOT NULL DEFAULT '[]',
  size_sweet_spot   jsonb NOT NULL DEFAULT '{}',
  signal_types      jsonb NOT NULL DEFAULT '[]',
  team_members      jsonb NOT NULL DEFAULT '[]',
  cache_durations   jsonb NOT NULL DEFAULT '{}',
  copy_formats      jsonb NOT NULL DEFAULT '[]',
  default_copy_format text,
  api_keys          jsonb NOT NULL DEFAULT '[]',
  data_sources      jsonb NOT NULL DEFAULT '[]',
  export_settings   jsonb NOT NULL DEFAULT '{}',
  email_verification jsonb NOT NULL DEFAULT '{}',
  scoring_settings  jsonb NOT NULL DEFAULT '{}',
  rate_limits       jsonb NOT NULL DEFAULT '{}',
  notifications     jsonb NOT NULL DEFAULT '{}',
  data_retention    jsonb NOT NULL DEFAULT '{}',
  auth_settings     jsonb NOT NULL DEFAULT '{}',
  ui_preferences    jsonb NOT NULL DEFAULT '{}',
  email_prompts     jsonb NOT NULL DEFAULT '{}',
  analytics_settings jsonb NOT NULL DEFAULT '{}',
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 2. exclusions
-- -----------------------------------------------
CREATE TABLE exclusions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL CHECK (type IN ('company', 'domain', 'email')),
  value      text NOT NULL,
  reason     text,
  added_by   text NOT NULL,
  source     text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv_upload')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 3. search_presets
-- -----------------------------------------------
CREATE TABLE search_presets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  filters    jsonb NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 4. companies — lightweight anchor (domain PK)
-- -----------------------------------------------
CREATE TABLE companies (
  domain              text PRIMARY KEY,
  name                text NOT NULL,
  first_viewed_by     text NOT NULL,
  first_viewed_at     timestamptz NOT NULL DEFAULT now(),
  last_viewed_by      text NOT NULL,
  last_viewed_at      timestamptz NOT NULL DEFAULT now(),
  source              text NOT NULL DEFAULT 'exa',
  note_count          integer NOT NULL DEFAULT 0,
  last_note_at        timestamptz,
  extraction_count    integer NOT NULL DEFAULT 0,
  last_extraction_at  timestamptz,
  excluded            boolean NOT NULL DEFAULT false,
  excluded_by         text,
  excluded_at         timestamptz,
  exclusion_reason    text,
  status              text NOT NULL DEFAULT 'new',
  status_changed_by   text,
  status_changed_at   timestamptz,
  viewed_by           text
);

-- -----------------------------------------------
-- 5. company_notes
-- -----------------------------------------------
CREATE TABLE company_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain  text NOT NULL REFERENCES companies(domain) ON DELETE CASCADE,
  content         text NOT NULL,
  author_name     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz,
  mentions        jsonb DEFAULT '[]'
);

-- -----------------------------------------------
-- 6. contact_extractions
-- -----------------------------------------------
CREATE TABLE contact_extractions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_domain  text NOT NULL REFERENCES companies(domain) ON DELETE CASCADE,
  extracted_by    text NOT NULL,
  extracted_at    timestamptz NOT NULL DEFAULT now(),
  destination     text NOT NULL CHECK (destination IN ('clipboard', 'csv', 'clearout', 'apollo')),
  contacts        jsonb NOT NULL DEFAULT '[]'
);

-- -----------------------------------------------
-- 7. user_settings
-- -----------------------------------------------
CREATE TABLE user_settings (
  user_name          text PRIMARY KEY,
  default_copy_format text,
  default_view       text NOT NULL DEFAULT 'companies',
  default_sort       jsonb NOT NULL DEFAULT '{"field":"icp_score","direction":"desc"}',
  panel_widths       jsonb NOT NULL DEFAULT '{"left":280,"center":0,"right":400}',
  recent_domains     jsonb NOT NULL DEFAULT '[]',
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 8. search_history
-- -----------------------------------------------
CREATE TABLE search_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name    text NOT NULL,
  filters      jsonb NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  label        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 9. api_key_audit_log
-- -----------------------------------------------
CREATE TABLE api_key_audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id  text NOT NULL,
  action     text NOT NULL CHECK (action IN ('created', 'rotated', 'tested', 'deleted')),
  actor      text NOT NULL,
  result     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- Triggers
-- -----------------------------------------------

-- Auto-update companies.note_count and last_note_at on INSERT/DELETE to company_notes
CREATE OR REPLACE FUNCTION fn_note_stats() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE companies
    SET note_count = note_count + 1,
        last_note_at = NEW.created_at
    WHERE domain = NEW.company_domain;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE companies
    SET note_count = GREATEST(note_count - 1, 0),
        last_note_at = (
          SELECT MAX(created_at) FROM company_notes
          WHERE company_domain = OLD.company_domain AND id != OLD.id
        )
    WHERE domain = OLD.company_domain;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_note_stats
  AFTER INSERT OR DELETE ON company_notes
  FOR EACH ROW EXECUTE FUNCTION fn_note_stats();

-- Auto-update companies.extraction_count and last_extraction_at on INSERT to contact_extractions
CREATE OR REPLACE FUNCTION fn_extraction_stats() RETURNS trigger AS $$
BEGIN
  UPDATE companies
  SET extraction_count = extraction_count + 1,
      last_extraction_at = NEW.extracted_at
  WHERE domain = NEW.company_domain;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_extraction_stats
  AFTER INSERT ON contact_extractions
  FOR EACH ROW EXECUTE FUNCTION fn_extraction_stats();

-- -----------------------------------------------
-- Indexes
-- -----------------------------------------------
CREATE INDEX idx_companies_excluded        ON companies(excluded) WHERE excluded = true;
CREATE INDEX idx_company_notes_domain      ON company_notes(company_domain);
CREATE INDEX idx_contact_extractions_domain ON contact_extractions(company_domain);
CREATE INDEX idx_exclusions_value          ON exclusions(value);
CREATE INDEX idx_exclusions_type           ON exclusions(type);
CREATE INDEX idx_search_history_user_date  ON search_history(user_name, created_at DESC);

-- -----------------------------------------------
-- Row-Level Security
-- -----------------------------------------------

-- Enable RLS on all tables
ALTER TABLE admin_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exclusions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_presets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history      ENABLE ROW LEVEL SECURITY;

-- service_role: full access on all tables
CREATE POLICY "service_role_all" ON admin_config        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON exclusions          FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON search_presets      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON companies           FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON company_notes       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON contact_extractions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON user_settings       FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all" ON search_history      FOR ALL USING (auth.role() = 'service_role');

-- anon: read-only on reference tables
CREATE POLICY "anon_read" ON admin_config   FOR SELECT USING (true);
CREATE POLICY "anon_read" ON search_presets FOR SELECT USING (true);

-- anon: read + write on companies (anchors created on view)
CREATE POLICY "anon_select" ON companies FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON companies FOR UPDATE USING (true);

-- anon: read + write on company_notes
CREATE POLICY "anon_select" ON company_notes FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON company_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON company_notes FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON company_notes FOR DELETE USING (true);

-- anon: read + write on contact_extractions
CREATE POLICY "anon_select" ON contact_extractions FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON contact_extractions FOR INSERT WITH CHECK (true);

-- anon: full CRUD on exclusions
CREATE POLICY "anon_select" ON exclusions FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON exclusions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON exclusions FOR UPDATE USING (true);
CREATE POLICY "anon_delete" ON exclusions FOR DELETE USING (true);

-- anon: read + write on user_settings
CREATE POLICY "anon_select" ON user_settings FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON user_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON user_settings FOR UPDATE USING (true);

-- anon: read + write on search_history
CREATE POLICY "anon_select" ON search_history FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON search_history FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update" ON search_history FOR UPDATE USING (true);

-- api_key_audit_log: RLS
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON api_key_audit_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_select" ON api_key_audit_log FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON api_key_audit_log FOR INSERT WITH CHECK (true);

-- api_key_audit_log: indexes
CREATE INDEX idx_api_key_audit_source ON api_key_audit_log(source_id, created_at DESC);

-- -----------------------------------------------
-- exported_contacts — track which contacts were exported
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS exported_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_email   TEXT NOT NULL,
  contact_name    TEXT,
  company_domain  TEXT NOT NULL,
  exported_by     TEXT NOT NULL,
  exported_at     TIMESTAMPTZ DEFAULT NOW(),
  export_format   TEXT
);

CREATE INDEX idx_ec_email  ON exported_contacts(contact_email);
CREATE INDEX idx_ec_domain ON exported_contacts(company_domain);

ALTER TABLE exported_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON exported_contacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_select" ON exported_contacts FOR SELECT USING (true);
CREATE POLICY "anon_insert" ON exported_contacts FOR INSERT WITH CHECK (true);

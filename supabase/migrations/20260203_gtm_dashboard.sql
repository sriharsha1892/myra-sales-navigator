-- GTM Dashboard Schema + Seed Data
-- Created: 2026-02-03

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS gtm_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gtm_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT NOT NULL,
  account_manager TEXT,
  lead_source TEXT,
  cost_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  conversations INTEGER NOT NULL DEFAULT 0,
  users_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gtm_organizations_segment ON gtm_organizations(segment);

CREATE TABLE IF NOT EXISTS gtm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unique_id TEXT,
  email TEXT,
  name TEXT,
  organization_id UUID REFERENCES gtm_organizations(id) ON DELETE CASCADE,
  account_manager TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gtm_contacts_org ON gtm_contacts(organization_id);

CREATE TABLE IF NOT EXISTS gtm_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gtm_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES gtm_snapshots(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gtm_lead_gen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES gtm_snapshots(id) ON DELETE SET NULL,
  inbound_total INTEGER NOT NULL DEFAULT 0,
  inbound_active INTEGER NOT NULL DEFAULT 0,
  inbound_junk INTEGER NOT NULL DEFAULT 0,
  outbound_leads INTEGER NOT NULL DEFAULT 0,
  outbound_reached INTEGER NOT NULL DEFAULT 0,
  outbound_followed INTEGER NOT NULL DEFAULT 0,
  outbound_qualified INTEGER NOT NULL DEFAULT 0,
  apollo_contacts INTEGER NOT NULL DEFAULT 0,
  apollo_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gtm_updates_snapshot ON gtm_updates(snapshot_id);
CREATE INDEX idx_gtm_lead_gen_snapshot ON gtm_lead_gen(snapshot_id);

CREATE TABLE IF NOT EXISTS gtm_cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES gtm_organizations(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'incremental' CHECK (entry_type IN ('incremental', 'absolute')),
  entered_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gtm_cost_entries_org ON gtm_cost_entries(organization_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Atomic cost increment to avoid read-then-write race conditions
CREATE OR REPLACE FUNCTION gtm_increment_cost(org_id UUID, inc_amount NUMERIC)
RETURNS void AS $$
  UPDATE gtm_organizations SET cost_total = cost_total + inc_amount, updated_at = now() WHERE id = org_id;
$$ LANGUAGE SQL;

-- ============================================================================
-- SEED: Config (PIN + Roadmap Tiles)
-- ============================================================================

-- NOTE: PIN is stored as plain text in JSONB. Acceptable for internal tool with
-- 8-10 known users behind a shared password gate. Upgrade to hashed storage if
-- the tool is ever exposed beyond the team.
INSERT INTO gtm_config (key, value) VALUES
  ('pin', '"384729156042"'),
  ('roadmap_tiles', '[
    {"title": "HubSpot Push Integration", "description": "Sync qualified prospects directly to HubSpot"},
    {"title": "Sequence Builder", "description": "Create multi-step outreach sequences from Navigator"},
    {"title": "LinkedIn Enrichment", "description": "Pull LinkedIn data via Sales Nav API"},
    {"title": "Analytics Dashboard", "description": "Track team prospecting metrics and conversion rates"},
    {"title": "AI Email Personalization", "description": "Auto-generate personalized outreach from prospect data"}
  ]'),
  ('settings', '{"dashboard_title": "myRA GTM", "data_as_of": "2026-02-03"}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SEED: Organizations
-- ============================================================================

-- Paying (8)
INSERT INTO gtm_organizations (name, segment, account_manager, lead_source, cost_total, conversations, users_count) VALUES
  ('Acme Foods International', 'Paying', 'Satish Boini', 'Inbound', 4500.00, 24, 12),
  ('BlueStar Ingredients', 'Paying', 'Sudeshana Jain', 'Outbound', 3200.00, 18, 8),
  ('CrestLine Nutrition', 'Paying', 'Kirandeep Kaur', 'Inbound', 5800.00, 32, 15),
  ('Durapack Solutions', 'Paying', 'Nikita Manmode', 'Referral', 2100.00, 12, 6),
  ('EverGreen Organics', 'Paying', 'Satish Boini', 'Inbound', 6200.00, 28, 18),
  ('FreshField Farms', 'Paying', 'Sudeshana Jain', 'Outbound', 3800.00, 20, 10),
  ('GoldenHarvest Co', 'Paying', 'Kirandeep Kaur', 'Inbound', 4100.00, 22, 14),
  ('HorizonTech Labs', 'Paying', 'Nikita Manmode', 'Referral', 2900.00, 16, 9);

-- Strong Prospect (15)
INSERT INTO gtm_organizations (name, segment, account_manager, lead_source, cost_total, conversations, users_count) VALUES
  ('IronBridge Manufacturing', 'Strong Prospect', 'Satish Boini', 'Outbound', 800.00, 8, 3),
  ('JadeWater Beverages', 'Strong Prospect', 'Sudeshana Jain', 'Inbound', 1200.00, 12, 5),
  ('KingsPoint Trading', 'Strong Prospect', 'Kirandeep Kaur', 'Outbound', 600.00, 6, 2),
  ('LuminaCore Analytics', 'Strong Prospect', 'Nikita Manmode', 'Inbound', 950.00, 10, 4),
  ('MapleLeaf Distributors', 'Strong Prospect', 'Satish Boini', 'Referral', 1100.00, 9, 3),
  ('NorthStar Logistics', 'Strong Prospect', 'Sudeshana Jain', 'Outbound', 750.00, 7, 2),
  ('OceanView Exports', 'Strong Prospect', 'Kirandeep Kaur', 'Inbound', 1400.00, 14, 6),
  ('PrimeEdge Solutions', 'Strong Prospect', 'Nikita Manmode', 'Outbound', 500.00, 5, 1),
  ('QuickServe Foods', 'Strong Prospect', 'Satish Boini', 'Inbound', 1050.00, 11, 4),
  ('RedCedar Health', 'Strong Prospect', 'Sudeshana Jain', 'Referral', 880.00, 8, 3),
  ('SilverPeak Chemicals', 'Strong Prospect', 'Kirandeep Kaur', 'Outbound', 720.00, 6, 2),
  ('TrueNorth Packaging', 'Strong Prospect', 'Nikita Manmode', 'Inbound', 1300.00, 13, 5),
  ('UltraFresh Produce', 'Strong Prospect', 'Satish Boini', 'Outbound', 650.00, 5, 2),
  ('VantagePoint Corp', 'Strong Prospect', 'Sudeshana Jain', 'Inbound', 990.00, 9, 3),
  ('WestBridge Flavors', 'Strong Prospect', 'Kirandeep Kaur', 'Referral', 1150.00, 10, 4);

-- Active Trial (12)
INSERT INTO gtm_organizations (name, segment, account_manager, lead_source, cost_total, conversations, users_count) VALUES
  ('AlphaWave Systems', 'Active Trial', 'Satish Boini', 'Inbound', 0, 4, 2),
  ('BrightPath Energy', 'Active Trial', 'Sudeshana Jain', 'Outbound', 0, 3, 1),
  ('CloudNine Software', 'Active Trial', 'Kirandeep Kaur', 'Inbound', 0, 6, 3),
  ('DeltaForce Logistics', 'Active Trial', 'Nikita Manmode', 'Referral', 0, 2, 1),
  ('EchoStream Media', 'Active Trial', 'Satish Boini', 'Outbound', 0, 5, 2),
  ('FrostByte Computing', 'Active Trial', 'Sudeshana Jain', 'Inbound', 0, 4, 2),
  ('GreenLeaf Biotech', 'Active Trial', 'Kirandeep Kaur', 'Outbound', 0, 3, 1),
  ('HighTide Analytics', 'Active Trial', 'Nikita Manmode', 'Inbound', 0, 7, 4),
  ('InnovateTech Group', 'Active Trial', 'Satish Boini', 'Referral', 0, 2, 1),
  ('JetStream Dynamics', 'Active Trial', 'Sudeshana Jain', 'Outbound', 0, 5, 3),
  ('KeyStone Minerals', 'Active Trial', 'Kirandeep Kaur', 'Inbound', 0, 4, 2),
  ('LightHouse Digital', 'Active Trial', 'Nikita Manmode', 'Inbound', 0, 3, 1);

-- Post-Demo (18 placeholder orgs)
INSERT INTO gtm_organizations (name, segment, account_manager) VALUES
  ('PostDemo Org 1', 'Post-Demo', 'Satish Boini'),
  ('PostDemo Org 2', 'Post-Demo', 'Sudeshana Jain'),
  ('PostDemo Org 3', 'Post-Demo', 'Kirandeep Kaur'),
  ('PostDemo Org 4', 'Post-Demo', 'Nikita Manmode'),
  ('PostDemo Org 5', 'Post-Demo', 'Satish Boini'),
  ('PostDemo Org 6', 'Post-Demo', 'Sudeshana Jain'),
  ('PostDemo Org 7', 'Post-Demo', 'Kirandeep Kaur'),
  ('PostDemo Org 8', 'Post-Demo', 'Nikita Manmode'),
  ('PostDemo Org 9', 'Post-Demo', 'Satish Boini'),
  ('PostDemo Org 10', 'Post-Demo', 'Sudeshana Jain'),
  ('PostDemo Org 11', 'Post-Demo', 'Kirandeep Kaur'),
  ('PostDemo Org 12', 'Post-Demo', 'Nikita Manmode'),
  ('PostDemo Org 13', 'Post-Demo', 'Satish Boini'),
  ('PostDemo Org 14', 'Post-Demo', 'Sudeshana Jain'),
  ('PostDemo Org 15', 'Post-Demo', 'Kirandeep Kaur'),
  ('PostDemo Org 16', 'Post-Demo', 'Nikita Manmode'),
  ('PostDemo Org 17', 'Post-Demo', 'Satish Boini'),
  ('PostDemo Org 18', 'Post-Demo', 'Sudeshana Jain');

-- Demo Queued (17)
INSERT INTO gtm_organizations (name, segment, account_manager) VALUES
  ('DemoQ Org 1', 'Demo Queued', 'Kirandeep Kaur'),
  ('DemoQ Org 2', 'Demo Queued', 'Nikita Manmode'),
  ('DemoQ Org 3', 'Demo Queued', 'Satish Boini'),
  ('DemoQ Org 4', 'Demo Queued', 'Sudeshana Jain'),
  ('DemoQ Org 5', 'Demo Queued', 'Kirandeep Kaur'),
  ('DemoQ Org 6', 'Demo Queued', 'Nikita Manmode'),
  ('DemoQ Org 7', 'Demo Queued', 'Satish Boini'),
  ('DemoQ Org 8', 'Demo Queued', 'Sudeshana Jain'),
  ('DemoQ Org 9', 'Demo Queued', 'Kirandeep Kaur'),
  ('DemoQ Org 10', 'Demo Queued', 'Nikita Manmode'),
  ('DemoQ Org 11', 'Demo Queued', 'Satish Boini'),
  ('DemoQ Org 12', 'Demo Queued', 'Sudeshana Jain'),
  ('DemoQ Org 13', 'Demo Queued', 'Kirandeep Kaur'),
  ('DemoQ Org 14', 'Demo Queued', 'Nikita Manmode'),
  ('DemoQ Org 15', 'Demo Queued', 'Satish Boini'),
  ('DemoQ Org 16', 'Demo Queued', 'Sudeshana Jain'),
  ('DemoQ Org 17', 'Demo Queued', 'Kirandeep Kaur');

-- Dormant (30)
INSERT INTO gtm_organizations (name, segment)
SELECT 'Dormant Org ' || i, 'Dormant' FROM generate_series(1, 30) AS i;

-- Lost (20)
INSERT INTO gtm_organizations (name, segment)
SELECT 'Lost Org ' || i, 'Lost' FROM generate_series(1, 20) AS i;

-- Early/No Info (5)
INSERT INTO gtm_organizations (name, segment)
SELECT 'Early Org ' || i, 'Early/No Info' FROM generate_series(1, 5) AS i;

-- ============================================================================
-- SEED: Previous Snapshot (23 Jan 2026)
-- ============================================================================

INSERT INTO gtm_snapshots (label, snapshot_data, created_at) VALUES
  ('Week of 23 Jan 2026', '{
    "segments": {
      "Paying": {"count": 7, "cost_total": 29700, "users_total": 78, "conversations_total": 155},
      "Strong Prospect": {"count": 13, "cost_total": 11900, "users_total": 38, "conversations_total": 95},
      "Active Trial": {"count": 10, "cost_total": 0, "users_total": 18, "conversations_total": 35},
      "Post-Demo": {"count": 16, "cost_total": 0, "users_total": 0, "conversations_total": 0},
      "Demo Queued": {"count": 15, "cost_total": 0, "users_total": 0, "conversations_total": 0},
      "Dormant": {"count": 28, "cost_total": 0, "users_total": 0, "conversations_total": 0},
      "Lost": {"count": 18, "cost_total": 0, "users_total": 0, "conversations_total": 0},
      "Early/No Info": {"count": 4, "cost_total": 0, "users_total": 0, "conversations_total": 0}
    },
    "lead_gen": {
      "inbound_total": 42, "inbound_active": 18, "inbound_junk": 24,
      "outbound_leads": 120, "outbound_reached": 85, "outbound_followed": 45, "outbound_qualified": 12,
      "apollo_contacts": 350, "apollo_status": "Active"
    }
  }', '2026-01-23T10:00:00Z');

-- ============================================================================
-- SEED: Current Lead Gen Numbers
-- ============================================================================

INSERT INTO gtm_lead_gen (inbound_total, inbound_active, inbound_junk, outbound_leads, outbound_reached, outbound_followed, outbound_qualified, apollo_contacts, apollo_status) VALUES
  (56, 24, 32, 145, 102, 58, 18, 420, 'Active - 70 remaining this month');

-- ============================================================================
-- SEED: Initial Update
-- ============================================================================

INSERT INTO gtm_updates (snapshot_id, content, created_at) VALUES
  (
    (SELECT id FROM gtm_snapshots LIMIT 1),
    '<h3>GTM Status Update — 23 Jan 2026</h3><ul><li>Added 2 new paying customers (GoldenHarvest, HorizonTech)</li><li>15 strong prospects identified from Exa discovery</li><li>Apollo outbound campaign reaching 85 contacts/week</li><li>3 demos scheduled for next week</li></ul>',
    '2026-01-23T10:00:00Z'
  );

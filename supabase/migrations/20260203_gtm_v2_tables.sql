-- GTM V2 Tables — completely decoupled from gtm_organizations/snapshots
-- Three fresh tables: gtm_orgs, gtm_entries, gtm_agenda_items

-- 1. Org registry (enter once, update over time)
CREATE TABLE IF NOT EXISTS gtm_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  domain TEXT,
  segment TEXT NOT NULL DEFAULT 'early'
    CHECK (segment IN ('paying', 'prospect', 'trial', 'dormant', 'lost', 'post_demo', 'demo_queued', 'early')),
  account_manager TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  cost_usd NUMERIC DEFAULT 0,
  conversations INT DEFAULT 0,
  users INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gtm_orgs_segment ON gtm_orgs(segment);
CREATE INDEX IF NOT EXISTS idx_gtm_orgs_account_manager ON gtm_orgs(account_manager);

-- 2. Snapshot per entry date (one row = one data submission)
CREATE TABLE IF NOT EXISTS gtm_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL UNIQUE,
  created_by TEXT,

  -- Lead gen
  inbound_total INT DEFAULT 0,
  inbound_active INT DEFAULT 0,
  inbound_junk INT DEFAULT 0,
  outbound_leads INT DEFAULT 0,
  outbound_reached INT DEFAULT 0,
  outbound_followed INT DEFAULT 0,
  outbound_qualified INT DEFAULT 0,
  apollo_contacts INT DEFAULT 0,
  apollo_note TEXT,

  -- Cost economics
  total_cost_usd NUMERIC DEFAULT 0,
  cost_period TEXT,

  -- AM demos
  am_demos JSONB DEFAULT '{}',

  -- Org snapshot (frozen copy of org counts at entry time)
  org_snapshot JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gtm_entries_date ON gtm_entries(entry_date DESC);

-- 3. Meeting agenda bullets
CREATE TABLE IF NOT EXISTS gtm_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  section TEXT NOT NULL
    CHECK (section IN ('pipeline_updates', 'action_items', 'escalations', 'decisions_needed')),
  content TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_resolved BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gtm_agenda_date ON gtm_agenda_items(entry_date);
CREATE INDEX IF NOT EXISTS idx_gtm_agenda_unresolved ON gtm_agenda_items(is_resolved) WHERE is_resolved = false;

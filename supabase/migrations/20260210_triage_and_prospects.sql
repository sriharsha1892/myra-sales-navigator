-- Company triage decisions (quick review decisions per company)
create table if not exists company_decisions (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  decision text not null check (decision in ('interested', 'pass', 'skip')),
  decided_by text not null,
  decided_at timestamptz not null default now(),
  search_query text,
  unique (domain, decided_by)
);

-- Index for fast lookups
create index if not exists idx_company_decisions_domain on company_decisions(domain);

-- Prospect list (persistent company bookmarks across searches)
create table if not exists prospect_lists (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  added_by text not null,
  added_at timestamptz not null default now(),
  unique (domain, added_by)
);

create index if not exists idx_prospect_lists_added_by on prospect_lists(added_by);

-- RLS policies
alter table company_decisions enable row level security;
alter table prospect_lists enable row level security;

create policy "Service role full access on company_decisions"
  on company_decisions for all using (true) with check (true);

create policy "Service role full access on prospect_lists"
  on prospect_lists for all using (true) with check (true);

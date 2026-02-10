create table if not exists relevance_feedback (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  feedback text not null check (feedback in ('relevant', 'not_relevant')),
  reason text check (reason in ('wrong_industry', 'wrong_region', 'wrong_size', 'no_actionable_contacts', 'irrelevant_signals')),
  search_query text,
  user_name text not null,
  company_industry text,
  company_region text,
  company_size_bucket text,
  icp_score integer,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_relevance_feedback_uq on relevance_feedback(domain, user_name);
create index if not exists idx_relevance_feedback_created on relevance_feedback(created_at);
alter table relevance_feedback enable row level security;
create policy "Service role full access on relevance_feedback" on relevance_feedback for all using (true) with check (true);

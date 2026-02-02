-- =============================================================
-- myRA Sales Navigator — Seed Data (Anchor + Cache Model)
-- Run AFTER schema.sql
-- =============================================================
-- Note: Companies, contacts, and signals are no longer stored in DB.
-- They live in KV cache / mock-data.ts for dev. Only anchors, config,
-- exclusions, and presets are seeded here.

-- -----------------------------------------------
-- admin_config (1 row)
-- -----------------------------------------------
INSERT INTO admin_config (
  id, icp_weights, verticals, size_sweet_spot, signal_types, team_members,
  cache_durations, copy_formats, default_copy_format,
  api_keys, data_sources, export_settings, email_verification,
  scoring_settings, rate_limits, notifications, data_retention,
  auth_settings, ui_preferences, email_prompts
)
VALUES (
  'global',
  '{"verticalMatch":25,"sizeMatch":20,"regionMatch":15,"buyingSignals":15,"negativeSignals":-10,"exaRelevance":10,"hubspotLead":10,"hubspotCustomer":5}',
  '["Food Ingredients","Chemicals","Pharma","Packaging","Flavors & Fragrances","Specialty Chemicals","Biopharmaceuticals"]',
  '{"min":200,"max":50000}',
  '[{"type":"hiring","enabled":true},{"type":"funding","enabled":true},{"type":"expansion","enabled":true},{"type":"news","enabled":true}]',
  '[{"name":"Adi","email":"adi@ask-myra.ai","isAdmin":true},{"name":"JVS","email":"jvs@ask-myra.ai","isAdmin":true},{"name":"Reddy","email":"reddy@ask-myra.ai","isAdmin":true},{"name":"Sai","email":"sai@ask-myra.ai","isAdmin":true},{"name":"Satish","email":"satish@ask-myra.ai","isAdmin":false},{"name":"Sudeshana","email":"sudeshana@ask-myra.ai","isAdmin":false},{"name":"Kirandeep","email":"kirandeep@ask-myra.ai","isAdmin":false},{"name":"Nikita","email":"nikita@ask-myra.ai","isAdmin":false},{"name":"Asim","email":"asim@ask-myra.ai","isAdmin":false},{"name":"Satyananth","email":"satyananth@ask-myra.ai","isAdmin":false},{"name":"Aditya Prasad","email":"adityaprasad@ask-myra.ai","isAdmin":false},{"name":"Vijay Ravi","email":"vijayravi@ask-myra.ai","isAdmin":false}]',
  '{"exa":60,"apollo":120,"hubspot":30,"clearout":1440}',
  '[{"id":"cf1","name":"Standard","template":"{name} <{email}> - {title} at {company}"},{"id":"cf2","name":"Email Only","template":"{email}"},{"id":"cf3","name":"Full Detail","template":"{name}\n{title} at {company}\n{email}\n{phone}"}]',
  'cf1',
  '[]',
  '[]',
  '{"defaultFormat":"csv","csvColumns":["name","email","title","company","phone","confidence"],"confidenceThreshold":50,"autoVerifyOnExport":false,"includeCompanyContext":true}',
  '{"clearoutThreshold":70,"autoVerifyAboveConfidence":90,"dailyMaxVerifications":500,"verifyOnContactLoad":false}',
  '{"displayThreshold":0,"perSourceConfidence":{"exa":80,"apollo":90,"hubspot":85},"stalenessDecayDays":30,"stalenessDecayPercent":10}',
  '{"perSource":{"exa":{"maxPerMin":60,"warningAt":50},"apollo":{"maxPerMin":100,"warningAt":80},"hubspot":{"maxPerMin":100,"warningAt":80},"clearout":{"maxPerMin":20,"warningAt":15}},"slackWebhookUrl":null,"alertRecipients":[]}',
  '{"dailyDigest":false,"digestRecipients":[],"slackWebhookUrl":null,"alertOnRateLimit":true,"alertOnKeyExpiry":true}',
  '{"cachePurgeIntervalHours":24,"searchHistoryRetentionDays":90,"extractionLogRetentionDays":180,"autoPurge":false}',
  '{"sessionTimeoutMinutes":480,"welcomeMessage":"Welcome to myRA Sales Navigator"}',
  '{"defaultPanelWidths":{"left":280,"right":400},"defaultViewMode":"companies","autoRefreshIntervalMin":0,"showConfidenceBadges":true,"compactMode":false}',
  '{"companyDescription":"a technology company","valueProposition":"","toneInstructions":{"formal":"Use professional language. Address by Mr./Ms. + last name. Structured paragraphs.","casual":"Conversational and warm. First name basis. Short sentences. Friendly but not unprofessional.","direct":"Ultra-concise. Get to value prop in the first sentence. No small talk. Under 100 words."},"templateInstructions":{"intro":"This is a first-touch cold email. The prospect has never heard from us. Lead with a relevant insight about their company, connect it to how we can help, and end with a soft CTA.","follow_up":"This is a follow-up to a previous outreach that got no response. Reference the previous attempt briefly, add new value, and make the CTA even softer.","re_engagement":"This is a re-engagement email to someone we have spoken with before but the conversation went cold. Reference the previous interaction, share something new and relevant, and suggest reconnecting."},"systemPromptSuffix":"","defaultTone":"direct","defaultTemplate":"intro"}'
)
ON CONFLICT (id) DO UPDATE SET
  icp_weights = EXCLUDED.icp_weights,
  verticals = EXCLUDED.verticals,
  size_sweet_spot = EXCLUDED.size_sweet_spot,
  signal_types = EXCLUDED.signal_types,
  team_members = EXCLUDED.team_members,
  cache_durations = EXCLUDED.cache_durations,
  copy_formats = EXCLUDED.copy_formats,
  default_copy_format = EXCLUDED.default_copy_format,
  api_keys = EXCLUDED.api_keys,
  data_sources = EXCLUDED.data_sources,
  export_settings = EXCLUDED.export_settings,
  email_verification = EXCLUDED.email_verification,
  scoring_settings = EXCLUDED.scoring_settings,
  rate_limits = EXCLUDED.rate_limits,
  notifications = EXCLUDED.notifications,
  data_retention = EXCLUDED.data_retention,
  auth_settings = EXCLUDED.auth_settings,
  ui_preferences = EXCLUDED.ui_preferences,
  email_prompts = EXCLUDED.email_prompts,
  updated_at = now();

-- -----------------------------------------------
-- exclusions (3 rows)
-- -----------------------------------------------
INSERT INTO exclusions (id, type, value, reason, added_by, source, created_at) VALUES
('a1b2c3d4-0001-4000-8000-000000000001', 'company', 'Competitor Corp',    'Direct competitor', 'Adi',    'manual', now() - interval '30 days'),
('a1b2c3d4-0002-4000-8000-000000000002', 'domain',  'spamcompany.com',    'Known spam domain', 'Satish', 'manual', now() - interval '20 days'),
('a1b2c3d4-0003-4000-8000-000000000003', 'email',   'noreply@generic.com','Generic inbox',     'Adi',    'manual', now() - interval '15 days')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------
-- search_presets (3 rows)
-- -----------------------------------------------
INSERT INTO search_presets (id, name, filters, created_by, created_at, updated_at) VALUES
('b2c3d4e5-0001-4000-8000-000000000001', 'High-Value Food Ingredients',
 '{"sources":["exa","apollo"],"verticals":["Food Ingredients"],"regions":[],"sizes":["201-1000","1000+"],"signals":[],"hideExcluded":true,"quickFilters":["high_icp"]}',
 'Adi', now() - interval '60 days', now() - interval '10 days'),
('b2c3d4e5-0002-4000-8000-000000000002', 'European Chemicals',
 '{"sources":["exa"],"verticals":["Chemicals"],"regions":["Europe"],"sizes":[],"signals":[],"hideExcluded":true,"quickFilters":[]}',
 'Satish', now() - interval '45 days', now() - interval '45 days'),
('b2c3d4e5-0003-4000-8000-000000000003', 'Signal-Rich Targets',
 '{"sources":[],"verticals":[],"regions":[],"sizes":[],"signals":["hiring","funding","expansion"],"hideExcluded":true,"quickFilters":["has_signals"]}',
 'Nikita', now() - interval '30 days', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------
-- Sample company anchors (created when first viewed in dev)
-- -----------------------------------------------
INSERT INTO companies (domain, name, first_viewed_by, last_viewed_by, source) VALUES
('ingredion.com',    'Ingredion',     'Adi',    'Satish', 'exa'),
('lonza.com',        'Lonza Group',   'Nikita', 'Nikita', 'exa')
ON CONFLICT (domain) DO NOTHING;

-- -----------------------------------------------
-- Sample company_notes (referencing domain now)
-- -----------------------------------------------
INSERT INTO company_notes (id, company_domain, content, author_name, created_at, mentions) VALUES
('c3d4e5f6-0001-4000-8000-000000000001', 'ingredion.com', 'Met with procurement team at FiE 2024. Strong interest in our solutions.', 'Adi',    now() - interval '15 days', '[]'),
('c3d4e5f6-0002-4000-8000-000000000002', 'ingredion.com', 'Follow up scheduled for Q1. Sarah Chen is the key decision maker.',        'Satish', now() - interval '7 days',  '[]'),
('c3d4e5f6-0003-4000-8000-000000000003', 'lonza.com',     'Lonza is expanding rapidly. Good timing for outreach.',                    'Nikita', now() - interval '3 days',  '[]')
ON CONFLICT (id) DO NOTHING;

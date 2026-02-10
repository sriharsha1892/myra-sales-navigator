-- Add missing columns to admin_config that exist in code but not in live DB
-- Fixes: "Could not find the 'analytics_settings' column of 'admin_config' in the schema cache"

ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS analytics_settings jsonb NOT NULL DEFAULT '{}';
ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS enrichment_limits jsonb NOT NULL DEFAULT '{"maxSearchEnrich": 15, "maxContactAutoEnrich": 5, "maxClearoutFinds": 10}';
ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS icp_profiles jsonb NOT NULL DEFAULT '[]';
ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS freshsales_settings jsonb NOT NULL DEFAULT '{}';
ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS outreach_suggestion_rules jsonb NOT NULL DEFAULT '[]';
ALTER TABLE admin_config ADD COLUMN IF NOT EXISTS action_recommendation_rules jsonb NOT NULL DEFAULT '[]';

-- Phase 6A: Search quality observability columns
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS engine_errors JSONB DEFAULT '[]';
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]';
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS query_simplified BOOLEAN DEFAULT FALSE;
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS unenriched_count INTEGER DEFAULT 0;

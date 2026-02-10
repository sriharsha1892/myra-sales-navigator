-- Engine usage tracking for smart router budget persistence
-- Survives serverless cold starts by seeding from DB on first request

CREATE TABLE IF NOT EXISTS engine_usage (
  source TEXT NOT NULL,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source, date)
);

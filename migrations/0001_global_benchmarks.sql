-- TEZZ CONNECT global benchmark aggregates
-- Aggregate-only storage. Never store raw IPs or individual test records.
-- Public queries must enforce cohort thresholds (see docs/GLOBAL_BENCHMARKS.md).

CREATE TABLE IF NOT EXISTS benchmark_hourly (
  bucket_start TEXT NOT NULL,
  country_code TEXT NOT NULL,
  region_code TEXT NOT NULL DEFAULT 'unknown',
  -- -1 represents an unknown / unreported ASN so the WITHOUT ROWID key stays non-null.
  asn INTEGER NOT NULL DEFAULT -1 CHECK (asn >= -1),
  sample_count INTEGER NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  download_sum_mbps REAL NOT NULL DEFAULT 0,
  download_sum_sq REAL NOT NULL DEFAULT 0,
  upload_count INTEGER NOT NULL DEFAULT 0 CHECK (upload_count >= 0),
  upload_sum_mbps REAL NOT NULL DEFAULT 0,
  upload_sum_sq REAL NOT NULL DEFAULT 0,
  latency_count INTEGER NOT NULL DEFAULT 0 CHECK (latency_count >= 0),
  latency_sum_ms REAL NOT NULL DEFAULT 0,
  latency_sum_sq REAL NOT NULL DEFAULT 0,
  jitter_count INTEGER NOT NULL DEFAULT 0 CHECK (jitter_count >= 0),
  jitter_sum_ms REAL NOT NULL DEFAULT 0,
  jitter_sum_sq REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bucket_start, country_code, region_code, asn)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_benchmark_hourly_region_time
  ON benchmark_hourly (country_code, region_code, bucket_start);
CREATE INDEX IF NOT EXISTS idx_benchmark_hourly_country_time
  ON benchmark_hourly (country_code, bucket_start);

-- Daily consent totals are not linked to a user, device, or test record.
CREATE TABLE IF NOT EXISTS benchmark_consent_totals (
  day TEXT PRIMARY KEY,
  accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) WITHOUT ROWID;

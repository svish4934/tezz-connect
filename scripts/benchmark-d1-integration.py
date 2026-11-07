import sqlite3
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0001_global_benchmarks.sql"

UPSERT = """
INSERT INTO benchmark_hourly (
  bucket_start, country_code, region_code, asn, sample_count,
  download_count, download_sum_mbps, download_sum_sq,
  upload_count, upload_sum_mbps, upload_sum_sq,
  latency_count, latency_sum_ms, latency_sum_sq,
  jitter_count, jitter_sum_ms, jitter_sum_sq, updated_at
) VALUES (?, ?, ?, -1, 1, 1, ?, ?, 1, ?, ?, 1, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(bucket_start, country_code, region_code, asn) DO UPDATE SET
  sample_count = sample_count + 1,
  download_count = download_count + 1,
  download_sum_mbps = download_sum_mbps + excluded.download_sum_mbps,
  download_sum_sq = download_sum_sq + excluded.download_sum_sq,
  upload_count = upload_count + 1,
  upload_sum_mbps = upload_sum_mbps + excluded.upload_sum_mbps,
  upload_sum_sq = upload_sum_sq + excluded.upload_sum_sq,
  latency_count = latency_count + 1,
  latency_sum_ms = latency_sum_ms + excluded.latency_sum_ms,
  latency_sum_sq = latency_sum_sq + excluded.latency_sum_sq,
  jitter_count = jitter_count + 1,
  jitter_sum_ms = jitter_sum_ms + excluded.jitter_sum_ms,
  jitter_sum_sq = jitter_sum_sq + excluded.jitter_sum_sq,
  updated_at = CURRENT_TIMESTAMP
"""

SUMMARY = """
SELECT country_code, region_code,
  SUM(sample_count) AS sample_count,
  SUM(download_sum_mbps) / NULLIF(SUM(download_count), 0) AS download_avg_mbps,
  SUM(upload_sum_mbps) / NULLIF(SUM(upload_count), 0) AS upload_avg_mbps,
  SUM(latency_sum_ms) / NULLIF(SUM(latency_count), 0) AS latency_avg_ms,
  SUM(jitter_sum_ms) / NULLIF(SUM(jitter_count), 0) AS jitter_avg_ms
FROM benchmark_hourly
WHERE bucket_start >= ?
GROUP BY country_code, region_code
HAVING SUM(sample_count) >= 30
ORDER BY sample_count DESC
LIMIT 100
"""


class BenchmarkD1SqlTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))
        self.now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        self.bucket = self.now.isoformat().replace("+00:00", "Z")

    def tearDown(self):
        self.db.close()

    def submit(self, country, region, download, upload, latency, variation, bucket=None):
        self.db.execute(UPSERT, (
            bucket or self.bucket, country, region,
            download, download * download,
            upload, upload * upload,
            latency, latency * latency,
            variation, variation * variation,
        ))

    def summary(self):
        since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat().replace("+00:00", "Z")
        return self.db.execute(SUMMARY, (since,)).fetchall()

    def test_migration_creates_aggregate_tables_and_indexes(self):
        tables = {row["name"] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        self.assertIn("benchmark_hourly", tables)
        self.assertIn("benchmark_consent_totals", tables)
        indexes = {row["name"] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        )}
        self.assertIn("idx_benchmark_hourly_region_time", indexes)
        self.assertIn("idx_benchmark_hourly_country_time", indexes)

    def test_upsert_accumulates_metrics_and_squares_atomically(self):
        self.submit("US", "California", 10, 5, 20, 2)
        self.submit("US", "California", 30, 15, 40, 6)
        row = self.db.execute("SELECT * FROM benchmark_hourly").fetchone()
        self.assertEqual(row["sample_count"], 2)
        self.assertEqual(row["download_count"], 2)
        self.assertEqual(row["download_sum_mbps"], 40)
        self.assertEqual(row["download_sum_sq"], 1000)
        self.assertEqual(row["upload_sum_mbps"], 20)
        self.assertEqual(row["upload_sum_sq"], 250)
        self.assertEqual(row["latency_sum_ms"], 60)
        self.assertEqual(row["latency_sum_sq"], 2000)
        self.assertEqual(row["jitter_sum_ms"], 8)
        self.assertEqual(row["jitter_sum_sq"], 40)
        self.assertEqual(row["asn"], -1)

    def test_summary_publishes_exactly_30_and_suppresses_29(self):
        for value in range(1, 31):
            self.submit("US", "California", value, value * 2, value * 3, value / 2)
        for _ in range(29):
            self.submit("US", "Nevada", 50, 20, 30, 4)

        rows = self.summary()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["country_code"], "US")
        self.assertEqual(rows[0]["region_code"], "California")
        self.assertEqual(rows[0]["sample_count"], 30)
        self.assertAlmostEqual(rows[0]["download_avg_mbps"], 15.5)
        self.assertAlmostEqual(rows[0]["upload_avg_mbps"], 31)
        self.assertAlmostEqual(rows[0]["latency_avg_ms"], 46.5)
        self.assertAlmostEqual(rows[0]["jitter_avg_ms"], 7.75)

    def test_summary_combines_hourly_buckets_within_seven_day_window(self):
        yesterday = (self.now - timedelta(days=1)).isoformat().replace("+00:00", "Z")
        old = (self.now - timedelta(days=8)).isoformat().replace("+00:00", "Z")
        for _ in range(15):
            self.submit("IN", "Maharashtra", 10, 5, 20, 2, self.bucket)
            self.submit("IN", "Maharashtra", 30, 15, 40, 6, yesterday)
            self.submit("IN", "Maharashtra", 999, 999, 999, 999, old)

        rows = self.summary()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["sample_count"], 30)
        self.assertAlmostEqual(rows[0]["download_avg_mbps"], 20)
        self.assertAlmostEqual(rows[0]["upload_avg_mbps"], 10)
        self.assertAlmostEqual(rows[0]["latency_avg_ms"], 30)
        self.assertAlmostEqual(rows[0]["jitter_avg_ms"], 4)

    def test_invalid_aggregate_values_are_rejected_by_schema_constraints(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO benchmark_hourly (bucket_start, country_code, region_code, asn, sample_count) VALUES (?, ?, ?, ?, ?)",
                (self.bucket, "US", "California", -2, 1),
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO benchmark_hourly (bucket_start, country_code, region_code, asn, sample_count) VALUES (?, ?, ?, ?, ?)",
                (self.bucket, "US", "California", -1, -1),
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)

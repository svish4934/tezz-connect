import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const persist = mkdtempSync(join(tmpdir(), "tezz-d1-local-"));
const fixture = join(persist, "benchmark-assertions.sql");
const database = "tezz-connect-benchmarks";

const sql = `
DELETE FROM benchmark_hourly;

WITH RECURSIVE samples(n) AS (
  SELECT 1
  UNION ALL SELECT n + 1 FROM samples WHERE n < 30
)
INSERT INTO benchmark_hourly (
  bucket_start, country_code, region_code, asn, sample_count,
  download_count, download_sum_mbps, download_sum_sq,
  upload_count, upload_sum_mbps, upload_sum_sq,
  latency_count, latency_sum_ms, latency_sum_sq,
  jitter_count, jitter_sum_ms, jitter_sum_sq
)
SELECT strftime('%Y-%m-%dT%H:00:00.000Z','now'), 'US', 'California', -1,
  1, 1, n, n*n, 1, n*2, n*n*4, 1, n*3, n*n*9, 1, n/2.0, n*n/4.0
FROM samples
ON CONFLICT(bucket_start, country_code, region_code, asn) DO UPDATE SET
  sample_count = sample_count + excluded.sample_count,
  download_count = download_count + excluded.download_count,
  download_sum_mbps = download_sum_mbps + excluded.download_sum_mbps,
  download_sum_sq = download_sum_sq + excluded.download_sum_sq,
  upload_count = upload_count + excluded.upload_count,
  upload_sum_mbps = upload_sum_mbps + excluded.upload_sum_mbps,
  upload_sum_sq = upload_sum_sq + excluded.upload_sum_sq,
  latency_count = latency_count + excluded.latency_count,
  latency_sum_ms = latency_sum_ms + excluded.latency_sum_ms,
  latency_sum_sq = latency_sum_sq + excluded.latency_sum_sq,
  jitter_count = jitter_count + excluded.jitter_count,
  jitter_sum_ms = jitter_sum_ms + excluded.jitter_sum_ms,
  jitter_sum_sq = jitter_sum_sq + excluded.jitter_sum_sq;

INSERT INTO benchmark_hourly (
  bucket_start, country_code, region_code, asn, sample_count,
  download_count, download_sum_mbps, download_sum_sq,
  upload_count, upload_sum_mbps, upload_sum_sq,
  latency_count, latency_sum_ms, latency_sum_sq,
  jitter_count, jitter_sum_ms, jitter_sum_sq
)
VALUES (strftime('%Y-%m-%dT%H:00:00.000Z','now'), 'US', 'Nevada', -1,
  29, 29, 1450, 72500, 29, 580, 11600, 29, 870, 26100, 29, 116, 464);

INSERT INTO benchmark_hourly (
  bucket_start, country_code, region_code, asn, sample_count
)
VALUES (strftime('%Y-%m-%dT%H:00:00.000Z','now','-8 days'), 'US', 'Old Region', -1, 99);

CREATE TEMP TABLE _tezz_assert (passed INTEGER NOT NULL CHECK (passed = 1));
INSERT INTO _tezz_assert
SELECT CASE WHEN
  (SELECT sample_count FROM benchmark_hourly WHERE country_code='US' AND region_code='California') = 30
  AND (SELECT download_sum_mbps FROM benchmark_hourly WHERE country_code='US' AND region_code='California') = 465
  AND (SELECT download_sum_sq FROM benchmark_hourly WHERE country_code='US' AND region_code='California') = 9455
  AND (SELECT COUNT(*) FROM (
    SELECT country_code, region_code FROM benchmark_hourly
    WHERE bucket_start >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')
    GROUP BY country_code, region_code HAVING SUM(sample_count) >= 30
  )) = 1
  AND NOT EXISTS (
    SELECT 1 FROM benchmark_hourly
    WHERE region_code='Old Region'
      AND bucket_start >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')
  )
THEN 1 ELSE 0 END;
`;

function run(args, label) {
  const result = spawnSync("npx", ["--yes", "wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
    timeout: 180000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? "unknown"})`);
  }
}

try {
  writeFileSync(fixture, sql);
  console.log("Applying migrations to an isolated Wrangler local D1 database...");
  run(["d1", "migrations", "apply", database, "--local", "--persist-to", persist, "--yes"], "Local D1 migration");
  console.log("Executing aggregation, cohort-threshold, and retention assertions...");
  run(["d1", "execute", database, "--local", "--persist-to", persist, "--file", fixture, "--yes"], "Local D1 assertions");
  console.log("PASS: Wrangler local D1 migration and benchmark SQL assertions.");
} finally {
  rmSync(persist, { recursive: true, force: true });
}

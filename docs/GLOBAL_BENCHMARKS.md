# Global benchmark infrastructure

## Production status

The global benchmark pipeline is implemented and deployed.

- Cloudflare Worker binding: `BENCHMARKS_DB`.
- D1 database: `tezz-connect-benchmarks`.
- Migration: `migrations/0001_global_benchmarks.sql`.
- Write endpoint: `POST /api/v1/benchmarks/submit`.
- Read endpoint: `GET /api/v1/benchmarks/summary`.
- Protocol identifier: `v1`.
- Public summary window: the last 7 days.
- Minimum published cohort: 30 contributions per country/region group.

The Worker stores hourly aggregate rows in D1. The public endpoint returns regional aggregates only; it does not expose individual test records.

## Consent and collection contract

1. Benchmark participation is explicitly opt-in and off by default. The browser stores the preference locally under `tezz_benchmark_consent_v1`.
2. The client submits only after a completed successful speed test and only when the user has opted in.
3. The write endpoint independently requires `consent: true` and `protocolVersion: "v1"`.
4. The request contains download Mbps, upload Mbps, browser HTTP response latency in milliseconds, and the mean absolute difference between consecutive HTTP response-time samples in milliseconds.
5. The Worker obtains country and region from Cloudflare request metadata. Country must be a two-letter uppercase code; missing/invalid country metadata is rejected. Missing region is recorded as `unknown`.
6. Do not persist IP addresses, request IDs, cookies, account identifiers, precise coordinates, raw per-test records, browser fingerprints, SSIDs, BSSIDs, or advertising identifiers in benchmark rows.
7. The source IP is used only as an ephemeral Cloudflare rate-limit key. It is not part of the JSON payload, D1 key, or aggregate row.

## Measurement semantics

- **Download/upload:** Mbps calculated from exact bytes transferred and elapsed browser measurement time. The client adapts transfer payloads between 1 MB and 5 MB.
- **HTTP response latency:** browser-measured request/response time to the TEZZ CONNECT Cloudflare edge endpoint. It is not ICMP ping and does not represent end-to-end ISP latency.
- **HTTP response variation:** mean absolute difference between consecutive HTTP response-time samples in the same probe sequence. It is not packet-delay variation or a formal network-jitter measurement.
- The speed test, latency test, and stability monitor use different probe counts and reporting summaries. Their values should be compared only within the same test type and protocol, not treated as identical samples.

The database retains legacy column names `jitter_count`, `jitter_sum_ms`, and `jitter_sum_sq` for schema compatibility. These columns store the HTTP response variation metric described above; the public UI should use the current terminology.

## Aggregation model

- Rows are keyed by UTC hourly bucket, Cloudflare country, Cloudflare region, and ASN sentinel.
- The current Worker writes ASN as `-1` (unknown/unreported); ASN-level reporting is not currently implemented.
- Storage is aggregate-only: contribution counts, sums, and sums of squares for download, upload, HTTP response latency, and HTTP response variation.
- No individual measurement rows are created.
- The summary endpoint groups the last 7 days by country and region, requires at least 30 contributions per group, orders by sample count, and returns at most 100 groups.
- Returned means are calculated from aggregate sums and counts. The endpoint does not currently publish medians, percentiles, standard deviations, or ASN comparisons.

## Publication safeguards and limitations

- A country/region group is omitted unless it has at least 30 contributions in the summary window.
- Public results describe participating TEZZ CONNECT tests only. They are not representative of every subscriber, all users in a region, or an ISP's entire network.
- A contribution is not proof of one unique human or device. Repeated tests may contribute more than once.
- Rate limiting is a basic abuse barrier, not identity verification.
- Hourly aggregate rows are automatically deleted after 30 days by a daily Cloudflare Cron Trigger. The cleanup deletes only expired aggregate buckets; it does not affect the seven-day public reporting window.
- The `benchmark_consent_totals` table exists in the initial migration but is not currently written to or queried by the Worker.

## Abuse controls and validation

- General API limit: 600 requests per minute per source IP (Cloudflare rate-limit binding).
- Transfer endpoint limit: 300 requests per minute per source IP (Cloudflare rate-limit binding).
- Benchmark submission limit: 30 requests per minute per source IP (Cloudflare rate-limit binding).
- Benchmark request body is limited to 2,048 characters and must be JSON.
- The endpoint requires explicit consent and protocol version `v1`.
- All four metrics must be finite numbers between 0 and 10,000. Download, upload, and latency must be greater than zero.
- D1 write errors return HTTP 503; malformed, unsupported, or non-consented submissions are rejected.

## Operational verification

The production smoke script currently verifies that:

- the benchmark summary endpoint returns a valid response with a 7-day window contract and a 30-contribution minimum;
- a submission without explicit consent is rejected.

The smoke script does not currently verify a successful opt-in write, D1 aggregate arithmetic, cohort suppression using seeded test data, or rate-limit exhaustion. Those remain follow-up integration-test items. Do not claim those cases are covered by the production smoke suite until tests are added and run.

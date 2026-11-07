# Global benchmark infrastructure

## Current status

The Worker has no D1 binding yet. This migration is a schema-only preparation step. No benchmark submissions are accepted or stored until D1 is provisioned, bound to the Worker, and the API is implemented and deployed.

## Privacy and collection contract

1. Collection is explicitly opt-in and off by default.
2. Only completed, successful tests using the same documented measurement protocol may contribute.
3. Never persist IP addresses, request IDs, cookies, account identifiers, precise coordinates, or raw per-test records.
4. Use Cloudflare country and region metadata only at coarse granularity. Missing metadata maps to `unknown`.
5. ASN-level reporting is optional and must not be used as a proxy for an individual's identity.
6. Do not store browser fingerprints, SSIDs, BSSIDs, or advertising identifiers.
7. Do not submit test data until the user has actively opted in and been shown what is shared.

## Aggregation model

- UTC hourly buckets.
- Aggregate-only storage: counts, sums, and sums of squares for download, upload, HTTP edge response latency, and jitter.
- No individual measurement rows.
- Country and coarse region are primary dimensions. ASN is nullable and may be queried only for sufficiently large cohorts.
- Measurements must use a consistent test protocol and payload policy. Introduce a protocol version before changing measurement semantics; never mix incompatible protocols in one cohort.

## Publication safeguards

- Do not publish a cohort with fewer than 30 completed contributions.
- Require at least 50 contributions for ASN-level comparisons.
- Suppress or roll up small cohorts to country level; never expose exact low-volume region/ASN combinations.
- Public views use daily or weekly windows, not exact event times.
- Display sample count, time window, protocol version, and clarify that results describe participating TEZZ CONNECT tests—not every subscriber or an ISP's entire network.
- Means and standard deviations can be derived from stored moments. Never label a mean as a median or percentile.

## Submission abuse controls

- Benchmark writes have a dedicated Cloudflare rate limit of 6 requests per minute per source IP, separate from speed-test traffic.
- The source IP is read only for the Cloudflare rate-limit binding. It is not included in the JSON payload, database key, logs, or aggregate rows by this application.
- This is a basic abuse barrier, not proof of one human or one device per contribution. Repeated legitimate tests may still contribute; future publication analysis should monitor unusual contribution patterns.

## D1 provisioning checklist

1. Create a Cloudflare D1 database for production.
2. Add a `[[d1_databases]]` binding named `BENCHMARKS_DB` to `wrangler.toml`, using the database ID returned by Cloudflare.
3. Use a separate database for preview/staging if that environment is enabled.
4. Apply this migration with Wrangler's remote migration command.
5. Add an endpoint that validates consent, metric bounds, and protocol version; applies abuse controls; and performs atomic aggregate upserts.
6. Add public read endpoints that enforce cohort thresholds in SQL and return no raw keys for suppressed groups.
7. Add production smoke tests for opt-out, malformed payloads, rate limiting, suppressed cohorts, and aggregate accuracy.

Do not add a placeholder database ID or deploy a Worker that assumes the binding exists. Keep the production app operational while the database is provisioned.

## Metric semantics

- Download/upload: Mbps calculated from exact bytes transferred and elapsed measurement time.
- Latency: browser HTTP request/response time to the TEZZ CONNECT edge, not ICMP ping or end-to-end ISP latency.
- Jitter: the documented variation metric for the same probe sequence; do not combine different jitter definitions.
- Reject non-finite, negative, implausible, or incomplete values server-side.

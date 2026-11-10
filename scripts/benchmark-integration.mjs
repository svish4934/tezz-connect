import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const workerSource = await readFile(new URL('../worker/index.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(workerSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const tempDir = await mkdtemp(join(tmpdir(), 'tezz-worker-test-'))
const workerPath = join(tempDir, 'worker.mjs')
await writeFile(workerPath, compiled)
let worker
try {
  worker = (await import(pathToFileURL(workerPath).href)).default
} finally {
  await rm(tempDir, { recursive: true, force: true })
}

class MemoryD1 {
  rows = new Map()

  prepare(sql) {
    const statement = {
      values: [],
      bind: (...values) => { statement.values = values; return statement },
      run: async () => {
        assert.match(sql, /INSERT INTO benchmark_hourly/)
        const [bucket, country, region, download, downloadSq, upload, uploadSq, latency, latencySq, variation, variationSq] = statement.values
        const key = [bucket, country, region, -1].join('|')
        const row = this.rows.get(key) ?? {
          bucket, country, region, sample_count: 0,
          download_count: 0, download_sum_mbps: 0,
          upload_count: 0, upload_sum_mbps: 0,
          latency_count: 0, latency_sum_ms: 0,
          variation_count: 0, variation_sum_ms: 0,
        }
        row.sample_count += 1
        row.download_count += 1
        row.download_sum_mbps += download
        row.download_sum_sq = (row.download_sum_sq ?? 0) + downloadSq
        row.upload_count += 1
        row.upload_sum_mbps += upload
        row.upload_sum_sq = (row.upload_sum_sq ?? 0) + uploadSq
        row.latency_count += 1
        row.latency_sum_ms += latency
        row.latency_sum_sq = (row.latency_sum_sq ?? 0) + latencySq
        row.variation_count += 1
        row.variation_sum_ms += variation
        row.variation_sum_sq = (row.variation_sum_sq ?? 0) + variationSq
        this.rows.set(key, row)
        return { success: true }
      },
      all: async () => {
        assert.match(sql, /GROUP BY country_code, region_code/)
        const since = statement.values[0]
        const groups = new Map()
        for (const row of this.rows.values()) {
          if (row.bucket < since) continue
          const key = [row.country, row.region].join('|')
          const group = groups.get(key) ?? {
            country_code: row.country, region_code: row.region, sample_count: 0,
            download_sum_mbps: 0, download_count: 0,
            upload_sum_mbps: 0, upload_count: 0,
            latency_sum_ms: 0, latency_count: 0,
            variation_sum_ms: 0, variation_count: 0,
          }
          for (const field of ['sample_count', 'download_count', 'download_sum_mbps', 'upload_count', 'upload_sum_mbps', 'latency_count', 'latency_sum_ms', 'variation_count', 'variation_sum_ms']) {
            group[field] += row[field] ?? 0
          }
          groups.set(key, group)
        }
        const results = [...groups.values()]
          .filter(group => group.sample_count >= 30)
          .sort((a, b) => b.sample_count - a.sample_count)
          .slice(0, 100)
          .map(group => ({
            country_code: group.country_code,
            region_code: group.region_code,
            sample_count: group.sample_count,
            download_avg_mbps: group.download_sum_mbps / group.download_count,
            upload_avg_mbps: group.upload_sum_mbps / group.upload_count,
            latency_avg_ms: group.latency_sum_ms / group.latency_count,
            jitter_avg_ms: group.variation_sum_ms / group.variation_count,
          }))
        return { success: true, results }
      },
    }
    return statement
  }
}

const database = new MemoryD1()
const rateLimitCalls = []
const allowRateLimit = { limit: async ({ key }) => { rateLimitCalls.push(key); return { success: true } } }
const env = {
  ASSETS: { fetch: async () => new Response('not found', { status: 404 }) },
  API_RATE_LIMITER: allowRateLimit,
  TRANSFER_RATE_LIMITER: allowRateLimit,
  BENCHMARK_RATE_LIMITER: allowRateLimit,
  BENCHMARKS_DB: database,
}

async function call(path, { method = 'GET', body, country = 'US', region = 'California', rateLimit = allowRateLimit } = {}) {
  const request = new Request('https://tezz.test' + path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body,
  })
  Object.defineProperty(request, 'cf', { value: country === null ? {} : { country, region } })
  return worker.fetch(request, { ...env, BENCHMARK_RATE_LIMITER: rateLimit }, {})
}

function payload(overrides = {}) {
  return JSON.stringify({
    consent: true,
    protocolVersion: 'v1',
    downloadMbps: 50,
    uploadMbps: 20,
    latencyMs: 30,
    jitterMs: 4,
    ...overrides,
  })
}

async function expectJson(response, status) {
  assert.equal(response.status, status)
  return response.json()
}

// Validation: no consent, wrong protocol, invalid values, malformed and oversized bodies.
let response = await call('/api/v1/benchmarks/submit', { method: 'POST', body: payload({ consent: false }) })
assert.equal((await expectJson(response, 400)).ok, false)
response = await call('/api/v1/benchmarks/submit', { method: 'POST', body: payload({ protocolVersion: 'v2' }) })
assert.equal((await expectJson(response, 400)).ok, false)
response = await call('/api/v1/benchmarks/submit', { method: 'POST', body: payload({ downloadMbps: Number.NaN }) })
assert.equal((await expectJson(response, 400)).ok, false)
response = await call('/api/v1/benchmarks/submit', { method: 'POST', body: '{invalid json' })
assert.equal((await expectJson(response, 400)).ok, false)
response = await call('/api/v1/benchmarks/submit', { method: 'POST', body: JSON.stringify({ consent: true }).padEnd(2049, ' ') })
assert.equal((await expectJson(response, 413)).ok, false)
response = await call('/api/v1/benchmarks/submit', { method: 'POST', body: payload(), country: null })
assert.equal((await expectJson(response, 422)).ok, false)
response = await call('/api/v1/benchmarks/submit', { method: 'POST', body: payload(), rateLimit: { limit: async () => ({ success: false }) } })
assert.equal((await expectJson(response, 429)).ok, false)
response = await call('/api/v1/benchmarks/submit', { method: 'GET' })
assert.equal((await expectJson(response, 405)).ok, false)
process.stdout.write('PASS  benchmark submission validation and rate-limit cases\n')

// Insert 30 consented contributions into a publishable cohort, with known means.
for (let index = 1; index <= 30; index++) {
  response = await call('/api/v1/benchmarks/submit', {
    method: 'POST',
    body: payload({
      downloadMbps: index,
      uploadMbps: index * 2,
      latencyMs: index * 3,
      jitterMs: index / 2,
    }),
  })
  const data = await expectJson(response, 202)
  assert.equal(data.ok, true)
}

// A separate 29-sample cohort must remain suppressed by the public summary.
for (let index = 0; index < 29; index++) {
  response = await call('/api/v1/benchmarks/submit', {
    method: 'POST',
    body: payload(),
    region: 'Nevada',
  })
  assert.equal(response.status, 202)
}

response = await call('/api/v1/benchmarks/summary')
const summary = await expectJson(response, 200)
assert.equal(summary.ok, true)
assert.equal(summary.window, 'last_7_days')
assert.equal(summary.minimumSamples, 30)
assert.equal(summary.protocolVersion, 'v1')
assert.equal(summary.regions.length, 1)
assert.equal(summary.regions[0].country_code, 'US')
assert.equal(summary.regions[0].region_code, 'California')
assert.equal(summary.regions[0].sample_count, 30)
assert.equal(summary.regions[0].download_avg_mbps, 15.5)
assert.equal(summary.regions[0].upload_avg_mbps, 31)
assert.equal(summary.regions[0].latency_avg_ms, 46.5)
assert.equal(summary.regions[0].jitter_avg_ms, 7.75)
assert.ok(!JSON.stringify(database.rows).includes('203.0.113.10'))
assert.ok(rateLimitCalls.length >= 60)
process.stdout.write('PASS  opt-in aggregate writes, arithmetic, and 30-sample cohort suppression\n')

const unavailableDatabase = {
  prepare() {
    return {
      bind() { return this },
      run: async () => { throw new Error('simulated D1 write failure') },
      all: async () => { throw new Error('simulated D1 read failure') },
    }
  },
}
const unavailableEnv = { ...env, BENCHMARKS_DB: unavailableDatabase }
const writeFailureRequest = new Request('https://tezz.test/api/v1/benchmarks/submit', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: payload(),
})
Object.defineProperty(writeFailureRequest, 'cf', { value: { country: 'US', region: 'California' } })
const writeFailure = await worker.fetch(writeFailureRequest, unavailableEnv, {})
assert.equal(writeFailure.status, 503)
const readFailure = await worker.fetch(new Request('https://tezz.test/api/v1/benchmarks/summary'), unavailableEnv, {})
assert.equal(readFailure.status, 503)
process.stdout.write('PASS  graceful 503 responses when benchmark D1 reads or writes fail\\n')

process.stdout.write('\nSpeed-test transfer endpoint checks\n')

// The download endpoint must stream binary data, enforce its configured byte cap,
// and avoid a Content-Length that would imply a fixed-size transfer.
response = await call('/api/v1/speed/download?durationMs=1000&maxBytes=1000000')
assert.equal(response.status, 200)
assert.match(response.headers.get('content-type') ?? '', /application\/octet-stream/)
assert.equal(response.headers.get('content-length'), null)
const downloadBytes = await response.arrayBuffer()
assert.equal(downloadBytes.byteLength, 1_000_000)
process.stdout.write('PASS  streamed download response and byte cap\n')

// Reject invalid duration and byte limits before any streaming response is created.
response = await call('/api/v1/speed/download?durationMs=500&maxBytes=1000000')
assert.equal((await expectJson(response, 400)).ok, false)
response = await call('/api/v1/speed/download?durationMs=6000&maxBytes=26000000')
assert.equal((await expectJson(response, 400)).ok, false)
process.stdout.write('PASS  download duration and maximum-byte guardrails\n')

// Upload throughput is measured by the Worker while it consumes the request stream.
const uploadPayload = new Uint8Array(1_000_000)
for (let offset = 0; offset < uploadPayload.length; offset += 65_536) {
  crypto.getRandomValues(uploadPayload.subarray(offset, Math.min(offset + 65_536, uploadPayload.length)))
}
const uploadRequest = new Request('https://tezz.test/api/v1/speed/upload?bytes=1000000', {
  method: 'POST',
  headers: { 'content-type': 'application/octet-stream' },
  body: uploadPayload,
})
Object.defineProperty(uploadRequest, 'cf', { value: { country: 'US', region: 'California' } })
response = await worker.fetch(uploadRequest, env, {})
const uploadMeasurement = await expectJson(response, 200)
assert.equal(uploadMeasurement.ok, true)
assert.equal(uploadMeasurement.receivedBytes, 1_000_000)
assert.ok(uploadMeasurement.elapsedMs > 0)
assert.ok(Number.isFinite(uploadMeasurement.mbps) && uploadMeasurement.mbps > 0)
process.stdout.write('PASS  streamed upload receipt and server-side throughput calculation\n')

// Reject a transfer whose received byte count does not match the declared test size.
const shortUploadRequest = new Request('https://tezz.test/api/v1/speed/upload?bytes=1000000', {
  method: 'POST',
  headers: { 'content-type': 'application/octet-stream' },
  body: new Uint8Array(512),
})
Object.defineProperty(shortUploadRequest, 'cf', { value: { country: 'US', region: 'California' } })
response = await worker.fetch(shortUploadRequest, env, {})
assert.equal((await expectJson(response, 400)).ok, false)
process.stdout.write('PASS  upload byte-count validation\n')

process.stdout.write('\nAll benchmark and speed-test handler integration checks passed (in-memory D1 contract).\n')

// Scheduled retention must delete only expired hourly aggregate rows.
let cleanupSql = ''
let cleanupCutoff = ''
let cleanupRuns = 0
const retentionDb = {
  prepare(sql) {
    cleanupSql = sql
    return {
      bind(cutoff) { cleanupCutoff = cutoff; return this },
      async run() { cleanupRuns += 1; return { success: true } },
    }
  },
}
const cleanupStartedAt = Date.now()
await worker.scheduled({}, { ...env, BENCHMARKS_DB: retentionDb }, {})
const cleanupAgeMs = cleanupStartedAt - Date.parse(cleanupCutoff)
assert.match(cleanupSql, /^DELETE FROM benchmark_hourly WHERE bucket_start < \?$/)
assert.equal(cleanupRuns, 1)
assert.ok(cleanupAgeMs >= 30 * 24 * 60 * 60 * 1000 - 1000)
assert.ok(cleanupAgeMs <= 30 * 24 * 60 * 60 * 1000 + 1000)
process.stdout.write('PASS  scheduled 30-day aggregate retention cleanup\n')

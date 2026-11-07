interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

interface D1Result<T> { results: T[]; success: boolean }
interface D1Statement {
  bind(...values: unknown[]): D1Statement
  run(): Promise<unknown>
  all<T>(): Promise<D1Result<T>>
}
interface D1Database { prepare(query: string): D1Statement }
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  API_RATE_LIMITER: RateLimitBinding
  TRANSFER_RATE_LIMITER: RateLimitBinding
  BENCHMARK_RATE_LIMITER: RateLimitBinding
  BENCHMARKS_DB: D1Database
}

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Content-Type-Options": "nosniff" }

function json(message: string, status = 200) {
  return new Response(JSON.stringify({ ok: status < 400, message }), {
    status,
    headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" },
  })
}

const app: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // Versioned public API. Legacy paths remain aliases during migration.
    const legacyApiAliases: Record<string, string> = {
      "/api/speed/ping": "/api/v1/speed/ping",
      "/api/speed/download": "/api/v1/speed/download",
      "/api/speed/upload": "/api/v1/speed/upload",
      "/api/network/edge": "/api/v1/network/info",
      "/api/services/check": "/api/v1/services/check",
    }
    const pathname = legacyApiAliases[url.pathname] ?? url.pathname
    const apiPath = pathname.startsWith("/api/v1/")

    // Apply per-client limits at the edge before expensive API work.
    if (apiPath && pathname !== "/api/v1/health") {
      const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown"
      const generalLimit = await env.API_RATE_LIMITER.limit({ key: clientIp })
      if (!generalLimit.success) {
        return new Response(JSON.stringify({ ok: false, message: "API request limit reached. Please retry shortly." }), {
          status: 429,
          headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Retry-After": "60", "X-API-Version": "v1" },
        })
      }
      if (pathname === "/api/v1/speed/download" || pathname === "/api/v1/speed/upload") {
        const transferLimit = await env.TRANSFER_RATE_LIMITER.limit({ key: clientIp })
        if (!transferLimit.success) {
          return new Response(JSON.stringify({ ok: false, message: "Transfer test limit reached. Please retry in one minute." }), {
            status: 429,
            headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Retry-After": "60", "X-API-Version": "v1" },
          })
        }
      }
    }

    // Agent discovery files are served explicitly so SPA fallback never returns HTML.
    if (url.pathname === "/llms.txt") {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { ...noStore, "Allow": "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" } })
      const body = "# TEZZ CONNECT\n\nTEZZ CONNECT is a free browser-based internet performance toolkit.\n\n## Tools\n- [Internet speed test](https://tezzconnect.online/): measure download speed, upload speed, HTTP latency and jitter.\n- [Internet Doctor](https://tezzconnect.online/internet-doctor): troubleshoot common connection problems.\n- [Network tools](https://tezzconnect.online/tools): inspect network and connection information.\n- [Global Network](https://tezzconnect.online/global-network): view available aggregate network benchmarks.\n- [About TEZZ CONNECT](https://tezzconnect.online/about): learn about the project.\n\n## Documentation\n- [Sitemap](https://tezzconnect.online/sitemap.xml)\n- [Robots policy](https://tezzconnect.online/robots.txt)\n\n## Usage notes\n- Speed measurements run in the visitor's browser against TEZZ CONNECT endpoints and are estimates of that browser-to-edge connection.\n- Regional benchmark contributions are optional and require explicit consent.\n- TEZZ CONNECT does not expose a public MCP or autonomous-agent execution API.\n"
      return new Response(request.method === "HEAD" ? null : body, { status: 200, headers: { ...noStore, "Content-Type": "text/markdown; charset=utf-8" } })
    }

    if (url.pathname === "/.well-known/ard.json" || url.pathname === "/.well-known/ai-catalog.json") {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { ...noStore, "Allow": "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" } })
      const body = JSON.stringify({ specVersion: "0.91", entries: [] })
      return new Response(request.method === "HEAD" ? null : body, { status: 200, headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" } })
    }

    // Serve robots.txt directly from the Worker so crawlers receive a plain-text
    // response independent of the static asset fallback.
    // Serve the sitemap directly from the Worker so search crawlers receive
    // deterministic XML without relying on the static asset fallback.
    if (url.pathname === "/sitemap.xml") {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { ...noStore, "Allow": "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" } })
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tezzconnect.online/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://tezzconnect.online/about</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>https://tezzconnect.online/guides/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://tezzconnect.online/guides/internet-speed-explained/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/latency-and-jitter/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/improve-wifi-speed/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/upload-speed-explained/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/internet-speed-for-gaming/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
</urlset>
`
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: { ...noStore, "Content-Type": "application/xml; charset=utf-8" },
      })
    }

    if (url.pathname === "/robots.txt") {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { ...noStore, "Allow": "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" } })
      const body = "User-agent: *\nAllow: /\n\nSitemap: https://tezzconnect.online/sitemap.xml\n"
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
      })
    }

    if (pathname === "/api/v1/health") {
      if (request.method !== "GET" && request.method !== "HEAD") return json("Method not allowed", 405)
      return new Response(request.method === "HEAD" ? null : JSON.stringify({
        ok: true,
        service: "TEZZ CONNECT API",
        version: "v1",
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "X-API-Version": "v1" },
      })
    }

    if (pathname === "/api/v1/benchmarks/submit") {
      if (request.method !== "POST") return json("Method not allowed", 405)
      // Limit benchmark writes separately from normal diagnostics. The IP is used
      // only as an ephemeral rate-limit key and is never written to D1.
      const benchmarkIp = request.headers.get("CF-Connecting-IP") ?? "unknown"
      const benchmarkLimit = await env.BENCHMARK_RATE_LIMITER.limit({ key: benchmarkIp })
      if (!benchmarkLimit.success) {
        return new Response(JSON.stringify({ ok: false, message: "Benchmark contribution limit reached. Please retry in one minute." }), {
          status: 429,
          headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Retry-After": "60", "X-API-Version": "v1" },
        })
      }
      if (request.headers.get("content-type")?.toLowerCase().includes("application/json") !== true) return json("Content-Type must be application/json", 415)
      const country = (request as Request & { cf?: { country?: string; region?: string } }).cf?.country
      const region = (request as Request & { cf?: { country?: string; region?: string } }).cf?.region
      if (!country || !/^[A-Z]{2}$/.test(country)) return json("Regional metadata is unavailable; no benchmark was stored.", 422)
      let body: unknown
      try {
        const raw = await request.text()
        if (raw.length > 2048) return json("Request body is too large", 413)
        body = JSON.parse(raw)
      } catch {
        return json("Invalid JSON payload", 400)
      }
      if (!body || typeof body !== "object") return json("Invalid benchmark payload", 400)
      const input = body as Record<string, unknown>
      if (input.consent !== true) return json("Explicit consent is required", 400)
      if (input.protocolVersion !== "v1") return json("Unsupported measurement protocol", 400)
      const metrics = ["downloadMbps", "uploadMbps", "latencyMs", "jitterMs"] as const
      const values = metrics.map(key => input[key])
      if (values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000)) {
        return json("Metrics must be finite numbers between 0 and 10,000", 400)
      }
      const [download, upload, latency, jitter] = values as number[]
      if (download <= 0 || upload <= 0 || latency <= 0) return json("A completed speed test is required", 400)
      const now = new Date()
      const bucket = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString()
      const safeRegion = (region ?? "unknown").trim().slice(0, 64) || "unknown"
      try {
        await env.BENCHMARKS_DB.prepare(`
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
        `).bind(
          bucket, country, safeRegion,
          download, download * download,
          upload, upload * upload,
          latency, latency * latency,
          jitter, jitter * jitter,
        ).run()
        return new Response(JSON.stringify({ ok: true, message: "Anonymous aggregate contribution recorded." }), {
          status: 202,
          headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "X-API-Version": "v1" },
        })
      } catch {
        return json("Benchmark storage is temporarily unavailable.", 503)
      }
    }

    if (pathname === "/api/v1/benchmarks/summary") {
      if (request.method !== "GET") return json("Method not allowed", 405)
      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const result = await env.BENCHMARKS_DB.prepare(`
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
        `).bind(since).all<{
          country_code: string; region_code: string; sample_count: number;
          download_avg_mbps: number; upload_avg_mbps: number;
          latency_avg_ms: number; jitter_avg_ms: number;
        }>()
        return new Response(JSON.stringify({
          ok: true,
          window: "last_7_days",
          protocolVersion: "v1",
          minimumSamples: 30,
          scope: "participating TEZZ CONNECT tests",
          regions: result.results,
        }), { headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "X-API-Version": "v1" } })
      } catch {
        return json("Benchmark summary is temporarily unavailable.", 503)
      }
    }

    if (pathname === "/api/v1/services/check") {
      if (request.method !== "GET") return json("Method not allowed", 405)
      const targets: Record<string, string> = {
        facebook: "https://www.facebook.com/",
        instagram: "https://www.instagram.com/",
        youtube: "https://www.youtube.com/",
        whatsapp: "https://www.whatsapp.com/",
        netflix: "https://www.netflix.com/",
        google: "https://www.gstatic.com/generate_204",
        x: "https://x.com/",
        tiktok: "https://www.tiktok.com/",
      }
      const site = (url.searchParams.get("site") ?? "").toLowerCase()
      const target = targets[site]
      if (!target) return json("Unknown service", 400)
      try {
        const upstream = await fetch(target, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0 (compatible; TEZZCONNECT/1.0)", "Range": "bytes=0-0" },
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        })
        // Some platforms intentionally block automated probes (403/429). Treat those
        // responses as inconclusive, not as an outage or a successful user connection.
        if (upstream.status >= 200 && upstream.status < 400) {
          return new Response(JSON.stringify({ status: "responding" }), { headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" } })
        }
        if (upstream.status >= 400 && upstream.status < 500 && upstream.status !== 403 && upstream.status !== 429) {
          return new Response(JSON.stringify({ status: "unavailable" }), { headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" } })
        }
        return new Response(JSON.stringify({ status: "inconclusive" }), { headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" } })
      } catch {
        return new Response(JSON.stringify({ status: "inconclusive" }), { headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" } })
      }
    }

    if (pathname === "/api/v1/network/info") {
      if (request.method !== "GET") return json("Method not allowed", 405)
      const cf = (request as Request & { cf?: {
        colo?: string
        country?: string
        region?: string
        asn?: number
        asOrganization?: string
      } }).cf
      return new Response(JSON.stringify({
        colo: cf?.colo ?? null,
        country: cf?.country ?? null,
        region: cf?.region ?? null,
        asn: cf?.asn ?? null,
        organization: cf?.asOrganization ?? null,
      }), {
        headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" },
      })
    }

    if (pathname === "/api/v1/speed/ping") {
      if (request.method !== "GET" && request.method !== "HEAD") return json("Method not allowed", 405)
      return new Response(null, { status: 204, headers: noStore })
    }

    if (pathname === "/api/v1/speed/download") {
      if (request.method !== "GET" && request.method !== "HEAD") return json("Method not allowed", 405)
      const requested = Number(url.searchParams.get("bytes") ?? "1000000")
      if (!Number.isSafeInteger(requested) || requested < 1 || requested > 10_000_000) {
        return json("Download size must be between 1 byte and 10 MB", 400)
      }
      // Return a fixed-length body for predictable browser transfer accounting.
      const payload = new Uint8Array(requested)
      for (let offset = 0; offset < payload.length; offset += 65_536) {
        crypto.getRandomValues(payload.subarray(offset, Math.min(offset + 65_536, payload.length)))
      }
      return new Response(request.method === "HEAD" ? null : payload, {
        status: 200,
        headers: {
          ...noStore,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(requested),
          "Cache-Control": "no-store, no-transform",
        },
      })
    }

    if (pathname === "/api/v1/speed/upload") {
      if (request.method !== "POST") return json("Method not allowed", 405)
      if (!request.body) return json("Upload payload is missing", 400)
      try {
        const expectedBytes = Number(url.searchParams.get("bytes") ?? "1000000")
        if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > 5_000_000) {
          return json("Upload size must be between 1 byte and 5 MB", 400)
        }
        const declaredLength = request.headers.get("content-length")
        if (declaredLength !== null && Number(declaredLength) !== expectedBytes) {
          return json("Upload Content-Length does not match the expected payload size", 400)
        }
        const payload = await request.arrayBuffer()
        if (payload.byteLength !== expectedBytes) {
          return json(`Upload payload size mismatch: received ${payload.byteLength} bytes; expected ${expectedBytes}`, 400)
        }
        return json("Upload received")
      } catch {
        return json("Upload payload could not be read completely", 400)
      }
    }

    const response = await env.ASSETS.fetch(request)
    if (apiPath) {
      const headers = new Headers(response.headers)
      headers.set("X-API-Version", "v1")
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    }
    return response
  },
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const startedAt = Date.now()
    const requestId = crypto.randomUUID()
    const url = new URL(request.url)
    const apiPath = url.pathname.startsWith("/api/")
    try {
      const response = await app.fetch(request, env, context)
      const durationMs = Date.now() - startedAt
      const headers = new Headers(response.headers)
      headers.set("X-Request-ID", requestId)
      headers.set("Server-Timing", `app;dur=${durationMs}`)
      if (apiPath) {
        console.log(JSON.stringify({
          event: "api_request",
          request_id: requestId,
          method: request.method,
          route: url.pathname,
          status: response.status,
          duration_ms: durationMs,
          colo: (request as Request & { cf?: { colo?: string } }).cf?.colo ?? null,
        }))
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch (error) {
      const durationMs = Date.now() - startedAt
      console.error(JSON.stringify({
        event: "api_unhandled_error",
        request_id: requestId,
        method: request.method,
        route: url.pathname,
        duration_ms: durationMs,
        error: error instanceof Error ? error.name : "UnknownError",
      }))
      return new Response(JSON.stringify({
        ok: false,
        message: "An unexpected server error occurred.",
        requestId,
      }), {
        status: 500,
        headers: {
          ...noStore,
          "Content-Type": "application/json; charset=utf-8",
          "X-Request-ID": requestId,
          "Server-Timing": `app;dur=${durationMs}`,
        },
      })
    }
  },
} satisfies ExportedHandler<Env>

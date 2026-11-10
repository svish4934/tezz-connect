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
  <url><loc>https://tezzconnect.online/internet-doctor</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://tezzconnect.online/tools</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://tezzconnect.online/global-network</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://tezzconnect.online/guides/internet-speed-explained/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/latency-and-jitter/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/improve-wifi-speed/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/upload-speed-explained/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/internet-speed-for-gaming/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/what-is-the-internet/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/networking-buying-guides/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/connection-troubleshooter/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/home-network-planner/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/how-the-internet-works/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/interactive-network-lab/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/internet-learning-roadmap/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/networking-glossary/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/wifi-security-checkup/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://tezzconnect.online/guides/wifi-signal-simulator/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
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

    // Route-specific metadata is sent in the initial HTML. Search crawlers
    // also receive concise, useful page content; normal browsers only receive
    // the React app shell, preventing the old SEO fallback flash.
    const seoPages: Record<string, { title: string; description: string; canonical: string; fallback: string }> = {
      "/": {
        title: "Free Internet Speed Test – Download, Upload & Response Time | TEZZ CONNECT",
        description: "Run a free internet speed test with TEZZ CONNECT. Measure download and upload speed, browser-based response time and connection stability for streaming, gaming and video calls.",
        canonical: "https://tezzconnect.online/",
        fallback: `<main id="seo-fallback"><header><p>FREE INTERNET PERFORMANCE TOOLS</p><h1>Test your internet speed with TEZZ CONNECT.</h1><p>Measure download speed, upload speed and browser-based response time. Understand connection stability and learn what your results mean.</p></header><section><h2>Check the performance of your connection</h2><p>Run a free browser-based speed test and review practical measurements for everyday internet use.</p><ul><li><strong>Download speed:</strong> see how quickly data reaches your device.</li><li><strong>Upload speed:</strong> check how quickly your device sends data.</li><li><strong>Response time and variation:</strong> understand how quickly the TEZZ CONNECT edge responds to browser requests.</li><li><strong>Connection guidance:</strong> explore common network issues and practical troubleshooting steps.</li></ul></section><section><h2>Tools to understand your internet</h2><p>Use Internet Doctor, network tools, connection history and learning guides to investigate performance beyond a single speed result.</p><p><a href="/internet-doctor">Internet Doctor</a> · <a href="/tools">Network tools</a> · <a href="/global-network">Global Network</a> · <a href="/guides/">Learning guides</a> · <a href="/about">About TEZZ CONNECT</a></p></section><section><h2>Measurements, not promises</h2><p>Results are estimates from your browser to TEZZ CONNECT network endpoints. They can vary with Wi-Fi conditions, device performance, browser activity, network congestion and the route to our edge.</p></section><p><a href="/about">Learn more about TEZZ CONNECT</a></p></main>`,
      },
      "/about": {
        title: "About TEZZ CONNECT | Internet Performance Tools",
        description: "Learn about TEZZ CONNECT, a free browser-based toolkit for measuring internet performance, understanding network behaviour and making informed connectivity decisions.",
        canonical: "https://tezzconnect.online/about",
        fallback: `<main id="seo-fallback"><header><p>ABOUT TEZZ CONNECT</p><h1>Understand your connection.</h1><p>TEZZ CONNECT is a free, browser-based toolkit that helps you measure internet performance, understand network behaviour and make more informed connectivity decisions.</p></header><section><h2>Useful network insight, without the guesswork.</h2><p>Simple tools turn technical measurements into information you can act on.</p><h3>Measure performance</h3><p>Run download and upload throughput tests, plus browser-based HTTP response-time and variation estimates.</p><h3>Understand connection issues</h3><p>Explore practical recommendations for common causes such as congestion, weak Wi-Fi conditions and competing network traffic.</p><h3>Explore your network</h3><p>Review available network-edge information, connection signals and public website endpoint checks.</p></section><section><h2>Built in India. Connecting the world.</h2><p>TEZZ CONNECT is an independent digital platform built for people who want clearer information about their internet connection.</p></section><section><h2>How measurements work</h2><p>Speed tests run in your browser against TEZZ CONNECT endpoints. Latency and response variation use HTTP request and response timing to our network edge; they are not ICMP ping measurements.</p></section><section><h2>Privacy and control</h2><p>Local test history stays in your browser. Regional benchmark contributions are optional and require your consent. The tools do not need your GPS location or street address.</p></section><section><h2>Contact us</h2><p>Questions, issues or ideas? Email <a href="mailto:tezzconnect.contact@gmail.com">tezzconnect.contact@gmail.com</a>.</p></section><p><a href="/">Start a speed test</a></p></main>`,
      },
      "/about/": {
        title: "About TEZZ CONNECT | Internet Performance Tools",
        description: "Learn about TEZZ CONNECT, a free browser-based toolkit for measuring internet performance, understanding network behaviour and making informed connectivity decisions.",
        canonical: "https://tezzconnect.online/about",
        fallback: `<main id="seo-fallback"><header><p>ABOUT TEZZ CONNECT</p><h1>Understand your connection.</h1><p>TEZZ CONNECT is a free, browser-based toolkit that helps you measure internet performance, understand network behaviour and make more informed connectivity decisions.</p></header><section><h2>Useful network insight, without the guesswork.</h2><p>Simple tools turn technical measurements into information you can act on.</p><h3>Measure performance</h3><p>Run download and upload throughput tests, plus browser-based HTTP response-time and variation estimates.</p><h3>Understand connection issues</h3><p>Explore practical recommendations for common causes such as congestion, weak Wi-Fi conditions and competing network traffic.</p><h3>Explore your network</h3><p>Review available network-edge information, connection signals and public website endpoint checks.</p></section><section><h2>Built in India. Connecting the world.</h2><p>TEZZ CONNECT is an independent digital platform built for people who want clearer information about their internet connection.</p></section><section><h2>How measurements work</h2><p>Speed tests run in your browser against TEZZ CONNECT endpoints. Latency and response variation use HTTP request and response timing to our network edge; they are not ICMP ping measurements.</p></section><section><h2>Privacy and control</h2><p>Local test history stays in your browser. Regional benchmark contributions are optional and require your consent. The tools do not need your GPS location or street address.</p></section><section><h2>Contact us</h2><p>Questions, issues or ideas? Email <a href="mailto:tezzconnect.contact@gmail.com">tezzconnect.contact@gmail.com</a>.</p></section><p><a href="/">Start a speed test</a></p></main>`,
      },
      "/internet-doctor": {
        title: "Internet Doctor – Diagnose Slow or Unstable Internet | TEZZ CONNECT",
        description: "Investigate slow or unstable internet with practical connection checks. Review speed, response time, Wi-Fi and stability signals, then follow clear troubleshooting steps.",
        canonical: "https://tezzconnect.online/internet-doctor",
        fallback: `<main id="seo-fallback"><header><p>INTERNET CONNECTION TROUBLESHOOTING</p><h1>Find out why your internet feels slow or unstable.</h1><p>Internet Doctor brings common connection checks together and explains what each result can—and cannot—tell you.</p></header><section><h2>Check the signals behind a connection problem</h2><ul><li><strong>Throughput:</strong> compare download and upload measurements with the needs of your activity.</li><li><strong>Response time:</strong> review browser-to-edge HTTP response timing; this is not an ICMP ping measurement.</li><li><strong>Stability:</strong> look for failed or unusually slow responses across repeated checks.</li><li><strong>Device and network state:</strong> check whether the browser reports an offline connection and whether network information is available.</li></ul></section><section><h2>Practical steps to try</h2><p>Move closer to the router, pause large downloads and cloud backups, restart network equipment when appropriate, and compare results on another device or connection. Change one thing at a time and test again.</p><p>Start with the <a href="/">free internet speed test</a>, then read the <a href="/guides/connection-troubleshooter/">connection troubleshooting guide</a> and <a href="/guides/latency-and-jitter/">latency and jitter guide</a>.</p></section><section><h2>Understand the limits</h2><p>Browser checks are useful clues, not a complete diagnosis of your ISP, router or every website. Results can vary with Wi-Fi conditions, device load, congestion and routing.</p></section></main>`,
      },
      "/tools": {
        title: "Free Network Tools – Check Connection, Latency & Network Details | TEZZ CONNECT",
        description: "Explore free browser-based network tools to check connection status, HTTP response timing, stability and available network details, with plain-language explanations.",
        canonical: "https://tezzconnect.online/tools",
        fallback: `<main id="seo-fallback"><header><p>FREE BROWSER-BASED NETWORK UTILITIES</p><h1>Practical network tools to understand your connection.</h1><p>Use simple checks to explore connection status, response timing and the network information your browser can access.</p></header><section><h2>What you can investigate</h2><ul><li><strong>Connection status:</strong> see whether your browser currently reports that the device is online.</li><li><strong>HTTP response timing:</strong> measure how quickly a TEZZ CONNECT endpoint responds to browser requests.</li><li><strong>Stability:</strong> repeat checks to observe slow or failed responses over a short period.</li><li><strong>Network information:</strong> review browser-exposed connection hints and available edge details where supported.</li></ul></section><section><h2>Use the result in context</h2><p>Browser timing is not the same as ICMP ping, and browser-exposed network details are not available on every device. Compare repeated results and, where possible, test another device or network.</p><p>Continue with <a href="/internet-doctor">Internet Doctor</a>, the <a href="/">internet speed test</a> or the <a href="/guides/how-the-internet-works/">guide to how the internet works</a>.</p></section></main>`,
      },
      "/global-network": {
        title: "Global Network Benchmarks – Regional Internet Performance | TEZZ CONNECT",
        description: "Explore aggregate regional internet performance benchmarks from participating TEZZ CONNECT tests. See how opt-in samples are grouped and understand their limits.",
        canonical: "https://tezzconnect.online/global-network",
        fallback: `<main id="seo-fallback"><header><p>COMMUNITY NETWORK BENCHMARKS</p><h1>Explore regional internet performance signals.</h1><p>Global Network presents aggregate measurements from people who choose to contribute completed TEZZ CONNECT tests.</p></header><section><h2>What the regional view represents</h2><p>Available summaries group participating samples by reported country and region over a recent seven-day window. A region appears only after it reaches the minimum sample threshold.</p><ul><li><strong>Download and upload:</strong> average throughput reported by participating tests.</li><li><strong>Response time and variation:</strong> browser-based HTTP timing measurements to TEZZ CONNECT endpoints.</li><li><strong>Sample count:</strong> the number of contributions included in the aggregate.</li></ul></section><section><h2>Privacy and interpretation</h2><p>Contributions are optional and require explicit consent. The public view is an aggregate, not a live map of every ISP or a guarantee of the performance any individual will receive. Small or unavailable samples may not appear.</p><p>Run your own <a href="/">internet speed test</a> to compare your connection, or use <a href="/internet-doctor">Internet Doctor</a> to investigate issues.</p></section></main>`,
      },
    };
    const seoPage = seoPages[url.pathname]
    if (response.status === 200 &&
        (response.headers.get("Content-Type") ?? "").includes("text/html") &&
        seoPage) {
      const { title, description, canonical, fallback } = seoPage
      // Keep the crawlable fallback for search crawlers, but do not flash it
      // in normal browsers while the React application is starting.
      const userAgent = request.headers.get("User-Agent") ?? ""
      const isCrawler = /Googlebot|Bingbot|DuckDuckBot|Baiduspider|YandexBot|Slurp|facebookexternalhit|Twitterbot|LinkedInBot/i.test(userAgent)
      const fallbackStyles = `
        :root{color-scheme:dark;background:#090f1f}
        html,body{min-height:100%;margin:0;background:#090f1f;color:#edf3ff;font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif}
        #root{min-height:100vh;background:radial-gradient(ellipse at 72% -15%,rgba(34,211,238,.12),transparent 42%),#090f1f}
        #seo-fallback{width:min(1080px,calc(100% - 64px));margin:0 auto;padding:clamp(48px,8vh,88px) 0 64px;line-height:1.7;color:#dce8f5}
        #seo-fallback header{max-width:760px;padding:34px 38px;border:1px solid #24384e;border-radius:16px;background:linear-gradient(145deg,#102235,#0c1625);box-shadow:0 18px 55px #0004}
        #seo-fallback header>p:first-child{font:500 10px ui-monospace,monospace;letter-spacing:2px;color:#63d9d6}
        #seo-fallback h1{margin:14px 0;font-size:clamp(32px,4.5vw,54px);line-height:1.12;letter-spacing:-1.8px;color:#f5f9ff}
        #seo-fallback header p:last-child{max-width:680px;color:#9aabc0;font-size:15px}
        #seo-fallback section{max-width:900px;margin:28px 0;padding:22px 26px;border:1px solid #202e43;border-radius:13px;background:#0e1929}
        #seo-fallback h2{margin:0 0 12px;color:#edf5ff;font-size:20px;letter-spacing:-.4px}
        #seo-fallback h3{margin:18px 0 4px;color:#dce9f7;font-size:14px}
        #seo-fallback p,#seo-fallback li{color:#91a0b5;font-size:13px;line-height:1.8}
        #seo-fallback ul{padding-left:20px}
        #seo-fallback a{color:#63d9d6;text-decoration:none}
        #seo-fallback a:hover{text-decoration:underline}
        #seo-fallback section p:last-child{margin-bottom:0}
        @media(max-width:720px){#seo-fallback{width:calc(100% - 32px);padding:28px 0 40px}#seo-fallback header{padding:24px 20px}#seo-fallback h1{font-size:34px}#seo-fallback header p:last-child{font-size:13px}#seo-fallback section{padding:18px 16px;margin:16px 0}#seo-fallback h2{font-size:17px}}
      `
      if (isCrawler) {
        // Serve a complete crawlable document instead of mutating the static SPA shell.
        const html = '<!doctype html>\n<html lang="en">\n<head>\n' +
          '  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
          '  <meta name="theme-color" content="#090f1f" />\n  <title>' + title + '</title>\n' +
          '  <meta name="description" content="' + description + '" />\n  <link rel="canonical" href="' + canonical + '" />\n' +
          '  <meta property="og:type" content="website" />\n  <meta property="og:title" content="' + title + '" />\n' +
          '  <meta property="og:description" content="' + description + '" />\n  <meta property="og:url" content="' + canonical + '" />\n' +
          '  <meta name="twitter:card" content="summary" />\n  <meta name="twitter:title" content="' + title + '" />\n' +
          '  <meta name="twitter:description" content="' + description + '" />\n  <style>' + fallbackStyles + '</style>\n' +
          '</head>\n<body>' + fallback + '</body>\n</html>'
        return new Response(html, { status: 200, headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        } })
      }
      const transformed = new HTMLRewriter()
        .on("head", { element(element) { if (isCrawler) element.append(`<style id="tezz-initial-fallback">${fallbackStyles}</style>`, { html: true }) } })
        .on("title", { element(element) { element.setInnerContent(title) } })
        .on('meta[name="description"]', { element(element) { element.setAttribute("content", description) } })
        .on('link[rel="canonical"]', { element(element) { element.setAttribute("href", canonical) } })
        .on('meta[property="og:title"]', { element(element) { element.setAttribute("content", title) } })
        .on('meta[property="og:description"]', { element(element) { element.setAttribute("content", description) } })
        .on('meta[property="og:url"]', { element(element) { element.setAttribute("content", canonical) } })
        .on('meta[name="twitter:title"]', { element(element) { element.setAttribute("content", title) } })
        .on('meta[name="twitter:description"]', { element(element) { element.setAttribute("content", description) } })
        .on("#root", { element(element) { if (isCrawler) element.append(fallback, { html: true }) } })
        .transform(response)
      // Crawler and browser responses differ by User-Agent. Prevent shared
      // edge/browser caches from serving one variant to the other.
      const headers = new Headers(transformed.headers)
      headers.set("Cache-Control", "no-store")
      return new Response(transformed.body, {
        status: transformed.status,
        statusText: transformed.statusText,
        headers,
      })
    }

    // The About route is a client-rendered SPA view. Set its SEO metadata at
    // the edge as well, so crawlers receive the route-specific canonical and
    // description in the initial HTML before React hydrates.
    if ((url.pathname === "/about" || url.pathname === "/about/") &&
        response.status === 200 &&
        (response.headers.get("Content-Type") ?? "").includes("text/html")) {
      return new HTMLRewriter()
        .on("title", {
          element(element) {
            element.setInnerContent("About TEZZ CONNECT | Internet Performance Tools")
          },
        })
        .on('link[rel="canonical"]', {
          element(element) {
            element.setAttribute("href", "https://tezzconnect.online/about")
          },
        })
        .on('meta[name="description"]', {
          element(element) {
            element.setAttribute("content", "Learn about TEZZ CONNECT, a free browser-based toolkit for measuring internet performance, understanding network behaviour and making informed connectivity decisions.")
          },
        })
        .on('meta[property="og:title"]', {
          element(element) {
            element.setAttribute("content", "About TEZZ CONNECT | Internet Performance Tools")
          },
        })
        .on('meta[property="og:description"]', {
          element(element) {
            element.setAttribute("content", "Learn about TEZZ CONNECT, a free browser-based toolkit for measuring internet performance, understanding network behaviour and making informed connectivity decisions.")
          },
        })
        .on('meta[property="og:url"]', {
          element(element) {
            element.setAttribute("content", "https://tezzconnect.online/about")
          },
        })
        .transform(response)
    }

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

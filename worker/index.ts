interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  API_RATE_LIMITER: RateLimitBinding
  TRANSFER_RATE_LIMITER: RateLimitBinding
}

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate", "X-Content-Type-Options": "nosniff" }

function json(message: string, status = 200) {
  return new Response(JSON.stringify({ ok: status < 400, message }), {
    status,
    headers: { ...noStore, "Content-Type": "application/json; charset=utf-8" },
  })
}

export default {
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
      if (!Number.isSafeInteger(requested) || requested < 1 || requested > 5_000_000) {
        return json("Download size must be between 1 byte and 5 MB", 400)
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
} satisfies ExportedHandler<Env>

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
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

    if (url.pathname === "/api/services/check") {
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

    if (url.pathname === "/api/network/edge") {
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

    if (url.pathname === "/api/speed/ping") {
      if (request.method !== "GET" && request.method !== "HEAD") return json("Method not allowed", 405)
      return new Response(null, { status: 204, headers: noStore })
    }

    if (url.pathname === "/api/speed/download") {
      if (request.method !== "GET" && request.method !== "HEAD") return json("Method not allowed", 405)
      const requested = Number(url.searchParams.get("bytes") ?? "1000000")
      if (!Number.isSafeInteger(requested) || requested < 1 || requested > 1_000_000) {
        return json("Download size must be between 1 byte and 1 MB", 400)
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

    if (url.pathname === "/api/speed/upload") {
      if (request.method !== "POST") return json("Method not allowed", 405)
      if (!request.body) return json("Upload payload is missing", 400)
      try {
        const payload = await request.arrayBuffer()
        if (payload.byteLength !== 1_000_000) {
          return json(`Upload payload size mismatch: received ${payload.byteLength} bytes; expected 1000000`, 400)
        }
        return json("Upload received")
      } catch {
        return json("Upload payload could not be read completely", 400)
      }
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

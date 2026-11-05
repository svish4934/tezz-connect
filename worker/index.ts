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

    if (url.pathname === "/api/speed/ping") {
      if (request.method !== "GET" && request.method !== "HEAD") return json("Method not allowed", 405)
      return new Response(null, { status: 204, headers: noStore })
    }

    if (url.pathname === "/api/speed/download") {
      if (request.method !== "GET") return json("Method not allowed", 405)
      const requested = Number(url.searchParams.get("bytes") ?? "50000000")
      if (!Number.isSafeInteger(requested) || requested < 1 || requested > 50_000_000) {
        return json("Download size must be between 1 byte and 50 MB", 400)
      }
      const totalBytes = requested
      let sentBytes = 0
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sentBytes >= totalBytes) {
            controller.close()
            return
          }
          const chunkSize = Math.min(65_536, totalBytes - sentBytes)
          const chunk = new Uint8Array(chunkSize)
          crypto.getRandomValues(chunk)
          sentBytes += chunkSize
          controller.enqueue(chunk)
        },
      })
      return new Response(stream, {
        headers: { ...noStore, "Content-Type": "application/octet-stream", "Content-Length": String(totalBytes) },
      })
    }

    if (url.pathname === "/api/speed/upload") {
      if (request.method !== "POST") return json("Method not allowed", 405)
      const declaredLength = Number(request.headers.get("Content-Length") ?? "0")
      if (declaredLength > 50_000_000) return json("Upload payload exceeds 50 MB", 413)
      const body = await request.arrayBuffer()
      if (body.byteLength > 50_000_000) return json("Upload payload exceeds 50 MB", 413)
      return json("Upload received")
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

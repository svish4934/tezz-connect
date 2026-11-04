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

    if (url.pathname === "/api/speed/ping") {
      if (request.method !== "GET" && request.method !== "HEAD") return json("Method not allowed", 405)
      return new Response(null, { status: 204, headers: noStore })
    }

    if (url.pathname === "/api/speed/download") {
      if (request.method !== "GET") return json("Method not allowed", 405)
      const requested = Number(url.searchParams.get("bytes") ?? "1000000")
      if (!Number.isFinite(requested) || requested < 1 || requested > 5_000_000) {
        return json("Download size must be between 1 byte and 5 MB", 400)
      }
      const bytes = new Uint8Array(Math.floor(requested))
      for (let offset = 0; offset < bytes.length; offset += 65_536) {
        crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65_536, bytes.length)))
      }
      return new Response(bytes, {
        headers: { ...noStore, "Content-Type": "application/octet-stream", "Content-Length": String(bytes.byteLength) },
      })
    }

    if (url.pathname === "/api/speed/upload") {
      if (request.method !== "POST") return json("Method not allowed", 405)
      const declaredLength = Number(request.headers.get("Content-Length") ?? "0")
      if (declaredLength > 1_000_000) return json("Upload payload exceeds 1 MB", 413)
      const body = await request.arrayBuffer()
      if (body.byteLength > 1_000_000) return json("Upload payload exceeds 1 MB", 413)
      return json("Upload received")
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

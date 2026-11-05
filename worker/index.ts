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
      if (body.byteLength > 50_000_000) return json("Upload payload exceeds 1 MB", 413)
      return json("Upload received")
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

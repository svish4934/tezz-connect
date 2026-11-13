type AssetFetcher = { fetch(request: Request): Promise<Response> }

const API_PREFIX = "/language-api/v1"
const MANIFEST_PATH = "/locales/manifest.json"

function response(message: string, status: number, method: string): Response {
  return new Response(method === "HEAD" ? null : JSON.stringify({ ok: false, message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-API-Version": "language-v1",
    },
  })
}

/**
 * Independent, read-only language-content API.
 * It exposes only reviewed static locale assets; it never calls a machine
 * translation provider and does not read or write speed-test data.
 */
export async function handleLanguageApi(
  request: Request,
  assets: AssetFetcher,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(API_PREFIX + "/")) return null

  if (request.method !== "GET" && request.method !== "HEAD") {
    return response("Method not allowed", 405, request.method)
  }

  let assetPath = ""
  let cacheControl = "public, max-age=60, stale-while-revalidate=300"

  if (url.pathname === API_PREFIX + "/manifest") {
    assetPath = MANIFEST_PATH
  } else {
    const match = url.pathname.match(/^\/language-api\/v1\/bundles\/([a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?)$/)
    if (!match) return response("Unknown language API resource", 404, request.method)

    const manifestRequest = new Request(new URL(MANIFEST_PATH, url.origin), { method: "GET" })
    const manifestResponse = await assets.fetch(manifestRequest)
    if (!manifestResponse.ok) return response("Language manifest is temporarily unavailable", 503, request.method)

    let manifest: { locales?: Array<{ code?: string; status?: string; bundle?: string }> }
    try {
      manifest = await manifestResponse.json() as typeof manifest
    } catch {
      return response("Language manifest is invalid", 503, request.method)
    }

    const locale = manifest.locales?.find(item => item.code === match[1] && item.status === "published")
    if (!locale || !locale.bundle || !/^\/locales\/[a-zA-Z0-9-]+\/common\.json$/.test(locale.bundle)) {
      return response("Language bundle not found", 404, request.method)
    }
    assetPath = locale.bundle
    cacheControl = "public, max-age=300, stale-while-revalidate=3600"
  }

  const assetRequest = new Request(new URL(assetPath, url.origin), {
    method: request.method,
    headers: { "Accept": "application/json" },
  })
  const assetResponse = await assets.fetch(assetRequest)
  if (!assetResponse.ok) return response("Language content is temporarily unavailable", 503, request.method)

  const headers = new Headers(assetResponse.headers)
  headers.set("Content-Type", "application/json; charset=utf-8")
  headers.set("Cache-Control", cacheControl)
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-API-Version", "language-v1")
  return new Response(request.method === "HEAD" ? null : assetResponse.body, {
    status: assetResponse.status,
    headers,
  })
}

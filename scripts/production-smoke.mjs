const baseUrl = (process.env.TEZZ_BASE_URL || 'https://tezzconnect.online').replace(/\/$/, '')
const timeoutMs = 12_000
let failures = 0

async function check(name, path, validate, init) {
  try {
    const response = await fetch(new URL(path, baseUrl), {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual',
    })
    const body = init?.method === 'HEAD' ? '' : path.includes('/speed/download') && response.ok ? await response.arrayBuffer() : await response.text()
    const result = validate(response, body)
    if (!result) throw new Error(`unexpected HTTP ${response.status}`)
    process.stdout.write(`PASS  ${name}\n`)
  } catch (error) {
    failures++
    process.stderr.write(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}\n`)
  }
}

await check('API health and version', '/api/v1/health', (r, body) => {
  const data = JSON.parse(body)
  return r.status === 200 && data.ok === true && data.version === 'v1' && r.headers.get('x-api-version') === 'v1'
})
await check('Ping endpoint', '/api/v1/speed/ping', r => r.status === 204)
await check('Ping rejects unsupported method', '/api/v1/speed/ping', r => r.status === 405, { method: 'POST' })
await check('Download exact payload and content type', '/api/v1/speed/download?bytes=65536', (r, body) =>
  r.status === 200 && body.byteLength === 65536 && r.headers.get('content-type')?.includes('application/octet-stream') &&
  r.headers.get('content-length') === '65536')
await check('Download size limit', '/api/v1/speed/download?bytes=6000000', r => r.status === 400)
await check('Upload accepts exact payload', '/api/v1/speed/upload?bytes=65536', (r, body) =>
  r.status === 200 && JSON.parse(body).ok === true,
  { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(65536) })
await check('Upload rejects size mismatch', '/api/v1/speed/upload?bytes=65536', r => r.status === 400,
  { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(1024) })
await check('Sitemap XML', '/sitemap.xml', (r, body) =>
  r.status === 200 && r.headers.get('content-type')?.includes('application/xml') && body.includes('<urlset') && body.includes('https://tezzconnect.online/'))
await check('Robots policy', '/robots.txt', (r, body) =>
  r.status === 200 && r.headers.get('content-type')?.includes('text/plain') && body.includes('Sitemap: https://tezzconnect.online/sitemap.xml'))

if (failures > 0) {
  process.stderr.write(`\\nProduction smoke checks failed: ${failures}\\n`)
  process.exitCode = 1
} else {
  process.stdout.write('\\nAll production smoke checks passed.\\n')
}

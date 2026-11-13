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
    if (result !== true) throw new Error(typeof result === 'string' ? result : `unexpected HTTP ${response.status}`)
    process.stdout.write(`PASS  ${name}\n`)
  } catch (error) {
    failures++
    process.stderr.write(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}\n`)
  }
}


const appRoutes = [
  ['Home route', '/'],
  ['Internet Doctor direct route', '/internet-doctor'],
  ['Network tools direct route', '/tools'],
  ['Global Network direct route', '/global-network'],
  ['History direct route', '/history'],
  ['Report direct route', '/report'],
  ['About direct route', '/about'],
]
for (const [name, path] of appRoutes) {
  await check(name, path, (r, body) =>
    r.status === 200 &&
    r.headers.get('content-type')?.includes('text/html') &&
    body.includes('<div id="root"') &&
    body.includes('/assets/'))
}


for (const [name, path] of [
  ['Simplified Chinese localized homepage route', '/zh-CN/'],
  ['Brazilian Portuguese localized tools route', '/pt-BR/tools'],
  ['Arabic localized homepage route', '/ar/'],
]) {
  await check(name, path, (r, body) =>
    r.status === 200 && r.headers.get('content-type')?.includes('text/html') &&
    body.includes('<div id="root"') && body.includes('/assets/'))
}

await check('Cloudflare country locale endpoint', '/locale-country', (r, body) => {
  const data = JSON.parse(body)
  return r.status === 200 && r.headers.get('content-type')?.includes('application/json') &&
    typeof data.country === 'string'
})
await check('Simplified Chinese static locale bundle', '/locales/zh-CN/common.json', (r, body) => {
  const data = JSON.parse(body)
  return r.status === 200 && data['INTERNET SPEED TEST'] === '互联网速度测试' &&
    data._meta?.pageTitles?.Overview && data._meta?.pageDescriptions?.Overview
})
await check('Arabic locale bundle and RTL metadata', '/locales/ar/common.json', (r, body) => {
  const data = JSON.parse(body)
  return r.status === 200 && data['INTERNET SPEED TEST'] === 'اختبار سرعة الإنترنت' &&
    data._meta?.pageTitles?.Overview && data._meta?.pageDescriptions?.Overview
})

for (const [name, path, expected, title, canonical] of [
  ['Home crawler SEO fallback', '/', 'Test your internet speed with TEZZ CONNECT.', 'Free Internet Speed Test – Download, Upload & Response Time | TEZZ CONNECT', 'https://tezzconnect.online/'],
  ['About crawler SEO fallback', '/about', 'Understand your connection.', 'About TEZZ CONNECT | Internet Performance Tools', 'https://tezzconnect.online/about'],
  ['Internet Doctor crawler SEO fallback', '/internet-doctor', 'Find out why your internet feels slow or unstable.', 'Internet Doctor – Diagnose Slow or Unstable Internet | TEZZ CONNECT', 'https://tezzconnect.online/internet-doctor'],
  ['Network tools crawler SEO fallback', '/tools', 'Practical network tools to understand your connection.', 'Free Network Tools – Check Connection, Latency & Network Details | TEZZ CONNECT', 'https://tezzconnect.online/tools'],
  ['Global Network crawler SEO fallback', '/global-network', 'Explore regional internet performance signals.', 'Global Network Benchmarks – Regional Internet Performance | TEZZ CONNECT', 'https://tezzconnect.online/global-network'],
]) {
  await check(name, path, (r, body) => {
    const missing = []
    if (r.status !== 200) missing.push(`status=${r.status}`)
    if (!body.includes('id="seo-fallback"')) missing.push('fallback markup missing')
    if (!body.includes(expected)) missing.push('expected page text missing')
    if (!body.includes(`<title>${title}</title>`)) missing.push('expected title missing')
    if (!body.includes(`href="${canonical}"`)) missing.push('expected canonical missing')
    if (!(r.headers.get('cache-control') ?? '').includes('no-store')) missing.push('crawler response is cacheable')
    return missing.length ? `HTTP ${r.status}; ${missing.join(', ')}; content-type=${r.headers.get('content-type')}; body-start=${body.slice(0, 220).replace(/\\s+/g, ' ')}` : true
  }, { headers: { 'user-agent': 'Googlebot' } })
}

for (const [name, path] of [
  ['Home browser fallback hidden', '/'],
  ['About browser fallback hidden', '/about'],
  ['Internet Doctor browser fallback hidden', '/internet-doctor'],
  ['Network tools browser fallback hidden', '/tools'],
  ['Global Network browser fallback hidden', '/global-network'],
]) {
  await check(name, path, (r, body) =>
    r.status === 200 && !body.includes('id="seo-fallback"'))
}

await check('API health and version', '/api/v1/health', (r, body) => {
  const data = JSON.parse(body)
  return r.status === 200 && data.ok === true && data.version === 'v1' && r.headers.get('x-api-version') === 'v1' && Boolean(r.headers.get('x-request-id')) && Boolean(r.headers.get('server-timing'))
})
await check('Ping endpoint', '/api/v1/speed/ping', r => r.status === 204 && Boolean(r.headers.get('x-request-id')) && Boolean(r.headers.get('server-timing')))
await check('Ping rejects unsupported method', '/api/v1/speed/ping', r => r.status === 405, { method: 'POST' })
await check('Bounded streamed download and content type', '/api/v1/speed/download?durationMs=1000&maxBytes=1000000', (r, body) =>
  r.status === 200 && body.byteLength > 0 && body.byteLength <= 1_000_000 &&
  r.headers.get('content-type')?.includes('application/octet-stream') &&
  r.headers.get('content-length') === null)
await check('Download maximum-byte guardrail', '/api/v1/speed/download?durationMs=1000&maxBytes=26000000', r => r.status === 400)
await check('Upload accepts exact payload', '/api/v1/speed/upload?bytes=65536', (r, body) =>
  r.status === 200 && JSON.parse(body).ok === true,
  { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(65536) })
await check('Upload rejects size mismatch', '/api/v1/speed/upload?bytes=65536', r => r.status === 400,
  { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(1024) })
await check('Sitemap XML', '/sitemap.xml', (r, body) =>
  r.status === 200 && r.headers.get('content-type')?.includes('application/xml') && body.includes('<urlset') && body.includes('https://tezzconnect.online/') && ['/internet-doctor','/tools','/global-network'].every(path => body.includes(`https://tezzconnect.online${path}`)))

await check('Internet Knowledge Hub index', '/guides/', (r, body) =>
  r.status === 200 && body.includes('<title>Internet Knowledge Hub: Wi-Fi & Speed | TEZZ CONNECT</title>') &&
  body.includes('id="learning-paths"') && body.includes('id="hub-guide-list"') &&
  body.includes('/guides/internet-learning-roadmap/'))

for (const slug of [
  'connection-troubleshooter', 'home-network-planner', 'how-the-internet-works',
  'improve-wifi-speed', 'interactive-network-lab', 'internet-learning-roadmap',
  'internet-speed-explained', 'internet-speed-for-gaming', 'latency-and-jitter',
  'networking-buying-guides', 'networking-glossary', 'upload-speed-explained',
  'what-is-the-internet', 'wifi-security-checkup', 'wifi-signal-simulator',
]) {
  await check(`Guide metadata and breadcrumb: ${slug}`, `/guides/${slug}/`, (r, body) =>
    r.status === 200 && body.includes('<title>') && body.includes('rel="canonical"') &&
    body.includes('"@type":"BreadcrumbList"') && body.includes('https://tezzconnect.online/guides/'))
}

await check('Robots policy', '/robots.txt', (r, body) =>
  r.status === 200 && r.headers.get('content-type')?.includes('text/plain') && body.includes('Sitemap: https://tezzconnect.online/sitemap.xml'))

await check('llms.txt discovery guide', '/llms.txt', (r, body) =>
  r.status === 200 && /text\/(markdown|plain)/i.test(r.headers.get('content-type') ?? '') &&
  body.startsWith('# TEZZ CONNECT') && body.includes('https://tezzconnect.online/'))

for (const path of ['/.well-known/ard.json', '/.well-known/ai-catalog.json']) {
  await check(`ARD manifest ${path}`, path, (r, body) => {
    const data = JSON.parse(body)
    return r.status === 200 && r.headers.get('content-type')?.includes('application/json') &&
      Array.isArray(data.entries)
  })
}

await check('Benchmark summary endpoint', '/api/v1/benchmarks/summary', (r, body) => {
  const data = JSON.parse(body)
  return r.status === 200 && data.ok === true && data.minimumSamples === 30 && Array.isArray(data.regions)
})
await check('Benchmark submission requires explicit consent', '/api/v1/benchmarks/submit', (r, body) => {
  const data = JSON.parse(body)
  return r.status === 400 && data.ok === false
}, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ consent: false, protocolVersion: 'v1', downloadMbps: 50, uploadMbps: 20, latencyMs: 30, jitterMs: 2 }) })

if (failures > 0) {
  process.stderr.write(`\nProduction smoke checks failed: ${failures}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('\nAll production smoke checks passed.\n')
}

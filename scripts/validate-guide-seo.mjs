import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const worker = await readFile('worker/index.ts', 'utf8')
const hub = await readFile('public/guides/index.html', 'utf8')
const sitemapMatch = worker.match(/if \(url\.pathname === "\\/sitemap\.xml"\)[\\s\\S]*?const body = `([\\s\\S]*?)`/)
if (!sitemapMatch) throw new Error('Could not find the Worker sitemap response')
const sitemap = sitemapMatch[1]
const urls = [...sitemap.matchAll(/<loc>(https:\/\/tezzconnect\.online\/[^<]+)<\/loc>/g)].map(match => match[1])
const errors = []
const guideUrls = urls.filter(url => new URL(url).pathname.startsWith('/guides/') && new URL(url).pathname !== '/guides/')
const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index)
if (duplicates.length) errors.push('Duplicate sitemap URLs: ' + [...new Set(duplicates)].join(', '))
if (guideUrls.length === 0) errors.push('No individual guide URLs found in sitemap')
if (!urls.includes('https://tezzconnect.online/guides/')) errors.push('Knowledge Hub index is missing from sitemap')
try { await readFile('public/guides/index.html', 'utf8') } catch { errors.push('Knowledge Hub index HTML file is missing') }

for (const url of guideUrls) {
  const pathname = new URL(url).pathname
  const slug = pathname.replace(/^\/guides\//, '').replace(/\/$/, '')
  const file = join('public', 'guides', slug, 'index.html')
  let html
  try {
    html = await readFile(file, 'utf8')
  } catch {
    errors.push(`Sitemap URL has no guide HTML file: ${url} (${file})`)
    continue
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
  const description = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]?.trim()
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i)?.[1]?.trim()
  const h1Count = (html.match(/<h1\b/gi) ?? []).length
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i)?.[1] ?? ''
  if (!title) errors.push(`Missing title: ${url}`)
  if (!description) errors.push(`Missing meta description: ${url}`)
  if (canonical !== url) errors.push(`Canonical mismatch: ${url} (found: ${canonical ?? 'missing'})`)
  if (h1Count !== 1) errors.push(`Expected exactly one H1, found ${h1Count}: ${url}`)
  if (/noindex/i.test(robots)) errors.push(`Guide has a noindex directive: ${url}`)
  if (!hub.includes(`href="${pathname}"`) && !hub.includes(`href="${pathname.replace(/\/$/, '')}"`)) {
    errors.push(`Guide is missing from Knowledge Hub internal links: ${url}`)
  }
}

const hubGuideLinks = [...hub.matchAll(/href=["'](\/guides\/[^"'#?]+)\/?["']/g)]
  .map(match => match[1].replace(/\/$/, '') + '/')
const uniqueHubGuideLinks = [...new Set(hubGuideLinks)]
const sitemapPaths = new Set(guideUrls.map(url => new URL(url).pathname))
for (const path of uniqueHubGuideLinks) {
  if (!sitemapPaths.has(path)) errors.push(`Knowledge Hub links to a guide missing from sitemap: ${path}`)
}

if (errors.length) {
  console.error('Knowledge Hub SEO validation failed:')
  for (const error of errors) console.error(' - ' + error)
  process.exit(1)
}
console.log(`Knowledge Hub SEO validation passed: ${urls.length} sitemap URLs, ${guideUrls.length} individual guides, ${uniqueHubGuideLinks.length} unique guide links; titles, descriptions, canonicals, H1s, indexability and internal links checked.`)

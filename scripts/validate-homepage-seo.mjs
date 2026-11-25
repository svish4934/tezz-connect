import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [html, app, worker] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../worker/index.ts', import.meta.url), 'utf8'),
])

const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? ''
const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? ''
assert.match(title, /^Free Internet Speed Test/i, 'Homepage title must lead with the primary search intent')
assert.ok(description.length >= 120 && description.length <= 170, `Homepage description length should be 120–170 characters; found ${description.length}`)
assert.match(html, /rel="canonical" href="https:\/\/tezzconnect\.online\/" /)
assert.match(html, /"@type": "FAQPage"/, 'Homepage should expose FAQ structured data')

const questions = [
  "Why is my Wi-Fi speed different from the speed in my ISP plan?",
  "What ping is ideal for gaming or video calls?",
  "What causes high jitter or inconsistent response times?",
  "How can I improve my broadband speed?",
  "How does the Tezz internet speed test work?"
]
for (const question of questions) {
  assert.ok(app.includes(question), `Visible homepage FAQ missing: ${question}`)
  assert.ok(worker.includes(question), `Crawler homepage FAQ missing: ${question}`)
}
assert.match(app, /Wi-Fi Troubleshooting/, 'Homepage must not imply that the browser reads Wi-Fi radio signal strength')
assert.match(app, /language === 'en'/, 'English-only editorial copy must not overwrite other localized homepages')
assert.match(worker, /HTTP request-and-response timing to the TEZZ CONNECT edge/, 'Crawler copy must explain the actual latency method')
assert.match(worker, /Explore the Internet Knowledge Hub/, 'Crawler copy should link to the separate Knowledge Hub')
assert.match(worker, /Visit the Blog/, 'Crawler copy should retain the separate Blog link')

console.log('English homepage SEO, FAQ parity and measurement-accuracy checks passed.')

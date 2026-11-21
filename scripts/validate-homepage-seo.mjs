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
  'What does an internet speed test measure?',
  'Why is my internet slow when the speed test looks good?',
  'What is the difference between download and upload speed?',
  'Is TEZZ CONNECT latency the same as a traditional ping test?',
  'Can an internet speed test measure my Wi-Fi signal strength?',
  'Why do I get different results each time I test?',
]
for (const question of questions) {
  assert.ok(app.includes(question), `Visible homepage FAQ missing: ${question}`)
  assert.ok(worker.includes(question), `Crawler homepage FAQ missing: ${question}`)
}
assert.match(app, /Wi-Fi Troubleshooting/, 'Homepage must not imply that the browser reads Wi-Fi radio signal strength')
assert.match(app, /language === 'en'/, 'English-only editorial copy must not overwrite other localized homepages')
assert.match(worker, /browser HTTP request-and-response timing/, 'Crawler copy must explain the actual latency method')
assert.match(worker, /Explore the Internet Knowledge Hub/, 'Crawler copy should link to the separate Knowledge Hub')
assert.match(worker, /Visit the Blog/, 'Crawler copy should retain the separate Blog link')

console.log('English homepage SEO, FAQ parity and measurement-accuracy checks passed.')

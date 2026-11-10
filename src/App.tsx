import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDown, ArrowUp, CheckCircle2, ClipboardCopy, MonitorPlay, Video, Gamepad2, Globe2, Network, Server,
  History, Monitor, HeartPulse, Stethoscope, ArrowLeftRight, Grid2X2, Search,
  ShieldCheck, Signal, Wifi, Zap, Home
} from 'lucide-react'

type TestState = 'idle' | 'running' | 'complete' | 'error'
type TestResult = { download: number; upload: number; ping: number; jitter: number; date: string; trace?: number[] }
type LatencyRecord = { average: number; min: number; max: number; jitter: number; failures: number; date: string }
type StabilityRecord = { average: number; highest: number; p95?: number; jitter: number; spikes: number; failures: number; samples: number; date: string }
type ServiceResult = { name: string; status: 'Checking' | 'Responding' | 'Could not verify'; ms?: number }
const services = [{ name: 'Facebook', url: 'https://www.facebook.com/', icon: 'https://cdn.simpleicons.org/facebook/1877F2' }, { name: 'Instagram', url: 'https://www.instagram.com/', icon: 'https://cdn.simpleicons.org/instagram/E4405F' }, { name: 'YouTube', url: 'https://www.youtube.com/', icon: 'https://cdn.simpleicons.org/youtube/FF0033' }, { name: 'WhatsApp', url: 'https://www.whatsapp.com/', icon: 'https://cdn.simpleicons.org/whatsapp/25D366' }, { name: 'Netflix', url: 'https://www.netflix.com/', icon: 'https://cdn.simpleicons.org/netflix/E50914' }, { name: 'Google', url: 'https://www.google.com/', icon: 'https://cdn.simpleicons.org/google/4285F4' }, { name: 'X', url: 'https://x.com/', icon: 'https://cdn.simpleicons.org/x/000000' }, { name: 'TikTok', url: 'https://www.tiktok.com/', icon: 'https://cdn.simpleicons.org/tiktok/000000' }]

const BASELINE_BYTES = 1_000_000
const downloadUrl = (bytes: number) => `/api/v1/speed/download?bytes=${bytes}`
const uploadUrl = (bytes: number) => `/api/v1/speed/upload?bytes=${bytes}`

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))
  return sorted[index]
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}


type HealthScore = { total: number; latency: number; consistency: number; reliability: number; spikes: number; label: string }

function calculateHealthScore(record: StabilityRecord): HealthScore | null {
  const totalProbes = record.samples + record.failures
  if (totalProbes < 20 || record.samples < 15 || typeof record.p95 !== 'number' || !Number.isFinite(record.p95)) return null
  const clamp = (value: number) => Math.max(0, Math.min(1, value))
  const latency = 30 * clamp((500 - record.p95) / 400)
  const consistency = 25 * clamp((100 - record.jitter) / 90)
  const reliability = 25 * clamp(record.samples / totalProbes)
  const spikeRate = record.spikes / record.samples
  const spikes = 20 * clamp(1 - spikeRate / 0.2)
  const total = Math.round(latency + consistency + reliability + spikes)
  return { total, latency: Math.round(latency), consistency: Math.round(consistency), reliability: Math.round(reliability), spikes: Math.round(spikes), label: total >= 90 ? 'Excellent' : total >= 75 ? 'Good' : total >= 55 ? 'Fair' : 'Needs attention' }
}

function choosePayloadBytes(calibrationMbps: number): number {
  // Larger samples reduce timing noise on faster connections while keeping
  // data use bounded for mobile users.
  if (calibrationMbps >= 100) return 10_000_000
  if (calibrationMbps >= 25) return 5_000_000
  return 2_000_000
}

async function measurePing(): Promise<{ ping: number; jitter: number }> {
  const warmup = await fetch('/api/v1/speed/ping', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!warmup.ok) throw new Error('Latency test endpoint unavailable')
  const samples: number[] = []
  for (let i = 0; i < 7; i++) {
    const start = performance.now()
    const response = await fetch('/api/v1/speed/ping', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('Latency test endpoint unavailable')
    samples.push(performance.now() - start)
  }
  const differences = samples.slice(1).map((value, index) => Math.abs(value - samples[index]))
  const meanVariation = differences.length ? differences.reduce((sum, value) => sum + value, 0) / differences.length : 0
  return { ping: median(samples), jitter: meanVariation }
}

async function measureDownload(bytes: number, onSample: (mbps: number, receivedBytes: number) => void): Promise<number> {
  const start = performance.now()
  const response = await fetch(downloadUrl(bytes), { cache: 'no-store', signal: AbortSignal.timeout(90000) })
  const contentType = response.headers.get('content-type') ?? 'missing'
  const contentLength = response.headers.get('content-length')
  if (!response.ok) throw new Error(`Download endpoint returned HTTP ${response.status} (${contentType})`)
  if (!contentType.toLowerCase().includes('application/octet-stream')) {
    const preview = (await response.clone().text()).slice(0, 120).replace(/\\s+/g, ' ')
    throw new Error(`Download endpoint returned unexpected content type: ${contentType}. Response: ${preview || 'empty'}`)
  }
  if (contentLength !== null && Number(contentLength) !== bytes) {
    throw new Error(`Download endpoint declared ${contentLength} bytes; expected ${bytes}`)
  }
  if (!response.body) {
    const data = await response.arrayBuffer()
    if (data.byteLength !== bytes) throw new Error(`Download test incomplete: received ${data.byteLength} of ${bytes} bytes`)
    const seconds = (performance.now() - start) / 1000
    const mbps = (data.byteLength * 8) / Math.max(seconds, 0.001) / 1_000_000
    onSample(mbps, data.byteLength)
    return mbps
  }
  const reader = response.body.getReader()
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    const seconds = (performance.now() - start) / 1000
    const mbps = (receivedBytes * 8) / Math.max(seconds, 0.001) / 1_000_000
    onSample(mbps, receivedBytes)
  }
  if (receivedBytes !== bytes) throw new Error(`Download test incomplete: received ${receivedBytes} of ${bytes} bytes`)
  const seconds = (performance.now() - start) / 1000
  return (receivedBytes * 8) / Math.max(seconds, 0.001) / 1_000_000
}

async function measureUpload(bytes: number, onProgress: (sentBytes: number, mbps: number) => void): Promise<number> {
  const payload = new Uint8Array(bytes)
  for (let offset = 0; offset < payload.length; offset += 65_536) {
    crypto.getRandomValues(payload.subarray(offset, Math.min(offset + 65_536, payload.length)))
  }
  const started = performance.now()
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', uploadUrl(bytes))
    request.timeout = 90000
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.upload.onprogress = event => {
      const sentBytes = Math.min(event.loaded, bytes)
      const seconds = Math.max((performance.now() - started) / 1000, 0.001)
      const mbps = (sentBytes * 8) / seconds / 1_000_000
      onProgress(sentBytes, mbps)
    }
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error('Upload test endpoint unavailable'))
        return
      }
      const seconds = Math.max((performance.now() - started) / 1000, 0.001)
      resolve((bytes * 8) / seconds / 1_000_000)
    }
    request.onerror = () => reject(new Error('Upload test network error'))
    request.ontimeout = () => reject(new Error('Upload test timed out after 90 seconds'))
    request.onabort = () => reject(new Error('Upload test was cancelled'))
    request.send(payload)
  })
}

const HISTORY_KEY = 'tezz-connect-test-history-v1'
const LATENCY_HISTORY_KEY = 'tezz-connect-latency-history-v1'
const STABILITY_HISTORY_KEY = 'tezz-connect-stability-history-v1'

function loadStabilityHistory(): StabilityRecord[] {
  try {
    const saved = localStorage.getItem(STABILITY_HISTORY_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is StabilityRecord =>
      item && typeof item.average === 'number' && typeof item.highest === 'number' &&
      typeof item.jitter === 'number' && typeof item.spikes === 'number' &&
      typeof item.failures === 'number' && typeof item.samples === 'number' &&
      typeof item.date === 'string'
    ).slice(0, 30)
  } catch { return [] }
}

function loadLatencyHistory(): LatencyRecord[] {
  try {
    const saved = localStorage.getItem(LATENCY_HISTORY_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is LatencyRecord =>
      item && typeof item.average === 'number' && typeof item.min === 'number' &&
      typeof item.max === 'number' && typeof item.jitter === 'number' &&
      typeof item.failures === 'number' && typeof item.date === 'string'
    ).slice(0, 30)
  } catch { return [] }
}

function loadHistory(): TestResult[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is TestResult =>
      item && typeof item.download === 'number' && typeof item.upload === 'number' &&
      typeof item.ping === 'number' && typeof item.jitter === 'number' && typeof item.date === 'string'
    ).map(item => ({ ...item, trace: Array.isArray(item.trace) ? item.trace.filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)).slice(-36) : [] })).slice(0, 50)
  } catch {
    return []
  }
}

function App() {
  const [state, setState] = useState<TestState>('idle')
  const [progress, setProgress] = useState(0)
  const [liveSpeed, setLiveSpeed] = useState(0)
  const [downloadBytes, setDownloadBytes] = useState(0)
  const [uploadBytes, setUploadBytes] = useState(0)
  const [uploadLiveSpeed, setUploadLiveSpeed] = useState(0)
  const [speedTrace, setSpeedTrace] = useState<number[]>([])
  const speedTraceRef = useRef<number[]>(speedTrace)
  function appendSpeedSample(value: number) {
    const next = [...speedTraceRef.current, value].slice(-36)
    speedTraceRef.current = next
    setSpeedTrace(next)
  }
  const [testPhase, setTestPhase] = useState('Ready to test')
  const [serviceResults, setServiceResults] = useState<ServiceResult[]>([])
  const [servicePhase, setServicePhase] = useState<'idle' | 'running' | 'complete'>('idle')
  const [reportMessage, setReportMessage] = useState('')
  const [testError, setTestError] = useState('')
  const [history, setHistory] = useState<TestResult[]>(loadHistory)
  const [result, setResult] = useState<TestResult | null>(null)
  const [benchmarkConsent, setBenchmarkConsent] = useState(() => { try { return localStorage.getItem('tezz_benchmark_consent_v1') === 'true' } catch { return false } })
  const [benchmarkStatus, setBenchmarkStatus] = useState('')
  type BenchmarkRegion = { country_code: string; region_code: string; sample_count: number; download_avg_mbps: number | null; upload_avg_mbps: number | null; latency_avg_ms: number | null; jitter_avg_ms: number | null }
  const [benchmarkRegions, setBenchmarkRegions] = useState<BenchmarkRegion[]>([])
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState('')
  const [benchmarkLoaded, setBenchmarkLoaded] = useState(false)

  async function refreshBenchmarkRegions() {
    setBenchmarkLoading(true)
    setBenchmarkError('')
    try {
      const response = await fetch('/api/v1/benchmarks/summary', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('Regional benchmark data is temporarily unavailable.')
      const data = await response.json() as { ok?: boolean; regions?: BenchmarkRegion[]; minimumSamples?: number }
      if (!data.ok || !Array.isArray(data.regions)) throw new Error('The benchmark service returned an invalid response.')
      setBenchmarkRegions(data.regions.filter(region => Number.isFinite(region.sample_count) && region.sample_count >= 30))
      setBenchmarkLoaded(true)
    } catch (error) {
      setBenchmarkError(error instanceof Error ? error.message : 'Could not load regional benchmark data.')
    } finally {
      setBenchmarkLoading(false)
    }
  }


  const routeToTab: Record<string, string> = {
    '/': 'Overview',
    '/internet-doctor': 'Internet Doctor',
    '/tools': 'Network',
    '/global-network': 'Global Network',
    '/history': 'History',
    '/report': 'Report',
    '/about': 'About',
  }
  const tabToRoute: Record<string, string> = Object.fromEntries(Object.entries(routeToTab).map(([path, tab]) => [tab, path]))
  const [activeTab, setActiveTab] = useState(() => routeToTab[window.location.pathname] ?? 'Overview')
  useEffect(() => {
    if (activeTab === 'Global Network' && !benchmarkLoaded && !benchmarkLoading) void refreshBenchmarkRegions()
  }, [activeTab, benchmarkLoaded, benchmarkLoading])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function navigateTo(tab: string) {
    setMobileMenuOpen(false)
    const nextPath = tabToRoute[tab] ?? '/'
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const handlePopState = () => {
      setMobileMenuOpen(false)
      setActiveTab(routeToTab[window.location.pathname] ?? 'Overview')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const titles: Record<string, string> = {
      Overview: 'Free Internet Speed Test | TEZZ CONNECT',
      'Internet Doctor': 'Internet Doctor | TEZZ CONNECT',
      Network: 'Network Tools | TEZZ CONNECT',
      'Global Network': 'Global Network Intelligence | TEZZ CONNECT',
      History: 'Speed Test History | TEZZ CONNECT',
      Report: 'Performance Report | TEZZ CONNECT',
      About: 'About TEZZ CONNECT | Internet Performance Tools',
    }
    document.title = titles[activeTab] ?? 'TEZZ CONNECT | Internet Performance Tools'

    const descriptions: Record<string, string> = {
      About: 'Learn about TEZZ CONNECT, a free browser-based toolkit for measuring internet performance, understanding network behaviour and making informed connectivity decisions.',
    }
    const description = descriptions[activeTab]
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description && descriptionMeta) descriptionMeta.content = description
    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')
    if (description && ogDescription) ogDescription.content = description

    // Keep the canonical URL aligned with the SPA route instead of
    // inheriting the homepage canonical from the static HTML shell.
    const canonicalPath = tabToRoute[activeTab] ?? '/'
    const canonicalUrl = new URL(canonicalPath, window.location.origin).toString()
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')
    if (ogUrl) ogUrl.content = canonicalUrl
  }, [activeTab])
  const [edgeInfo, setEdgeInfo] = useState<{ colo: string; country: string; region: string; asn: number | null; organization: string; fetchedAt: string } | null>(null)
  const [edgeLoading, setEdgeLoading] = useState(false)
  const [edgeError, setEdgeError] = useState('')
  const [network, setNetwork] = useState<{ type: string; downlink: string; rtt: string; online: boolean; saveData: boolean; supported: boolean }>({
    type: 'Checking', downlink: '—', rtt: '—', online: navigator.onLine, saveData: false, supported: false
  })
  const [latencyRunning, setLatencyRunning] = useState(false)
  const [latencySamples, setLatencySamples] = useState<number[]>([])
  const [latencyFailures, setLatencyFailures] = useState(0)
  const [latencyError, setLatencyError] = useState('')
  const [latencyCompletedAt, setLatencyCompletedAt] = useState('')
  const [latencyHistory, setLatencyHistory] = useState<LatencyRecord[]>(loadLatencyHistory)
  const [stabilityRunning, setStabilityRunning] = useState(false)
  const [stabilitySamples, setStabilitySamples] = useState<number[]>([])
  const [stabilityFailures, setStabilityFailures] = useState(0)
  const [stabilityFinished, setStabilityFinished] = useState('')
  const [stabilityError, setStabilityError] = useState('')
  const [stabilityHistory, setStabilityHistory] = useState<StabilityRecord[]>(loadStabilityHistory)

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch { /* Storage may be unavailable or full. */ }
  }, [history])

  useEffect(() => {
    try { localStorage.setItem(LATENCY_HISTORY_KEY, JSON.stringify(latencyHistory)) } catch { /* Browser storage may be unavailable. */ }
  }, [latencyHistory])

  useEffect(() => {
    try { localStorage.setItem(STABILITY_HISTORY_KEY, JSON.stringify(stabilityHistory)) } catch { /* Browser storage may be unavailable. */ }
  }, [stabilityHistory])

  useEffect(() => {
    type NetworkConnection = EventTarget & { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }
    const connection = (navigator as Navigator & { connection?: NetworkConnection }).connection
    const refresh = () => setNetwork({
      type: connection?.effectiveType?.toUpperCase() ?? 'Not exposed by browser',
      downlink: typeof connection?.downlink === 'number' ? `${connection.downlink} Mbps` : 'Not reported',
      rtt: typeof connection?.rtt === 'number' ? `${connection.rtt} ms` : 'Not reported',
      online: navigator.onLine,
      saveData: connection?.saveData ?? false,
      supported: Boolean(connection),
    })
    refresh()
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    connection?.addEventListener('change', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
      connection?.removeEventListener('change', refresh)
    }
  }, [])

  const quality = useMemo(() => {
    if (!result) return 'Not tested'
    // Treat severe delay or response variation as a health concern even when throughput is adequate.
    if (result.download < 5 || result.upload < 1 || result.ping > 250 || result.jitter > 100) return 'Needs attention'
    if (result.download >= 100 && result.upload >= 20 && result.ping <= 40 && result.jitter <= 10) return 'Excellent'
    if (result.download >= 25 && result.upload >= 5 && result.ping <= 80 && result.jitter <= 20) return 'Good'
    return 'Fair'
  }, [result])

  const latestStability = stabilityHistory[0] ?? null
  const connectionHealthScore = latestStability ? calculateHealthScore(latestStability) : null

  const personalPerformanceBaseline = useMemo(() => {
    const recent = history.slice(0, 5)
    if (recent.length === 0) return null
    const medianDownload = median(recent.map(item => item.download))
    const medianUpload = median(recent.map(item => item.upload))
    const medianHttp = median(recent.map(item => item.ping))
    const previous = history.slice(5, 10)
    const previousDownload = previous.length >= 3 ? median(previous.map(item => item.download)) : null
    const downloadChange = previousDownload === null ? null : medianDownload - previousDownload
    return { count: recent.length, medianDownload, medianUpload, medianHttp, previousCount: previous.length, previousDownload, downloadChange }
  }, [history])

  const doctorFindings = useMemo(() => {
    type Finding = { title: string; detail: string; evidence: string; status: 'alert' | 'good' | 'neutral' }
    const findings: Finding[] = []
    if (!network.online) {
      findings.push({ title: 'Device reports offline', detail: 'The browser online flag is false. Reconnect to Wi-Fi or mobile data before interpreting speed results.', evidence: 'Browser connectivity state', status: 'alert' })
      return findings
    }
    if (!result) {
      findings.push({ title: 'Baseline measurements needed', detail: 'Run a speed test to measure download, upload and HTTP response behaviour.', evidence: 'No saved speed-test result', status: 'neutral' })
    } else {
      findings.push({
        title: result.download < 10 ? 'Low download throughput' : 'Download throughput',
        detail: result.download < 10 ? 'The measured download rate is low for many everyday activities. Pause competing traffic and compare a wired test if possible.' : 'The latest download measurement does not indicate a severe throughput restriction by this test threshold.',
        evidence: `Download ${result.download.toFixed(1)} Mbps`,
        status: result.download < 10 ? 'alert' : 'good',
      })
      findings.push({
        title: result.upload < 2 ? 'Limited upload throughput' : 'Upload throughput',
        detail: result.upload < 2 ? 'Cloud backups, file syncing or video uploads may compete for capacity. Pause them and repeat the measurement.' : 'The latest upload measurement does not indicate a severe restriction by this test threshold.',
        evidence: `Upload ${result.upload.toFixed(1)} Mbps`,
        status: result.upload < 2 ? 'alert' : 'good',
      })
      findings.push({
        title: result.ping > 100 ? 'Elevated HTTP response time' : 'HTTP response time',
        detail: result.ping > 100 ? 'The browser took longer to receive a response from the TEZZ edge. Compare another time and, if possible, another network.' : 'No severe HTTP response delay was observed in this test.',
        evidence: `Median HTTP response ${result.ping.toFixed(0)} ms`,
        status: result.ping > 100 ? 'alert' : 'good',
      })
      findings.push({
        title: result.jitter > 30 ? 'Variable HTTP response timing' : 'HTTP response timing consistency',
        detail: result.jitter > 30 ? 'Timing varied between requests. Background traffic, Wi-Fi conditions, device load or routing may contribute; repeat the test to confirm.' : 'The short HTTP timing sample was relatively consistent.',
        evidence: `HTTP response variation ${result.jitter.toFixed(1)} ms`,
        status: result.jitter > 30 ? 'alert' : 'good',
      })
    }
    if (latestStability) {
      const unstable = latestStability.failures >= 3 || latestStability.jitter > 40 || (typeof latestStability.p95 === 'number' && latestStability.p95 > 250)
      findings.push({
        title: unstable ? 'Stability monitor detected variation' : 'Stability monitor',
        detail: unstable ? 'The 30-probe HTTP monitor recorded elevated response variation, slow tail responses or failed requests. This indicates an intermittent path or measurement issue, not confirmed packet loss.' : 'The latest 30-probe HTTP monitor did not cross the Doctor’s elevated-variation thresholds.',
        evidence: `${latestStability.samples}/${latestStability.samples + latestStability.failures} successful · avg ${latestStability.average.toFixed(0)} ms · P95 ${typeof latestStability.p95 === 'number' ? latestStability.p95.toFixed(0) : 'not available'} ms`,
        status: unstable ? 'alert' : 'good',
      })
    } else {
      findings.push({ title: 'Stability evidence not available', detail: 'Run the 30-second stability monitor to check whether response behaviour remains consistent over time.', evidence: 'No completed stability monitor in this browser', status: 'neutral' })
    }
    if (latencyHistory[0]) {
      findings.push({
        title: 'Recent latency history available',
        detail: 'A separate latency run is available for comparison. Similar results across independent runs make a recurring pattern more credible.',
        evidence: `Average ${latencyHistory[0].average.toFixed(0)} ms · ${latencyHistory[0].failures} failed requests`,
        status: latencyHistory[0].average > 150 || latencyHistory[0].failures > 1 ? 'alert' : 'good',
      })
    }
    if (network.supported && network.downlink !== 'Not reported') {
      findings.push({ title: 'Browser network estimate', detail: 'This is a browser-provided estimate and may be rounded or stale. It is not a substitute for the measured speed test.', evidence: `${network.type} · estimated downlink ${network.downlink}`, status: 'neutral' })
    }
    return findings
  }, [network, result, latestStability, latencyHistory])

  const doctorRecommendations = useMemo(() => {
    if (!network.online) return [
      { title: 'Restore your connection', detail: 'Reconnect to Wi-Fi or mobile data, then run a fresh test.', priority: 'high' as const },
    ]
    if (!result) return [
      { title: 'Run a baseline speed test', detail: 'Measure download, upload and HTTP response time before troubleshooting.', priority: 'info' as const },
      { title: 'Run the stability monitor', detail: 'Collect 30 response samples to check for intermittent variation.', priority: 'info' as const },
    ]
    const items: { title: string; detail: string; priority: 'high' | 'medium' | 'info' }[] = []
    if (result.download < 10) items.push({ title: 'Check download congestion', detail: 'Pause large downloads and video streams on other devices. Move closer to the router and compare over Ethernet if available.', priority: 'high' })
    if (result.upload < 2) items.push({ title: 'Check upload activity', detail: 'Pause cloud backups, file syncing and outgoing video streams, then retest when the network is quieter.', priority: 'medium' })
    if (result.ping > 100 || (latestStability?.p95 ?? 0) > 250) items.push({ title: 'Compare response delays', detail: 'Repeat at a different time and compare Wi-Fi with a wired connection. High HTTP response time alone cannot identify whether the cause is Wi-Fi, ISP routing or the remote edge.', priority: 'high' })
    if (result.jitter > 30 || (latestStability?.jitter ?? 0) > 40) items.push({ title: 'Investigate intermittent variation', detail: 'Reduce distance and obstacles from the router, use a less congested Wi-Fi band, pause background traffic and rerun the stability monitor.', priority: 'medium' })
    if (latestStability && latestStability.failures >= 3) items.push({ title: 'Repeat failed probes on another network', detail: 'Switch between Wi-Fi and mobile data if possible. If failures occur on only one connection, share the timestamped report with the network provider.', priority: 'high' })
    if (items.length === 0) items.push({ title: 'No major threshold crossed', detail: 'These measurements did not flag a severe issue. If an app still performs poorly, test it during the problem and compare another network.', priority: 'info' })
    items.push({ title: 'Build a comparable baseline', detail: 'Repeat the same tests at another time and after any change. A consistent pattern is more useful than one result.', priority: 'info' })
    return items
  }, [network.online, result, latestStability])

  async function checkService(service: typeof services[number]): Promise<ServiceResult> {
    const started = performance.now()
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`/api/v1/services/check?site=${encodeURIComponent(service.name.toLowerCase())}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Service check endpoint unavailable')
      const data = await response.json() as { status: 'responding' | 'unavailable' | 'inconclusive' }
      if (data.status === 'responding') return { name: service.name, status: 'Responding', ms: Math.round(performance.now() - started) }
      return { name: service.name, status: 'Could not verify' }
    } catch {
      return { name: service.name, status: 'Could not verify' }
    } finally {
      window.clearTimeout(timer)
    }
  }

  async function runServiceChecks() {
    setServicePhase('running')
    setServiceResults(services.map(service => ({ name: service.name, status: 'Checking' })))
    const checks = await Promise.all(services.map(checkService))
    setServiceResults(checks)
    setServicePhase('complete')
  }

  async function copyPerformanceReport() {
    const latestSpeed = result
    const latestLatency = latencyHistory[0]
    const latestStability = stabilityHistory[0]
    const reachable = serviceResults.filter(item => item.status === 'Responding').length
    const lines = [
      'TEZZ CONNECT — PERFORMANCE REPORT',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'SPEED TEST',
      latestSpeed ? `Date: ${new Date(latestSpeed.date).toLocaleString()}\nDownload: ${latestSpeed.download.toFixed(1)} Mbps\nUpload: ${latestSpeed.upload.toFixed(1)} Mbps\nHTTP latency: ${latestSpeed.ping} ms\nHTTP response variation: ${latestSpeed.jitter.toFixed(1)} ms` : 'No speed test saved in this browser.',
      '',
      'LATENCY TEST',
      latestLatency ? `Date: ${new Date(latestLatency.date).toLocaleString()}\nAverage HTTP response: ${latestLatency.average.toFixed(1)} ms\nMinimum: ${latestLatency.min.toFixed(1)} ms\nMaximum: ${latestLatency.max.toFixed(1)} ms\nHTTP response variation: ${latestLatency.jitter.toFixed(1)} ms\nFailed requests: ${latestLatency.failures}/12` : 'No latency test saved in this browser.',
      '',
      'CONNECTION STABILITY',
      latestStability ? `Date: ${new Date(latestStability.date).toLocaleString()}\nSuccessful samples: ${latestStability.samples}/30\nAverage HTTP response: ${latestStability.average.toFixed(1)} ms\nHighest response: ${latestStability.highest.toFixed(1)} ms\n95th percentile response: ${latestStability.p95?.toFixed(1) ?? 'Not recorded'} ms\nMean successive HTTP response variation: ${latestStability.jitter.toFixed(1)} ms\nResponse spikes: ${latestStability.spikes}\nFailed requests: ${latestStability.failures}` : 'No completed stability monitor saved in this browser.',
      connectionHealthScore ? `Connection Health Score: ${connectionHealthScore.total}/100 (${connectionHealthScore.label})\nLatency: ${connectionHealthScore.latency}/30\nConsistency: ${connectionHealthScore.consistency}/25\nProbe reliability: ${connectionHealthScore.reliability}/25\nSpike control: ${connectionHealthScore.spikes}/20` : 'Connection Health Score: Not available (requires a completed monitor with at least 20 total probes and 15 successful samples).',
      '',
      'NETWORK CONTEXT',
      `Browser online: ${network.online ? 'Yes' : 'No'}\nEffective connection type: ${network.type}\nEstimated downlink: ${network.downlink}\nBrowser-reported RTT: ${network.rtt}\nPublic website endpoints responding: ${reachable}/${services.length}`,
      '',
      'MEASUREMENT NOTES',
      'Latency and response variation are HTTP request/response measurements to the TEZZ CONNECT edge, not ICMP ping. Failed HTTP requests are not packet loss. Public website checks measure endpoint reachability only, not login or in-app functionality. Browser-reported network details may be estimates or unavailable. Results vary with device, Wi-Fi, server distance and ISP routing.',
      '',
      'History is stored locally in this browser and is not synced across devices.'
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setReportMessage('Performance report copied')
    } catch {
      setReportMessage('Clipboard unavailable. Try your browser share or copy feature.')
    }
  }

  async function copyReport() {
    if (!result) return
    const reachable = serviceResults.filter(item => item.status === 'Responding').length
    const report = [
      'TEZZ CONNECT — Internet Health Report',
      `Test date: ${new Date(result.date).toLocaleString()}`,
      `Download: ${result.download} Mbps`,
      `Upload: ${result.upload} Mbps`,
      `HTTP latency: ${result.ping} ms`,
      `HTTP response variation: ${result.jitter} ms`,
      `Public service endpoints responding: ${reachable}/${services.length}`,
      'Note: HTTP timing is measured to the TEZZ CONNECT edge. Service checks confirm public endpoint reachability only; they do not test login or in-app functionality.'
    ].join('\n')
    try {
      await navigator.clipboard.writeText(report)
      setReportMessage('Report copied')
    } catch {
      setReportMessage('Clipboard unavailable in this browser')
    }
  }

  async function refreshEdgeInfo() {
    setEdgeLoading(true)
    setEdgeError('')
    try {
      const response = await fetch('/api/v1/network/info', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error('Edge information is temporarily unavailable.')
      const data = await response.json() as { colo?: string; country?: string; region?: string; asn?: number; organization?: string }
      if (!data.colo && !data.country && !data.asn) throw new Error('The network edge did not return location metadata.')
      setEdgeInfo({
        colo: data.colo || 'Not provided',
        country: data.country || 'Not provided',
        region: data.region || 'Not provided',
        asn: typeof data.asn === 'number' ? data.asn : null,
        organization: data.organization || 'Not provided',
        fetchedAt: new Date().toLocaleTimeString(),
      })
    } catch (error) {
      setEdgeError(error instanceof Error ? error.message : 'Could not retrieve network edge information.')
    } finally {
      setEdgeLoading(false)
    }
  }

  async function runLatencyCheck() {
    if (latencyRunning) return
    setLatencyRunning(true)
    setLatencySamples([])
    setLatencyFailures(0)
    setLatencyError('')
    setLatencyCompletedAt('')
    const samples: number[] = []
    let failures = 0
    try {
      for (let i = 0; i < 12; i++) {
        if (!navigator.onLine) {
          failures += 1
        } else {
          const started = performance.now()
          try {
            const response = await fetch(`/api/v1/speed/ping?sample=${i + 1}&t=${Date.now()}`, {
              method: 'GET',
              cache: 'no-store',
              signal: AbortSignal.timeout(5000),
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            samples.push(performance.now() - started)
          } catch {
            failures += 1
          }
        }
        setLatencySamples([...samples])
        setLatencyFailures(failures)
        if (i < 11) await new Promise(resolve => window.setTimeout(resolve, 180))
      }
      if (samples.length === 0) throw new Error('No latency samples were received. Check your connection and try again.')
      const completedDate = new Date().toISOString()
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
      const jitter = samples.length > 1 ? samples.slice(1).reduce((sum, value, index) => sum + Math.abs(value - samples[index]), 0) / (samples.length - 1) : 0
      setLatencyHistory(previous => [{ average, min: Math.min(...samples), max: Math.max(...samples), jitter, failures, date: completedDate }, ...previous].slice(0, 30))
      setLatencyCompletedAt(new Date().toLocaleTimeString())
    } catch (error) {
      setLatencyError(error instanceof Error ? error.message : 'Latency test could not complete.')
    } finally {
      setLatencyRunning(false)
    }
  }

  async function runStabilityMonitor() {
    if (stabilityRunning) return
    setStabilityRunning(true)
    setStabilitySamples([])
    setStabilityFailures(0)
    setStabilityFinished('')
    setStabilityError('')
    const samples: number[] = []
    let failures = 0
    try {
      for (let i = 0; i < 30; i++) {
        if (!navigator.onLine) {
          failures += 1
        } else {
          const started = performance.now()
          try {
            const response = await fetch(`/api/v1/speed/ping?monitor=${i + 1}&t=${Date.now()}`, {
              method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(5000),
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            samples.push(performance.now() - started)
          } catch { failures += 1 }
        }
        setStabilitySamples([...samples])
        setStabilityFailures(failures)
        if (i < 29) await new Promise(resolve => window.setTimeout(resolve, 1000))
      }
      if (samples.length === 0) throw new Error('No successful samples were received. Check your connection and try again.')
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
      const p95 = percentile(samples, 0.95)
      const jitter = samples.length > 1 ? samples.slice(1).reduce((sum, value, index) => sum + Math.abs(value - samples[index]), 0) / (samples.length - 1) : 0
      const spikes = samples.filter(value => value > average * 1.8 && value > average + 30).length
      setStabilityHistory(previous => [{ average, highest: Math.max(...samples), p95, jitter, spikes, failures, samples: samples.length, date: new Date().toISOString() }, ...previous].slice(0, 30))
      setStabilityFinished(new Date().toLocaleTimeString())
    } catch (error) {
      setStabilityError(error instanceof Error ? error.message : 'Stability monitoring could not complete.')
    } finally {
      setStabilityRunning(false)
    }
  }

  async function submitBenchmarkContribution(test: TestResult) {
    if (!benchmarkConsent) return
    setBenchmarkStatus('Sharing anonymous aggregate…')
    try {
      const response = await fetch('/api/v1/benchmarks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          consent: true,
          protocolVersion: 'v1',
          downloadMbps: test.download,
          uploadMbps: test.upload,
          latencyMs: test.ping,
          jitterMs: test.jitter,
        }),
      })
      const data = await response.json() as { message?: string }
      if (!response.ok) throw new Error(data.message || 'Contribution could not be recorded.')
      setBenchmarkStatus('Thank you. Your anonymous aggregate contribution was recorded.')
    } catch (error) {
      setBenchmarkStatus(error instanceof Error ? error.message : 'Contribution could not be recorded.')
    }
  }

  async function runTest() {
    if (state === 'running') return
    setState('running')
    setProgress(8)
    setLiveSpeed(0)
    setDownloadBytes(0)
    setUploadBytes(0)
    setUploadLiveSpeed(0)
    speedTraceRef.current = []
    setSpeedTrace([])
    setTestPhase('Measuring HTTP latency')
    setServicePhase('idle')
    setServiceResults([])
    setTestError('')
    try {
      const latency = await measurePing()
      const transferErrors: string[] = []
      let download: number | null = null
      let upload: number | null = null

      setProgress(24)
      setTestPhase('Calibrating download and selecting test size')
      try {
        const calibration = await measureDownload(BASELINE_BYTES, (mbps, received) => {
          setLiveSpeed(Number(mbps.toFixed(1)))
          appendSpeedSample(mbps)
          setDownloadBytes(received)
        })
        const payloadBytes = choosePayloadBytes(calibration)
        setTestPhase(`Measuring download throughput (${payloadBytes / 1_000_000} MB)`)
        const runs: number[] = []
        for (let run = 0; run < 3; run++) {
          runs.push(await measureDownload(payloadBytes, (mbps, received) => {
            setLiveSpeed(Number(mbps.toFixed(1)))
            appendSpeedSample(mbps)
            setDownloadBytes(received)
          }))
        }
        download = median(runs)
      } catch (error) {
        transferErrors.push(`Download: ${error instanceof Error ? error.message : 'transfer failed'}`)
      }

      setProgress(52)
      setTestPhase('Calibrating upload and selecting test size')
      try {
        const calibration = await measureUpload(BASELINE_BYTES, (sentBytes, mbps) => {
          setUploadBytes(sentBytes)
          setUploadLiveSpeed(Number(mbps.toFixed(1)))
          appendSpeedSample(mbps)
        })
        const payloadBytes = choosePayloadBytes(calibration)
        setTestPhase(`Measuring upload throughput (${payloadBytes / 1_000_000} MB)`)
        const runs: number[] = []
        for (let run = 0; run < 2; run++) {
          runs.push(await measureUpload(payloadBytes, (sentBytes, mbps) => {
            setUploadBytes(sentBytes)
            setUploadLiveSpeed(Number(mbps.toFixed(1)))
            appendSpeedSample(mbps)
          }))
        }
        upload = median(runs)
      } catch (error) {
        transferErrors.push(`Upload: ${error instanceof Error ? error.message : 'transfer failed'}`)
      }

      if (transferErrors.length > 0) {
        throw new Error(transferErrors.join(' | '))
      }
      if (download === null || upload === null) {
        throw new Error('Download and upload measurements were not both completed.')
      }

      setProgress(72)
      setTestPhase('Checking public app endpoints')
      setServicePhase('running')
      setServiceResults(services.map(service => ({ name: service.name, status: 'Checking' })))
      const checks = await Promise.all(services.map(checkService))
      setServiceResults(checks)
      setServicePhase('complete')
      setProgress(92)
      const next = { ping: Math.round(latency.ping), download: Number(download.toFixed(1)), upload: Number(upload.toFixed(1)), jitter: Number(latency.jitter.toFixed(1)), date: new Date().toISOString(), trace: speedTraceRef.current.slice(-36) }
      setResult(next)
      setHistory(current => [next, ...current].slice(0, 50))
      if (benchmarkConsent) void submitBenchmarkContribution(next)
      setProgress(100)
      setTestPhase('Test complete')
      setState('complete')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'An unexpected network error occurred'
      setTestError(reason)
      setTestPhase('Test could not complete')
      setState('error')
      setServicePhase('idle')
      setProgress(0)
    }
  }



  return (
    <div className="app-shell">
      <main className="main tezz-main" id="tezz-top">
        <header className="tezz-header">
          <a className="tezz-logo" href="#tezz-top" onClick={() => navigateTo('Overview')} aria-label="TEZZ CONNECT home"><span className="tezz-logo-word">TEZZ<span>CONNECT</span></span><i /></a>
          <nav className="tezz-nav">
            <a className={activeTab === 'Overview' ? 'selected' : ''} href="/" onClick={event => { event.preventDefault(); navigateTo('Overview') }}><Home size={15}/> Home</a>
            <a href="/#tezz-speed-test" onClick={event => { event.preventDefault(); navigateTo('Overview'); window.setTimeout(() => document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>Free Speed Test</a>
            <a className={activeTab === 'Internet Doctor' ? 'selected' : ''} href="/internet-doctor" onClick={event => { event.preventDefault(); navigateTo('Internet Doctor') }}>Internet Doctor</a>
            <a className={activeTab === 'Network' ? 'selected' : ''} href="/tools" onClick={event => { event.preventDefault(); navigateTo('Network') }}>Network Tools</a>
            <a className={activeTab === 'Global Network' ? 'selected' : ''} href="/global-network" onClick={event => { event.preventDefault(); navigateTo('Global Network'); if (!edgeInfo && !edgeLoading) void refreshEdgeInfo() }}>Global Network</a>
            <a className={activeTab === 'History' ? 'selected' : ''} href="/history" onClick={event => { event.preventDefault(); navigateTo('History') }}>Test History</a>
            <a className={activeTab === 'Report' ? 'selected' : ''} href="/report" onClick={event => { event.preventDefault(); navigateTo('Report') }}>Performance Report</a>
            <a className={activeTab === 'About' ? 'selected' : ''} href="/about" onClick={event => { event.preventDefault(); navigateTo('About') }}>About TEZZ CONNECT</a>
          </nav>
          <div className="tezz-header-actions"><a className="tezz-header-search" aria-label="Explore network tools" title="Explore network tools" href="/tools" onClick={event => { event.preventDefault(); navigateTo('Network') }}><Search size={18}/></a><button className="tezz-menu" aria-expanded={mobileMenuOpen} aria-controls="tezz-mobile-nav" onClick={() => setMobileMenuOpen(open => !open)}>{mobileMenuOpen ? '✕ Close' : '☰ Menu'}</button></div>
        </header>
        {mobileMenuOpen && <nav className="tezz-mobile-nav" id="tezz-mobile-nav" aria-label="Mobile navigation">
          <a className={activeTab === 'Overview' ? 'selected' : ''} href="/" onClick={event => { event.preventDefault(); navigateTo('Overview') }}>Home</a>
          <a href="/#tezz-speed-test" onClick={event => { event.preventDefault(); navigateTo('Overview'); window.setTimeout(() => document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>Free Internet Speed Test</a>
          <a className={activeTab === 'Internet Doctor' ? 'selected' : ''} href="/internet-doctor" onClick={event => { event.preventDefault(); navigateTo('Internet Doctor') }}>Internet Doctor</a>
          <a className={activeTab === 'Network' ? 'selected' : ''} href="/tools" onClick={event => { event.preventDefault(); navigateTo('Network') }}>Network Tools</a>
          <a className={activeTab === 'Global Network' ? 'selected' : ''} href="/global-network" onClick={event => { event.preventDefault(); navigateTo('Global Network'); if (!edgeInfo && !edgeLoading) void refreshEdgeInfo() }}>Global Network</a>
          <a className={activeTab === 'History' ? 'selected' : ''} href="/history" onClick={event => { event.preventDefault(); navigateTo('History') }}>Test History</a>
          <a className={activeTab === 'Report' ? 'selected' : ''} href="/report" onClick={event => { event.preventDefault(); navigateTo('Report') }}>Performance Report</a>
          <a className={activeTab === 'About' ? 'selected' : ''} href="/about" onClick={event => { event.preventDefault(); navigateTo('About') }}>About TEZZ CONNECT</a>
        </nav>}
        <div className={`content ${activeTab === "Overview" ? "home-content" : ""}`}>
          {activeTab === 'Overview' && <>
          <section className={`tezz-hero ${state === 'running' ? 'is-testing' : ''}`}>
            <div className="tezz-hero-copy">
              <span className="tezz-pill">INTERNET SPEED TEST</span>
              <h1>Free Internet <em>Speed Test</em></h1>
              <p>Check download, upload, ping and network stability in seconds.</p>
              <ul><li><CheckCircle2 size={17}/> Adaptive 1–5 MB transfer tests</li><li><CheckCircle2 size={17}/> HTTP latency, response variation & stability</li><li><CheckCircle2 size={17}/> Gaming & streaming readiness</li><li><CheckCircle2 size={17}/> Free, instant results</li></ul>
            </div>
            <div className="tezz-meter-wrap tezz-digital-wrap" id="tezz-speed-test">
              <div className="tezz-digital-meter" aria-live="polite">
                <div className="tezz-meter-topline"><span className="tezz-digital-label">{state === 'running' && testPhase.toLowerCase().includes('upload') ? 'UPLOAD' : state === 'running' && testPhase.toLowerCase().includes('download') ? 'DOWNLOAD' : 'DOWNLOAD SPEED'}</span><span className={`tezz-meter-status ${state === 'running' ? 'active' : result ? 'complete' : ''}`}><i/>{state === 'running' ? 'TESTING' : result ? 'MEASURED' : 'READY'}</span></div>
                <div className="tezz-digital-reading"><strong>{state === 'running' ? testPhase.toLowerCase().includes('upload') ? uploadLiveSpeed.toFixed(1) : testPhase.toLowerCase().includes('download') ? liveSpeed.toFixed(1) : '—' : result ? result.download.toFixed(1) : '—'}</strong><span>Mbps</span></div>
                <div className="tezz-digital-caption">{state === 'running' ? testPhase : result ? 'Latest download measurement' : 'Your connection speed, measured live'}</div>
                <div className="tezz-throughput-chart" role="img" aria-label="Live throughput trace">
                  <svg viewBox="0 0 320 52" preserveAspectRatio="none" role="img" aria-hidden="true">
                    <path className="tezz-chart-grid" d="M0 12H320 M0 26H320 M0 40H320"/>
                    {speedTrace.length > 1 && <polyline className="tezz-chart-line" points={speedTrace.map((value, index) => {
                      const max = Math.max(1, ...speedTrace)
                      const x = (index / (speedTrace.length - 1)) * 320
                      const y = 46 - (value / max) * 38
                      return `${x.toFixed(1)},${y.toFixed(1)}`
                    }).join(' ')}/>}
                    {speedTrace.length === 1 && <circle className="tezz-chart-point" cx="160" cy="26" r="3"/>}
                  </svg>
                </div>
              </div>
              <button className={`tezz-digital-start ${state==='running'?'testing':''}`} onClick={runTest} disabled={state==='running'}><Zap size={19} fill="currentColor"/>{state==='running'?'TEST IN PROGRESS':'START SPEED TEST'}</button>
              {state==='running'&&<div className="tezz-live-progress"><span>{testPhase}</span><span className="tezz-progress-value">{Math.round(progress)}%</span>{testPhase.includes('upload')?<strong>{(uploadBytes/1_000_000).toFixed(1)} / 1 MB · {uploadLiveSpeed.toFixed(1)} Mbps</strong>:testPhase.includes('download')?<strong>{(downloadBytes/1_000_000).toFixed(1)} / 1 MB</strong>:null}</div>}
              {state==='error'&&<div className="tezz-live-progress error-note" role="alert">{testError || 'The test could not complete. Please try again.'}</div>}
            </div>
            <div className="tezz-health-card"><div className="tezz-health-title"><HeartPulse size={27}/><strong>Internet Connection Health Check</strong></div><span className={`tezz-health-badge ${result?'':'pending'}`}>{result?quality:'Ready to test'}</span><p>{result?'Your internet speed and connection quality have been measured. Review your download, upload, latency and stability results for browsing, streaming, gaming and video calls.':'Run a free internet speed test to check download speed, upload speed, ping and connection quality for everyday browsing, streaming and online gaming.'}</p><div className="tezz-signal-bars"><i/><i/><i/><i/></div></div>
            <div className="tezz-wave" aria-hidden="true"><svg viewBox="0 0 1000 500" preserveAspectRatio="none"><defs><linearGradient id="tezz-signal-blue"><stop stopColor="#58b8ff" stopOpacity=".02"/><stop offset=".5" stopColor="#1686ed" stopOpacity=".8"/><stop offset="1" stopColor="#65d9ee" stopOpacity=".05"/></linearGradient><linearGradient id="tezz-signal-cyan"><stop stopColor="#64d8e8" stopOpacity=".02"/><stop offset=".55" stopColor="#36b8df" stopOpacity=".7"/><stop offset="1" stopColor="#1686ed" stopOpacity=".04"/></linearGradient></defs><path className="signal-wave signal-wave-back" d="M-30 78 C90 18 170 142 300 78 S510 18 640 78 S850 142 1030 72"/><path className="signal-wave signal-wave-mid" d="M-30 145 C100 82 185 210 320 145 S530 82 665 145 S875 210 1030 138"/><path className="signal-wave signal-wave-front" d="M-30 215 C100 150 195 278 330 212 S540 150 680 215 S880 280 1030 208"/><path className="signal-wave signal-wave-back" d="M-30 285 C100 220 195 350 330 284 S540 220 680 285 S880 350 1030 278"/><path className="signal-wave signal-wave-mid" d="M-30 355 C100 292 195 420 330 354 S540 292 680 355 S880 420 1030 348"/><path className="signal-wave signal-wave-front" d="M-30 425 C100 362 195 490 330 424 S540 362 680 425 S880 490 1030 418"/></svg></div>
          </section>
          <section className="benchmark-consent-panel" aria-label="Global benchmark sharing">
            <div>
              <div className="section-kicker">HELP BUILD A BETTER INTERNET PICTURE</div>
              <h2>Contribute to global benchmarks</h2>
              <p>Optional. When enabled, a completed speed test shares only download, upload, browser HTTP latency, response variation, and coarse country/region with TEZZ CONNECT. We store hourly regional aggregates—not individual test records, IP addresses, device IDs, or precise location. Public comparisons appear only after at least 30 contributions in a region. HTTP latency is measured to the TEZZ CONNECT edge, not your ISP's full network.</p>
              <label className="benchmark-consent-toggle">
                <input type="checkbox" checked={benchmarkConsent} onChange={event => {
                  const enabled = event.target.checked
                  setBenchmarkConsent(enabled)
                  setBenchmarkStatus(enabled ? 'Opt-in enabled. Your next completed speed test can contribute.' : 'Opt-out enabled. No future benchmark contributions will be sent.')
                  try { localStorage.setItem('tezz_benchmark_consent_v1', String(enabled)) } catch { /* Consent remains active for this page session. */ }
                }} />
                <span>Yes, I agree to share anonymous aggregate measurements from my completed speed tests.</span>
              </label>
              <div className="benchmark-consent-status" role="status">{benchmarkStatus || (benchmarkConsent ? 'Opt-in is enabled.' : 'Benchmark sharing is off by default.')}</div>
            </div>
          </section>
          <section className="tezz-stat-grid">
            <div className="tezz-stat cyan"><ArrowDown/><span>Download</span><strong>{result?result.download.toFixed(2):'—'} <small>Mbps</small></strong></div>
            <div className="tezz-stat violet"><ArrowUp/><span>Upload</span><strong>{result?result.upload.toFixed(2):'—'} <small>Mbps</small></strong></div>
            <div className="tezz-stat green"><ArrowLeftRight/><span>HTTP latency</span><strong>{result?result.ping:'—'} <small>ms</small></strong></div>
            <div className="tezz-stat red"><Activity/><span>HTTP variation</span><strong>{result?result.jitter.toFixed(1):'—'} <small>ms</small></strong></div>
          </section>
          <section className="tezz-feature-grid">
            <button onClick={()=>navigateTo('Internet Doctor')}><Stethoscope/><strong>Internet Doctor</strong><span>Find and fix internet problems</span><b>›</b></button>
            <button onClick={()=>navigateTo('Network')}><ArrowLeftRight/><strong>Latency Test</strong><span>Check browser response time</span><b>›</b></button>
            <button onClick={()=>navigateTo('Network')}><Wifi/><strong>Wi-Fi Test</strong><span>Test your Wi-Fi performance</span><b>›</b></button>
            <button onClick={()=>navigateTo('History')}><Grid2X2/><strong>More Tools</strong><span>Explore all network tools</span><b>›</b></button>
          </section>
          </>}
          {activeTab === 'About' && <section className="about-page">
            <div className="about-hero">
              <span className="tezz-pill">ABOUT TEZZ CONNECT</span>
              <h1>Understand your <em>connection.</em></h1>
              <p>TEZZ CONNECT is a free, browser-based toolkit that helps you measure internet performance, understand network behaviour and make more informed connectivity decisions.</p>
              <div className="about-hero-meta"><span><CheckCircle2 size={15}/> Free to use</span><span><Activity size={15}/> Independent measurements</span><span><ShieldCheck size={15}/> Privacy-conscious design</span></div>
            </div>
            <div className="about-section-heading"><span className="section-kicker">WHAT WE DO</span><h2>Useful network insight, without the guesswork.</h2><p>Simple tools turn technical measurements into information you can act on.</p></div>
            <div className="about-origin"><span className="about-origin-mark" aria-hidden="true">🇮🇳</span><div><span className="section-kicker">OUR ROOTS, GLOBAL VISION</span><h2>Proudly built in India. Connecting the world.</h2><p>TEZZ CONNECT is an independent digital platform built with an international audience in mind.</p></div></div>
            <div className="about-feature-grid">
              <article style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="about-feature-icon" style={{background:'#DFF5F7',borderColor:'#B9E7EB',color:'#087F91'}}><Zap size={20}/></span><h3 style={{color:'#142B45'}}>Measure performance</h3><p style={{color:'#53677D'}}>Run download and upload throughput tests, plus HTTP response-time and variation estimates, from your browser.</p></article>
              <article style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="about-feature-icon" style={{background:'#DFF5F7',borderColor:'#B9E7EB',color:'#087F91'}}><Stethoscope size={20}/></span><h3 style={{color:'#142B45'}}>Understand issues</h3><p style={{color:'#53677D'}}>Use Internet Doctor recommendations to investigate common causes such as congestion, weak Wi-Fi conditions and competing traffic.</p></article>
              <article style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="about-feature-icon" style={{background:'#DFF5F7',borderColor:'#B9E7EB',color:'#087F91'}}><Globe2 size={20}/></span><h3 style={{color:'#142B45'}}>Explore your network</h3><p style={{color:'#53677D'}}>Review available network-edge information, connection signals and public website endpoint checks.</p></article>
            </div>
            <div className="about-two-column">
              <article className="about-info-card" style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="section-kicker" style={{color:'#087F91'}}>OUR APPROACH</span><h3 style={{color:'#142B45'}}>Clarity over exaggerated claims.</h3><p style={{color:'#53677D'}}>We explain what each test measures and where browser-based checks have limits. Results can vary with your device, Wi-Fi, ISP routing, server distance and network conditions.</p><p style={{color:'#53677D'}}>TEZZ CONNECT is an independent measurement tool. It is not an internet service provider and does not control your connection.</p></article>
              <article className="about-info-card" style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="section-kicker" style={{color:'#087F91'}}>PRIVACY & CONTROL</span><h3 style={{color:'#142B45'}}>Your test history stays on this device.</h3><p style={{color:'#53677D'}}>Saved speed, latency and stability history is stored in your browser. It is not synced between devices. Running a test sends measurement requests to TEZZ CONNECT so the service can return results.</p><p style={{color:'#53677D'}}>We do not need GPS or your street address to run the tools on this page.</p></article>
            </div>
            <div className="about-method-note" style={{background:'#E8F7F2',border:'1px solid #C5E8DB',color:'#365D53'}}><ShieldCheck size={18} style={{color:'#087F91'}}/><p style={{color:'#365D53'}}><strong style={{color:'#153E34'}}>Measurement note:</strong> latency and response variation are based on HTTP request/response timing to the TEZZ network edge, not ICMP ping. Public app checks test website endpoint reachability only; they do not verify sign-in, feeds, messages or in-app functionality.</p></div>
            <div className="about-contact-card" style={{background:'#F0F7FC',border:'1px solid #D4E4EF',borderRadius:'18px',padding:'24px',margin:'24px 0',color:'#142B45'}}>
              <span className="section-kicker" style={{color:'#087F91'}}>CONTACT US</span>
              <h2 style={{color:'#142B45',margin:'8px 0'}}>We’d like to hear from you.</h2>
              <p style={{color:'#53677D',margin:'0 0 14px'}}>Have a question, spotted an issue, or want to share an idea? Send the TEZZ CONNECT team a message.</p>
              <a href="mailto:tezzconnect.contact@gmail.com" style={{color:'#087F91',fontWeight:700,textDecoration:'underline',overflowWrap:'anywhere'}}>tezzconnect.contact@gmail.com</a>
            </div>
            <div className="about-cta"><div><span className="section-kicker">READY TO CHECK YOUR CONNECTION?</span><h2 style={{color:'#F7FBFF'}}>Start with a fresh speed test.</h2></div><button onClick={() => { navigateTo('Overview'); window.setTimeout(() => document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior: 'smooth' }), 0) }}>Go to speed test <span aria-hidden="true">→</span></button></div>
          </section>}
          {activeTab === 'Global Network' && <section className="global-network-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ GLOBAL NETWORK INTELLIGENCE</div><h2>See the network edge serving your test.</h2><p>View the Cloudflare data centre handling this request separately from the source network's approximate country and region.</p></div><span className="doctor-symbol"><Globe2 size={23}/></span></div>
            <div className="global-edge-card">
              <div className="global-edge-top"><div><span className="section-kicker">CURRENT TEZZ EDGE</span><h3>{edgeInfo?.colo || (edgeLoading ? 'Identifying edge…' : 'Edge information not loaded')}</h3></div><span className={edgeLoading ? 'latency-live-dot running' : 'latency-live-dot'} /></div>
              <div className="global-edge-grid">
                <div><span>Cloudflare data centre (colo)</span><strong>{edgeInfo?.colo || '—'}</strong></div>
                <div><span>Source country (IP geolocation)</span><strong>{edgeInfo?.country || '—'}</strong></div>
                <div><span>Source region (IP geolocation)</span><strong>{edgeInfo?.region || '—'}</strong></div>
                <div><span>Source network ASN</span><strong>{edgeInfo?.asn ? `AS${edgeInfo.asn}` : '—'}</strong></div>
                <div className="global-edge-operator"><span>Source network operator (ASN name)</span><strong>{edgeInfo?.organization || '—'}</strong></div>
              </div>
              <div className="global-edge-footer"><span>{edgeInfo ? `Updated at ${edgeInfo.fetchedAt}` : 'Metadata is supplied by the network edge handling this request.'}</span><button className="doctor-run-test" onClick={refreshEdgeInfo} disabled={edgeLoading}>{edgeLoading ? 'Refreshing…' : 'Refresh edge details'} <span aria-hidden="true">↻</span></button></div>
              {edgeError && <p className="latency-error" role="alert">{edgeError}</p>}
            </div>
            <div className="global-route-card">
              <div className="section-kicker">WHAT THIS TELLS YOU</div><h3>Your request reaches TEZZ through this edge.</h3>
              <div className="global-route-flow"><div className="global-route-node"><Globe2 size={20}/><strong>Your browser</strong><span>Current device and network</span></div><div className="global-route-connector"><i/></div><div className="global-route-node edge"><Network size={20}/><strong>Cloudflare data centre</strong><span>{edgeInfo?.colo || 'Colo code'}</span></div><div className="global-route-connector"><i/></div><div className="global-route-node"><Server size={20}/><strong>TEZZ service</strong><span>Speed-test endpoint</span></div></div>
              <p>The Cloudflare data-centre code identifies the point handling this request. Country, region and ASN describe the approximate source network based on IP geolocation; they do not identify the data-centre's physical location. This is not a traceroute and does not reveal your full ISP path, routers or cable route.</p>
            </div>

            <div className="global-benchmarks-card">
              <div className="global-benchmarks-heading">
                <div><div className="section-kicker">COMMUNITY NETWORK BENCHMARKS</div><h3>Regional performance overview</h3><p>Aggregated results from people who explicitly opted in to contribute completed TEZZ CONNECT tests.</p></div>
                <button className="doctor-run-test" onClick={refreshBenchmarkRegions} disabled={benchmarkLoading}>{benchmarkLoading ? 'Refreshing…' : 'Refresh data'} <span aria-hidden="true">↻</span></button>
              </div>
              <div className="global-benchmark-meta"><span>Reporting window: last 7 days</span><span>Publication threshold: 30 contributions per region</span></div>
              {benchmarkError && <p className="latency-error" role="alert">{benchmarkError}</p>}
              {benchmarkLoading && !benchmarkLoaded ? <div className="global-benchmark-empty"><Activity size={19}/><span>Loading verified regional aggregates…</span></div> :
                benchmarkRegions.length ? <div className="global-benchmark-table-wrap"><div className="global-benchmark-list">
                  {benchmarkRegions.map(region => <article className="global-benchmark-region" key={region.country_code + '-' + region.region_code}>
                    <div className="global-benchmark-region-title"><div><strong>{region.region_code === 'unknown' ? region.country_code : region.region_code + ', ' + region.country_code}</strong><span>{region.sample_count.toLocaleString()} participating tests</span></div><span className="global-benchmark-verified">Threshold met</span></div>
                    <div className="global-benchmark-metrics">
                      <div><span>Download</span><strong>{typeof region.download_avg_mbps === 'number' ? region.download_avg_mbps.toFixed(1) : '—'} <small>Mbps</small></strong></div>
                      <div><span>Upload</span><strong>{typeof region.upload_avg_mbps === 'number' ? region.upload_avg_mbps.toFixed(1) : '—'} <small>Mbps</small></strong></div>
                      <div><span>HTTP latency</span><strong>{typeof region.latency_avg_ms === 'number' ? region.latency_avg_ms.toFixed(1) : '—'} <small>ms</small></strong></div>
                      <div><span>HTTP response variation</span><strong>{typeof region.jitter_avg_ms === 'number' ? region.jitter_avg_ms.toFixed(1) : '—'} <small>ms</small></strong></div>
                    </div>
                  </article>)}
                </div></div> : <div className="global-benchmark-empty"><Globe2 size={21}/><div><strong>{benchmarkLoaded ? 'No regions meet the publication threshold yet.' : 'Regional data has not loaded.'}</strong><span>TEZZ only publishes a regional cohort after at least 30 opted-in contributions are available in the seven-day window. No placeholder or estimated figures are shown.</span></div></div>}
              <p className="global-benchmark-disclaimer">These are averages from participating TEZZ CONNECT tests, not a census of all users or an ISP-wide service rating. HTTP latency is measured to the TEZZ edge. Regions with fewer than 30 contributions are withheld.</p>
            </div>
            <div className="global-baseline-card">
              <div className="section-kicker">PERSONAL PERFORMANCE BASELINE</div>
              <h3>Your recent connection trend</h3>
              <p className="global-baseline-intro">A private summary calculated from speed tests saved in this browser. No test history is uploaded or shared.</p>
              {personalPerformanceBaseline ? <>
                <div className="global-baseline-grid">
                  <div><span>Median download · last {personalPerformanceBaseline.count}</span><strong>{personalPerformanceBaseline.medianDownload.toFixed(1)} <small>Mbps</small></strong></div>
                  <div><span>Median upload · last {personalPerformanceBaseline.count}</span><strong>{personalPerformanceBaseline.medianUpload.toFixed(1)} <small>Mbps</small></strong></div>
                  <div><span>Median HTTP response</span><strong>{personalPerformanceBaseline.medianHttp.toFixed(0)} <small>ms</small></strong></div>
                  <div><span>Download trend vs previous tests</span><strong>{personalPerformanceBaseline.downloadChange === null ? 'Building baseline' : `${personalPerformanceBaseline.downloadChange > 0 ? '+' : ''}${personalPerformanceBaseline.downloadChange.toFixed(1)} Mbps`}</strong></div>
                </div>
                <p className="global-baseline-foot">{personalPerformanceBaseline.previousDownload === null ? 'Complete at least 8 speed tests to compare the latest five with the preceding five.' : `Compared with the median of ${personalPerformanceBaseline.previousCount} earlier tests. Different devices, networks and test conditions can affect results.`}</p>
              </> : <div className="empty-history"><Activity size={18}/><span>Run a speed test to establish your first local performance baseline.</span></div>}
            </div>
            <div className="global-network-note"><ShieldCheck size={16}/><span>Privacy and accuracy: TEZZ displays the Cloudflare data-centre code separately from coarse source-network country, region and ASN metadata supplied with the request. It does not request GPS, expose your street address or run a separate IP geolocation lookup.</span></div>
          </section>}
          {activeTab === 'Network' && <section className="network-intel-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ NETWORK INTELLIGENCE</div><h2>Understand your connection.</h2><p>Run independent response-time checks and review the network information your browser makes available.</p></div><span className="doctor-symbol"><Wifi size={23}/></span></div>
            <div className="network-intel-grid">
              <div className="network-primary"><span className={network.online ? 'finding-dot good' : 'finding-dot alert'} /><div><span className="section-kicker">INTERNET REACHABILITY</span><strong>{network.online ? 'Browser reports online' : 'Browser reports offline'}</strong><p>{network.online ? 'Your device reports an active network connection. This does not guarantee that every website is reachable.' : 'Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.'}</p></div></div>
              <div className="network-detail"><span>Effective connection type</span><strong>{network.type}</strong></div>
              <div className="network-detail"><span>Estimated downlink</span><strong>{network.downlink}</strong></div>
              <div className="network-detail"><span>Browser-reported RTT</span><strong>{network.rtt}</strong></div>
              <div className="network-detail"><span>Data saver preference</span><strong>{network.supported ? (network.saveData ? 'Enabled' : 'Not requested') : 'Not available'}</strong></div>
            </div>
            <div className="latency-tool-card">
              <div className="latency-tool-heading"><div><span className="section-kicker">INDEPENDENT NETWORK TEST</span><h3>HTTP Latency &amp; Response Variation Test</h3><p>12 small HTTP requests to the TEZZ network edge. No large download or upload.</p></div><span className={latencyRunning ? 'latency-live-dot running' : 'latency-live-dot'} /></div>
              <div className="latency-primary-result"><span>AVERAGE HTTP RESPONSE TIME</span><strong>{latencySamples.length ? (latencySamples.reduce((a,b)=>a+b,0)/latencySamples.length).toFixed(1) : '—'}<small> ms</small></strong><p>{latencyRunning ? `Measuring sample ${latencySamples.length + latencyFailures} of 12…` : latencyCompletedAt ? `Completed at ${latencyCompletedAt}` : 'Run the test to measure your response time.'}</p></div>
              <div className="latency-metrics-grid">
                <div><span>Minimum</span><strong>{latencySamples.length ? Math.min(...latencySamples).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>Maximum</span><strong>{latencySamples.length ? Math.max(...latencySamples).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>HTTP response variation</span><strong>{latencySamples.length > 1 ? (latencySamples.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-latencySamples[index]),0)/(latencySamples.length-1)).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>Failed requests</span><strong>{latencyCompletedAt || latencyRunning ? `${latencyFailures} / 12` : '—'}</strong></div>
              </div>
              {latencySamples.length > 1 && (() => {
                const jitterValue = latencySamples.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-latencySamples[index]),0)/(latencySamples.length-1)
                const level = jitterValue > 50 ? 'high' : jitterValue > 20 ? 'moderate' : 'low'
                return <div className={`latency-stability-note ${level}`}><div><span className="section-kicker">RESPONSE CONSISTENCY</span><strong>{level === 'high' ? 'Highly variable response times' : level === 'moderate' ? 'Some response-time variation' : 'Consistent response times'}</strong></div><p>{level === 'high' ? 'Large changes between consecutive requests were measured. Try moving closer to your Wi-Fi router, pausing background downloads and repeating the test.' : level === 'moderate' ? 'Response times changed between samples. Repeat the test when the network is quieter to see whether this pattern continues.' : 'HTTP response times were relatively consistent during this short test.'} These are indicative thresholds for this tool, not a formal line-quality certification.</p></div>
              })()}
              <div className="latency-sample-track" aria-label={`${latencySamples.length} successful latency samples`}>{Array.from({length:12},(_,i)=><span key={i} className={i < latencySamples.length ? 'sample-done' : i < latencySamples.length + latencyFailures ? 'sample-failed' : ''} />)}</div>
              {latencyError && <p className="latency-error" role="alert">{latencyError}</p>}
              <button className="doctor-run-test latency-run-button" onClick={runLatencyCheck} disabled={latencyRunning || !network.online}>{latencyRunning ? 'Testing connection…' : latencyCompletedAt ? 'Run again' : 'Start latency test'} <span aria-hidden="true">→</span></button>
            </div>
            <div className="stability-monitor-card">
              <div className="stability-monitor-heading"><div><span className="section-kicker">LIVE CONNECTION MONITOR</span><h3>Connection Stability Monitor</h3><p>30 response-time samples, approximately one second apart. Runs independently of the full speed test.</p></div><span className={stabilityRunning ? 'latency-live-dot running' : 'latency-live-dot'} /></div>
              <div className="stability-monitor-summary">
                <div><span>Successful samples</span><strong>{stabilitySamples.length} / 30</strong></div>
                <div><span>Failed requests</span><strong>{stabilityFailures}</strong></div>
                <div><span>Average response</span><strong>{stabilitySamples.length ? (stabilitySamples.reduce((a,b)=>a+b,0)/stabilitySamples.length).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>Highest response</span><strong>{stabilitySamples.length ? Math.max(...stabilitySamples).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>95th percentile</span><strong>{stabilitySamples.length ? percentile(stabilitySamples, 0.95).toFixed(1)+' ms' : '—'}</strong></div>
              </div>
              <div className="stability-chart-wrap">
                {stabilitySamples.length > 1 ? <svg className="stability-chart" viewBox="0 0 600 170" role="img" aria-label="HTTP response time across monitoring samples">
                  {[35,80,125].map(y=><line key={y} x1="0" y1={y} x2="600" y2={y} className="stability-grid-line"/>)}
                  <polyline points={stabilitySamples.map((v,i)=>{const max=Math.max(...stabilitySamples,100);const min=Math.min(...stabilitySamples,0);const range=Math.max(max-min,20);return `${i/(Math.max(stabilitySamples.length-1,1))*600},${150-((v-min)/range)*125}`}).join(' ')} className="stability-chart-line"/>
                  {stabilitySamples.map((v,i)=>{const max=Math.max(...stabilitySamples,100);const min=Math.min(...stabilitySamples,0);const range=Math.max(max-min,20);return <circle key={i} cx={i/(Math.max(stabilitySamples.length-1,1))*600} cy={150-((v-min)/range)*125} r="3" className="stability-chart-point"/>})}
                </svg> : <div className="stability-chart-empty"><Activity size={20}/><span>{stabilityRunning ? 'Collecting response-time samples…' : 'Start monitoring to build your live stability graph.'}</span></div>}
              </div>
              <div className="stability-progress"><span style={{width:`${((stabilitySamples.length+stabilityFailures)/30)*100}%`}} /></div>
              <div className="stability-status-line">{stabilityRunning ? `Monitoring in progress · sample ${stabilitySamples.length+stabilityFailures} of 30` : stabilityFinished ? `Monitoring completed at ${stabilityFinished}` : 'Monitoring duration: approximately 30 seconds'}</div>
              {stabilitySamples.length > 1 && (() => {const avg=stabilitySamples.reduce((a,b)=>a+b,0)/stabilitySamples.length;const jitter=stabilitySamples.slice(1).reduce((sum,v,i)=>sum+Math.abs(v-stabilitySamples[i]),0)/(stabilitySamples.length-1);const spikes=stabilitySamples.filter(v=>v>avg*1.8 && v>avg+30).length;const level=stabilityFailures>0||spikes>=3||jitter>50?'variable':jitter>20||spikes>0?'mixed':'steady';return <div className={`stability-insight ${level}`}><strong>{level==='variable'?'Unstable response pattern':level==='mixed'?'Some response variation detected':'Steady response pattern'}</strong><p>{spikes} response spike(s) detected · {jitter.toFixed(1)} ms average successive variation. {level==='variable'?'Check competing traffic and Wi-Fi conditions, then repeat the monitor.':level==='mixed'?'Repeat at another time to see whether the variation persists.':'Responses were relatively consistent during this short monitoring window.'}</p></div>})()}
              {latestStability && <div className="connection-health-score">
                <div className="connection-health-score-top"><div><span className="section-kicker">TEZZ CONNECTION HEALTH INDEX</span><strong>{connectionHealthScore ? connectionHealthScore.total : '—'}<small>/100</small></strong><span className="connection-health-label">{connectionHealthScore ? connectionHealthScore.label : 'Insufficient measurement data'}</span></div><div className="connection-health-score-meta">{latestStability.samples} successful · {latestStability.failures} failed<br/>{new Date(latestStability.date).toLocaleString()}</div></div>
                {connectionHealthScore ? <div className="connection-health-breakdown">
                  <div><span>Latency · P95</span><strong>{connectionHealthScore.latency}/30</strong></div>
                  <div><span>Consistency · variation</span><strong>{connectionHealthScore.consistency}/25</strong></div>
                  <div><span>Probe reliability</span><strong>{connectionHealthScore.reliability}/25</strong></div>
                  <div><span>Response spike control</span><strong>{connectionHealthScore.spikes}/20</strong></div>
                </div> : <p className="connection-health-note">Run the monitor again and collect at least 15 successful responses out of 20 or more attempted probes. A valid P95 value is also required.</p>}
                <p className="connection-health-note">A transparent TEZZ diagnostic index for HTTP responses to our edge—not an ISP-wide rating, standardized certification, ICMP ping or packet-loss measurement.</p>
              </div>}
              {stabilityError && <p className="latency-error" role="alert">{stabilityError}</p>}
              <button className="doctor-run-test latency-run-button" onClick={runStabilityMonitor} disabled={stabilityRunning || !network.online}>{stabilityRunning ? 'Monitoring…' : stabilityFinished ? 'Run monitor again' : 'Start 30-second monitor'} <span aria-hidden="true">→</span></button>
            </div>
            <div className="network-capabilities"><div><strong>Wi-Fi signal strength</strong><span>Not exposed by standard browser APIs</span></div><div><strong>Router / gateway details</strong><span>Not exposed to this webpage</span></div><div><strong>Live connection updates</strong><span>{network.supported ? 'Browser API available' : 'Limited browser support'}</span></div></div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Latency and response variation are measured as HTTP request/response times to the TEZZ edge, not ICMP ping. Failed requests are not labelled packet loss. Results can vary with device load, Wi-Fi, server distance and ISP routing.</div>
          </section>}
          {activeTab === 'Internet Doctor' && <section className="doctor-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ INTERNET DOCTOR</div><h2>Find out what is slowing you down.</h2><p>Use your latest speed test and browser network signals to identify likely connection issues.</p></div><span className="doctor-symbol"><Activity size={23}/></span></div>
            <div className="doctor-grid">
              <div className="doctor-status"><span className="section-kicker">DIAGNOSTIC STATUS</span><strong className={result && quality === 'Needs attention' ? 'status-alert' : result && quality === 'Fair' ? 'status-caution' : 'status-positive'}>{result ? quality : 'Awaiting test'}</strong><p>{result ? `Measured download ${result.download} Mbps · HTTP round-trip ${result.ping} ms · HTTP response variation ${result.jitter} ms.` : 'Run the speed test first. The Doctor will use those measurements to tailor its recommendations.'}</p></div>
              <div className="doctor-findings">
                {doctorFindings.map((finding) => <div className="doctor-finding" key={finding.title}><span className={`finding-dot ${finding.status}`} /><div><strong>{finding.title}</strong><p>{finding.detail}</p><small className="doctor-evidence">{finding.evidence}</small></div></div>)}
                {!result && network.online && <button className="doctor-run-test" onClick={() => { void runTest() }} disabled={state === 'running'}>{state === 'running' ? 'Test running…' : 'Run speed test'} <span aria-hidden="true">→</span></button>}
              </div>
            </div>
            <div className="doctor-next-steps">
              <div className="doctor-next-heading"><div><span className="section-kicker">PERSONALISED TROUBLESHOOTING</span><h3>Recommended next steps</h3></div><button className="doctor-run-test" onClick={() => { void runTest() }} disabled={state === 'running'}>{state === 'running' ? 'Test running…' : 'Run new test'} <span aria-hidden="true">→</span></button></div>
              <div className="doctor-next-grid">{doctorRecommendations.map(item => <div className="doctor-next-item" key={item.title}><span className={`doctor-priority ${item.priority}`}>{item.priority === 'high' ? 'Priority' : item.priority === 'medium' ? 'Suggested' : 'Next step'}</span><strong>{item.title}</strong><p>{item.detail}</p></div>)}</div>
            </div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Latency and response variation here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.</div>
          </section>}
          {activeTab === 'History' && <section className="history-page-panel">
            <div className="doctor-heading"><div><div className="section-kicker">YOUR LOCAL TEST RECORDS</div><h2>Internet speed test history.</h2><p>Review your recent download, upload, HTTP latency and response variation measurements saved in this browser.</p></div><span className="doctor-symbol"><History size={23}/></span></div>
            <div className="history-page-summary"><div><span>Saved tests</span><strong>{history.length}</strong></div><div><span>Storage</span><strong>This browser only</strong></div><div><span>Retention</span><strong>Up to 50 tests</strong></div></div>
            {history.length === 0 ? <div className="empty-history"><History size={18}/><span>No saved tests yet. Run a speed test to build your history.</span></div> : <div className="history-table">
              <div className="history-table-head"><span>Date & time</span><span>Download</span><span>Upload</span><span>HTTP latency</span><span>HTTP response variation</span></div>
              {history.map(item => <div className="history-table-row" key={item.date}><span>{new Date(item.date).toLocaleString()}</span><strong>{item.download.toFixed(1)} Mbps</strong><strong>{item.upload.toFixed(1)} Mbps</strong><span>{item.ping} ms</span><span>{item.jitter.toFixed(1)} ms</span></div>)}
            </div>}
            <div className="latency-history-section">
              <div className="latency-history-heading"><div><span className="section-kicker">NETWORK RESPONSE RECORDS</span><h3>Latency test history</h3><p>Compare independent response-time tests saved on this device.</p></div><span className="latency-history-count">{latencyHistory.length} / 30</span></div>
              {latencyHistory.length === 0 ? <div className="empty-history"><Activity size={18}/><span>No latency tests saved yet. Run a test from Tools to start tracking response consistency.</span></div> : <>
                {latencyHistory.length > 1 && <div className="latency-history-comparison"><div><span>Latest average</span><strong>{latencyHistory[0].average.toFixed(1)} ms</strong></div><div><span>Previous average</span><strong>{latencyHistory[1].average.toFixed(1)} ms</strong></div><div><span>Change</span><strong>{Math.abs(latencyHistory[0].average-latencyHistory[1].average).toFixed(1)} ms {latencyHistory[0].average < latencyHistory[1].average ? 'faster' : latencyHistory[0].average > latencyHistory[1].average ? 'slower' : 'unchanged'}</strong></div></div>}
                <div className="latency-history-list">{latencyHistory.map((item,index)=><div className="latency-history-row" key={item.date}><span className="latency-history-index">#{index+1}</span><span className="latency-history-date">{new Date(item.date).toLocaleString()}</span><strong>{item.average.toFixed(1)} ms</strong><span>Variation {item.jitter.toFixed(1)} ms</span><span>{item.failures}/12 failed</span></div>)}</div>
              </>}
            </div>
            <div className="latency-history-section stability-history-section">
              <div className="latency-history-heading"><div><span className="section-kicker">CONNECTION CONSISTENCY RECORDS</span><h3>Stability monitor history</h3><p>Review completed 30-sample monitoring sessions saved on this device.</p></div><span className="latency-history-count">{stabilityHistory.length} / 30</span></div>
              {stabilityHistory.length === 0 ? <div className="empty-history"><Activity size={18}/><span>No stability sessions saved yet. Run the Connection Stability Monitor in Tools to start tracking.</span></div> : <>
                {stabilityHistory.length > 1 && <div className="latency-history-comparison"><div><span>Latest average</span><strong>{stabilityHistory[0].average.toFixed(1)} ms</strong></div><div><span>Previous average</span><strong>{stabilityHistory[1].average.toFixed(1)} ms</strong></div><div><span>Change</span><strong>{Math.abs(stabilityHistory[0].average-stabilityHistory[1].average).toFixed(1)} ms {stabilityHistory[0].average < stabilityHistory[1].average ? 'faster' : stabilityHistory[0].average > stabilityHistory[1].average ? 'slower' : 'unchanged'}</strong></div></div>}
                <div className="latency-history-list stability-history-list">{stabilityHistory.map((item,index)=><div className="latency-history-row" key={item.date}><span className="latency-history-index">#{index+1}</span><span className="latency-history-date">{new Date(item.date).toLocaleString()}</span><strong>{item.average.toFixed(1)} ms</strong><span>{item.spikes} spikes · {item.jitter.toFixed(1)} ms variation</span><span>{item.failures} failed</span></div>)}</div>
              </>}
            </div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Speed, latency and stability histories are stored locally in this browser and are not synced across devices. Clearing browser site data may remove these records.</div>
          </section>}
          {activeTab === 'Report' && <section className="performance-report-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ CONNECT PERFORMANCE SUMMARY</div><h2>Your internet performance report.</h2><p>A combined view of your latest speed, latency and connection stability measurements saved in this browser.</p></div><span className="doctor-symbol"><ClipboardCopy size={23}/></span></div>
            <div className="performance-report-meta"><span>Generated {new Date().toLocaleString()}</span><span>Local browser data · Private</span></div>
            <div className="performance-report-visual">
              <div className="performance-report-visual-head"><span className="section-kicker">AT A GLANCE</span><strong>{result && latencyHistory[0] && stabilityHistory[0] ? '3 measurement categories available' : 'Your measurement coverage'}</strong></div>
              <div className="performance-report-coverage">
                <div className={result ? 'covered' : ''}><span>Speed</span><i/></div>
                <div className={latencyHistory[0] ? 'covered' : ''}><span>Latency</span><i/></div>
                <div className={stabilityHistory[0] ? 'covered' : ''}><span>Stability</span><i/></div>
              </div>
              <p>{result && latencyHistory[0] && stabilityHistory[0] ? 'Your latest speed, latency and stability measurements are available for review.' : 'Run the missing tests to build a more complete performance picture. The report includes only measurements saved in this browser.'}</p>
            </div>

            <div className="performance-report-grid">
              <div className="performance-report-card"><span className="section-kicker">SPEED TEST</span><strong>{result ? result.download.toFixed(1)+' Mbps' : 'Not tested'}</strong><p>{result ? `Download · Upload ${result.upload.toFixed(1)} Mbps` : 'Run a speed test to add measurements.'}</p><small>{result ? `HTTP latency ${result.ping} ms · Variation ${result.jitter.toFixed(1)} ms` : 'No saved speed result'}</small></div>
              <div className="performance-report-card"><span className="section-kicker">LATENCY TEST</span><strong>{latencyHistory[0] ? latencyHistory[0].average.toFixed(1)+' ms' : 'Not tested'}</strong><p>Average HTTP response time</p><small>{latencyHistory[0] ? `Variation ${latencyHistory[0].jitter.toFixed(1)} ms · ${latencyHistory[0].failures}/12 failed` : 'No saved latency result'}</small></div>
              <div className="performance-report-card"><span className="section-kicker">STABILITY MONITOR</span><strong>{stabilityHistory[0] ? stabilityHistory[0].average.toFixed(1)+' ms' : 'Not monitored'}</strong><p>Average response across 30 samples</p><small>{stabilityHistory[0] ? `${stabilityHistory[0].spikes} spikes · ${stabilityHistory[0].failures} failed` : 'No completed monitor saved'}</small></div>
            </div>
            <div className="performance-report-section"><h3>Recent performance trend</h3><p>Latest saved measurements on this device. Compare sessions over time; different test types are shown separately.</p>
              <div className="performance-report-trend">{stabilityHistory.slice(0,5).map(item=><div key={item.date}><span>{new Date(item.date).toLocaleString()}</span><strong>{item.average.toFixed(1)} ms</strong><small>Stability average · {item.spikes} spikes</small></div>)}</div>
              {stabilityHistory.length===0 && <div className="empty-history"><Activity size={18}/><span>Complete a stability monitor to start your trend history.</span></div>}
            </div>
            <div className="performance-report-actions"><button className="doctor-run-test" onClick={copyPerformanceReport}><ClipboardCopy size={15}/> Copy full report</button><button className="doctor-run-test report-pdf-button" onClick={() => window.print()}><ClipboardCopy size={15}/> Download PDF</button><span role="status">{reportMessage}</span></div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> This report combines the latest available measurements. It does not diagnose an ISP fault. HTTP latency is not ICMP ping, and HTTP request failures are not packet loss. Report data is stored locally and is not synced across devices.</div>
          </section>}
          {activeTab === 'Overview' && <>
          <section className="services-panel tezz-social-panel">
            <div className="services-heading"><div><div className="section-kicker">SOCIAL MEDIA & APP CONNECTIVITY</div><h2>Check your social media status.</h2><p>Quick public-endpoint checks for the apps and platforms you use every day.</p></div><div className="social-heading-actions"><span className="services-live">{servicePhase === 'running' ? 'SCANNING' : servicePhase === 'complete' ? 'SCAN COMPLETE' : 'READY'}</span><button className="social-check-button" onClick={runServiceChecks} disabled={servicePhase === 'running'}>{servicePhase === 'running' ? 'Checking…' : 'Check now'} <span aria-hidden="true">→</span></button></div></div>
            <div className="services-grid">{services.map(service => { const item = serviceResults.find(result => result.name === service.name); return <div className="service-tile" key={service.name}><div className="service-logo"><img src={service.icon} alt="" loading="lazy" /></div><div className="service-name">{service.name}</div><div className={`service-status ${item?.status === 'Responding' ? 'reachable' : item?.status === 'Could not verify' ? 'inconclusive' : ''}`}>{item ? item.status === 'Responding' ? `Replied in ${((item.ms ?? 0) / 1000).toFixed(1)} sec` : item.status === 'Checking' ? 'Checking…' : 'Could not verify' : 'Not checked'}</div></div> })}</div>
            <div className="service-note">Checks test whether each platform's public website responds from this browser. They do not verify login, feeds, messages or playback. A timeout may be caused by browser restrictions, privacy tools, network filters or the platform itself, so it is shown as “Could not verify” rather than confirmed outage.</div>
          </section>

          <section className="usage-insights-panel">
            <div className="section-kicker">MAKE THE MOST OF YOUR CONNECTION</div>
            <h2>What can your internet handle?</h2>
            <p className="usage-insights-intro">A practical guide based on your latest speed test. Actual performance can vary by device, Wi-Fi signal and the number of people online.</p>
            <div className="usage-insights-grid">
              <article className="usage-insight-card">
                <div className="usage-insight-icon streaming"><MonitorPlay size={22}/></div>
                <div><h3>Streaming</h3><p>{result ? result.download >= 25 ? 'Your measured download speed is suitable for 4K streaming on one device, subject to service and network conditions.' : result.download >= 5 ? 'Your measured download speed is generally suitable for HD streaming on one device.' : 'Your measured download speed may struggle with HD streaming. Try lowering video quality or reducing other downloads.' : 'Run a speed test to check whether your connection can support HD or 4K streaming.'}</p></div>
              </article>
              <article className="usage-insight-card">
                <div className="usage-insight-icon calls"><Video size={22}/></div>
                <div><h3>Video calls</h3><p>{result ? result.upload >= 3 && result.download >= 5 ? 'Your measured upload and download speeds look suitable for many HD video calls. Stable Wi-Fi is also important.' : 'Your measured speeds may affect video-call quality, especially when several people or devices share the connection.' : 'Run a speed test to review upload and download capacity for video meetings.'}</p></div>
              </article>
              <article className="usage-insight-card">
                <div className="usage-insight-icon gaming"><Gamepad2 size={22}/></div>
                <div><h3>Online gaming</h3><p>{result ? result.ping <= 50 && result.jitter <= 20 ? 'Your measured HTTP response time and variation look favourable for many online games. Actual gameplay also depends on the game server route.' : 'Your measured HTTP response time or variation may affect responsiveness. Try a wired connection or stronger Wi-Fi and retest.' : 'Run a speed test to review HTTP response time and variation, which can matter alongside download speed for gaming.'}</p></div>
              </article>
            </div>
          </section>

          {state === 'complete' && result && <section className="report-panel">
            <div className="report-heading"><div><div className="section-kicker">YOUR CONNECTION REPORT</div><h2>Internet health summary</h2><p>Completed {new Date(result.date).toLocaleString()}</p></div><button className="report-copy" onClick={copyReport}><ClipboardCopy size={15}/> Copy report</button></div>
            <div className="report-summary"><div><span>Overall assessment</span><strong>{quality}</strong></div><div><span>Public endpoints responding</span><strong>{serviceResults.filter(item => item.status === 'Responding').length} / {services.length}</strong></div><div><span>Test data transferred</span><strong>Adaptive · up to 5 MB each</strong></div></div>
            <p className="report-note">This report combines adaptive download and upload throughput measurements (1–5 MB per transfer), median browser HTTP response-time samples, mean absolute difference between consecutive HTTP response-time samples and public website endpoint checks. Results describe this test session and may vary by device, Wi-Fi, ISP routing and server location. App checks do not verify sign-in or in-app features.</p>
            {reportMessage && <span className="report-feedback" role="status">{reportMessage}</span>}
          </section>}

          <div className="lower-grid">
            <section className="info-card">
              <div className="card-title"><div><div className="section-kicker">NETWORK SNAPSHOT</div><h3>Your connection</h3></div><span className="card-icon"><Signal size={18} /></span></div>
              <div className="network-row"><span>Connection type</span><strong>{network.type}</strong></div>
              <div className="network-row"><span>Estimated downlink</span><strong>{network.downlink}</strong></div>
              <div className="network-row"><span>Browser HTTP RTT</span><strong>{network.rtt}</strong></div>
              <div className="network-note"><Monitor size={15} /> Some network details depend on browser support.</div>
            </section>
            <section className="info-card">
              <div className="card-title"><div><div className="section-kicker">CONNECTION HEALTH</div><h3>Performance summary</h3></div><span className="card-icon health"><CheckCircle2 size={18} /></span></div>
              <div className="health-score"><strong>{result ? quality : '—'}</strong><span>{result ? 'Based on this test' : 'Run a speed test to see your score'}</span></div>
              <div className="health-bar"><span style={{ width: result ? `${Math.min(100, result.download)}%` : '0%' }} /></div>
              <div className="health-caption"><span>Connection performance</span><span>{result ? 'Measured' : 'Awaiting test'}</span></div>
            </section>
          </div>

          <section className="history-strip">
            <div className="history-heading"><div><div className="section-kicker">RECENT ACTIVITY</div><h3>Test history</h3></div><button onClick={() => navigateTo('History')}>View history <span>→</span></button></div>
            {history.length === 0 ? <div className="empty-history"><History size={18} /><span>Your recent tests will appear here after your first run.</span></div> : history.slice(0, 3).map((item, i) => <div className="history-item" key={item.date}><span className="history-index">0{i + 1}</span><span>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><strong>{item.download} Mbps</strong><span>{item.ping} ms latency</span><span className="history-good">{item.download >= 25 ? 'Good' : 'Fair'}</span></div>)}
          </section>
          </>}
          <section className="home-knowledge-hub" aria-labelledby="knowledge-hub-title">
            <div className="knowledge-hub-heading">
              <div>
                <div className="section-kicker">LEARN • EXPLORE • CONNECT</div>
                <h2 id="knowledge-hub-title">Internet Knowledge Hub</h2>
                <p>New to the internet? Explore simple, practical guides to understand your connection and make better choices.</p>
              </div>
              <a className="knowledge-hub-all" href="/guides/">Explore all guides <span aria-hidden="true">→</span></a>
            </div>
            <div className="knowledge-hub-grid">
              <a className="knowledge-hub-card" href="/guides/what-is-the-internet/">
                <span className="knowledge-hub-icon" aria-hidden="true">◎</span>
                <span className="knowledge-hub-card-copy"><strong>Internet Basics</strong><small>Learn what the internet is and how websites reach your device.</small></span>
                <span className="knowledge-hub-arrow" aria-hidden="true">↗</span>
              </a>
              <a className="knowledge-hub-card" href="/guides/improve-wifi-speed/">
                <span className="knowledge-hub-icon wifi" aria-hidden="true">⌁</span>
                <span className="knowledge-hub-card-copy"><strong>Wi-Fi &amp; Routers</strong><small>Learn about router placement, Wi-Fi coverage and interference.</small></span>
                <span className="knowledge-hub-arrow" aria-hidden="true">↗</span>
              </a>
              <a className="knowledge-hub-card" href="/guides/latency-and-jitter/">
                <span className="knowledge-hub-icon signal" aria-hidden="true">⌁</span>
                <span className="knowledge-hub-card-copy"><strong>Signals &amp; Performance</strong><small>Discover latency, jitter and what affects network response.</small></span>
                <span className="knowledge-hub-arrow" aria-hidden="true">↗</span>
              </a>
              <a className="knowledge-hub-card" href="/guides/internet-speed-for-gaming/">
                <span className="knowledge-hub-icon gaming" aria-hidden="true">◈</span>
                <span className="knowledge-hub-card-copy"><strong>Everyday Internet Tips</strong><small>Get practical advice for gaming and a smoother connection.</small></span>
                <span className="knowledge-hub-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
          </section>
          <footer><span>© 2026 TEZZ CONNECT <span className="footer-dot">•</span> Proudly built in India 🇮🇳</span><span><a href="/guides/">GUIDES</a> <span className="footer-dot">•</span> BUILT FOR A BETTER CONNECTION <span className="footer-dot">•</span> PRIVACY FIRST</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
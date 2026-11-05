import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDown, ArrowUp, CheckCircle2, ClipboardCopy, MonitorPlay, Video, Gamepad2, Globe2, Network, Server,
  History, Monitor, HeartPulse, Stethoscope, ArrowLeftRight, Grid2X2, Search,
  ShieldCheck, Signal, Wifi, Zap, Home
} from 'lucide-react'

type TestState = 'idle' | 'running' | 'complete' | 'error'
type TestResult = { download: number; upload: number; ping: number; jitter: number; date: string }
type LatencyRecord = { average: number; min: number; max: number; jitter: number; failures: number; date: string }
type StabilityRecord = { average: number; highest: number; jitter: number; spikes: number; failures: number; samples: number; date: string }
type ServiceResult = { name: string; status: 'Checking' | 'Responding' | 'Could not verify'; ms?: number }
const services = [{ name: 'Facebook', url: 'https://www.facebook.com/', icon: 'https://cdn.simpleicons.org/facebook/1877F2' }, { name: 'Instagram', url: 'https://www.instagram.com/', icon: 'https://cdn.simpleicons.org/instagram/E4405F' }, { name: 'YouTube', url: 'https://www.youtube.com/', icon: 'https://cdn.simpleicons.org/youtube/FF0033' }, { name: 'WhatsApp', url: 'https://www.whatsapp.com/', icon: 'https://cdn.simpleicons.org/whatsapp/25D366' }, { name: 'Netflix', url: 'https://www.netflix.com/', icon: 'https://cdn.simpleicons.org/netflix/E50914' }, { name: 'Google', url: 'https://www.google.com/', icon: 'https://cdn.simpleicons.org/google/4285F4' }, { name: 'X', url: 'https://x.com/', icon: 'https://cdn.simpleicons.org/x/000000' }, { name: 'TikTok', url: 'https://www.tiktok.com/', icon: 'https://cdn.simpleicons.org/tiktok/000000' }]

const DOWNLOAD_BYTES = 25_000_000
const UPLOAD_BYTES = 25_000_000
const downloadUrl = `/api/speed/download?bytes=${DOWNLOAD_BYTES}`
const uploadUrl = '/api/speed/upload'

async function measurePing(): Promise<{ ping: number; jitter: number }> {
  const samples: number[] = []
  for (let i = 0; i < 4; i++) {
    const start = performance.now()
    const response = await fetch('/api/speed/ping', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('Latency test endpoint unavailable')
    samples.push(performance.now() - start)
  }
  const ping = samples.reduce((a, b) => a + b, 0) / samples.length
  const jitter = samples.slice(1).reduce((total, value, index) => total + Math.abs(value - samples[index]), 0) / Math.max(1, samples.length - 1)
  return { ping, jitter }
}

async function measureDownload(onSample: (mbps: number, receivedBytes: number) => void): Promise<number> {
  const start = performance.now()
  const response = await fetch(downloadUrl, { cache: 'no-store', signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error('Download test endpoint unavailable')
  if (!response.body) {
    const data = await response.arrayBuffer()
    if (data.byteLength !== DOWNLOAD_BYTES) throw new Error(`Download test incomplete: received ${data.byteLength} of ${DOWNLOAD_BYTES} bytes`)
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
  if (receivedBytes !== DOWNLOAD_BYTES) throw new Error(`Download test incomplete: received ${receivedBytes} of ${DOWNLOAD_BYTES} bytes`)
  const seconds = (performance.now() - start) / 1000
  return (receivedBytes * 8) / Math.max(seconds, 0.001) / 1_000_000
}

async function measureUpload(onProgress: (sentBytes: number, mbps: number) => void): Promise<number> {
  const payload = new Uint8Array(UPLOAD_BYTES)
  for (let offset = 0; offset < payload.length; offset += 65_536) {
    crypto.getRandomValues(payload.subarray(offset, Math.min(offset + 65_536, payload.length)))
  }
  const started = performance.now()
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', uploadUrl)
    request.timeout = 60000
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.upload.onprogress = event => {
      const sentBytes = Math.min(event.loaded, UPLOAD_BYTES)
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
      resolve((UPLOAD_BYTES * 8) / seconds / 1_000_000)
    }
    request.onerror = () => reject(new Error('Upload test network error'))
    request.ontimeout = () => reject(new Error('Upload test timed out after 60 seconds'))
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
    ).slice(0, 50)
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
  const [testPhase, setTestPhase] = useState('Ready to test')
  const [serviceResults, setServiceResults] = useState<ServiceResult[]>([])
  const [servicePhase, setServicePhase] = useState<'idle' | 'running' | 'complete'>('idle')
  const [reportMessage, setReportMessage] = useState('')
  const [testError, setTestError] = useState('')
  const [history, setHistory] = useState<TestResult[]>(loadHistory)
  const [result, setResult] = useState<TestResult | null>(() => loadHistory()[0] ?? null)
  const [activeTab, setActiveTab] = useState(() => window.location.pathname === '/about' ? 'About' : 'Overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function navigateTo(tab: string) {
    setMobileMenuOpen(false)
    const nextPath = tab === 'About' ? '/about' : '/'
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setActiveTab(tab)
  }

  useEffect(() => {
    const handlePopState = () => setActiveTab(window.location.pathname === '/about' ? 'About' : 'Overview')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.title = activeTab === 'About' ? 'About TEZZ CONNECT | Internet Performance Tools' : 'TEZZ CONNECT | Free Internet Speed Test'
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
    if (result.download >= 100 && result.ping < 40) return 'Excellent'
    if (result.download >= 25 && result.ping < 80) return 'Good'
    if (result.download >= 5) return 'Fair'
    return 'Needs attention'
  }, [result])

  const doctorRecommendations = useMemo(() => {
    if (!network.online) return [
      { title: 'Restore your connection', detail: 'Your browser reports that the device is offline. Reconnect to Wi-Fi or mobile data, then run a fresh test.', priority: 'high' },
    ]
    if (!result) return [
      { title: 'Run a baseline speed test', detail: 'Measure download, upload, HTTP response time and jitter before troubleshooting.', priority: 'info' },
      { title: 'Check more than once', detail: 'Repeat the test at different times to see whether the slowdown is consistent.', priority: 'info' },
    ]
    const items: { title: string; detail: string; priority: 'high' | 'medium' | 'info' }[] = []
    if (result.download < 10) items.push({ title: 'Reduce competing traffic', detail: 'Pause large downloads and video streams on other devices. Move closer to the router and retest.', priority: 'high' })
    if (result.upload < 2) items.push({ title: 'Check upload activity', detail: 'Pause cloud backups, file syncing and outgoing video streams. Retest when the network is quieter.', priority: 'medium' })
    if (result.ping > 100) items.push({ title: 'Investigate response delays', detail: 'Try a wired connection if available, pause background traffic and compare another test location or time.', priority: 'high' })
    if (result.jitter > 30) items.push({ title: 'Improve connection consistency', detail: 'Use a stable Wi-Fi band, reduce distance and obstacles from the router, and avoid congested network periods.', priority: 'medium' })
    if (items.length === 0) items.push({ title: 'Your measurements look stable', detail: 'No severe issue was flagged by these checks. Retest during a video call or gaming session if you still notice problems.', priority: 'info' })
    items.push({ title: 'Compare another test', detail: 'Run a second test after these changes. A repeated pattern is more useful than a single measurement.', priority: 'info' })
    return items
  }, [network.online, result])

  async function checkService(service: typeof services[number]): Promise<ServiceResult> {
    const started = performance.now()
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch(`/api/services/check?site=${encodeURIComponent(service.name.toLowerCase())}`, {
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
      latestSpeed ? `Date: ${new Date(latestSpeed.date).toLocaleString()}\nDownload: ${latestSpeed.download.toFixed(1)} Mbps\nUpload: ${latestSpeed.upload.toFixed(1)} Mbps\nHTTP latency: ${latestSpeed.ping} ms\nHTTP jitter estimate: ${latestSpeed.jitter.toFixed(1)} ms` : 'No speed test saved in this browser.',
      '',
      'LATENCY TEST',
      latestLatency ? `Date: ${new Date(latestLatency.date).toLocaleString()}\nAverage HTTP response: ${latestLatency.average.toFixed(1)} ms\nMinimum: ${latestLatency.min.toFixed(1)} ms\nMaximum: ${latestLatency.max.toFixed(1)} ms\nJitter estimate: ${latestLatency.jitter.toFixed(1)} ms\nFailed requests: ${latestLatency.failures}/12` : 'No latency test saved in this browser.',
      '',
      'CONNECTION STABILITY',
      latestStability ? `Date: ${new Date(latestStability.date).toLocaleString()}\nSuccessful samples: ${latestStability.samples}/30\nAverage HTTP response: ${latestStability.average.toFixed(1)} ms\nHighest response: ${latestStability.highest.toFixed(1)} ms\nAverage successive variation: ${latestStability.jitter.toFixed(1)} ms\nResponse spikes: ${latestStability.spikes}\nFailed requests: ${latestStability.failures}` : 'No completed stability monitor saved in this browser.',
      '',
      'NETWORK CONTEXT',
      `Browser online: ${network.online ? 'Yes' : 'No'}\nEffective connection type: ${network.type}\nEstimated downlink: ${network.downlink}\nBrowser-reported RTT: ${network.rtt}\nPublic website endpoints responding: ${reachable}/${services.length}`,
      '',
      'MEASUREMENT NOTES',
      'Latency and jitter are HTTP request/response measurements to the TEZZ CONNECT edge, not ICMP ping. Failed HTTP requests are not packet loss. Public website checks measure endpoint reachability only, not login or in-app functionality. Browser-reported network details may be estimates or unavailable. Results vary with device, Wi-Fi, server distance and ISP routing.',
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
      `HTTP jitter estimate: ${result.jitter} ms`,
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
      const response = await fetch('/api/network/edge', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
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
            const response = await fetch(`/api/speed/ping?sample=${i + 1}&t=${Date.now()}`, {
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
            const response = await fetch(`/api/speed/ping?monitor=${i + 1}&t=${Date.now()}`, {
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
      const jitter = samples.length > 1 ? samples.slice(1).reduce((sum, value, index) => sum + Math.abs(value - samples[index]), 0) / (samples.length - 1) : 0
      const spikes = samples.filter(value => value > average * 1.8 && value > average + 30).length
      setStabilityHistory(previous => [{ average, highest: Math.max(...samples), jitter, spikes, failures, samples: samples.length, date: new Date().toISOString() }, ...previous].slice(0, 30))
      setStabilityFinished(new Date().toLocaleTimeString())
    } catch (error) {
      setStabilityError(error instanceof Error ? error.message : 'Stability monitoring could not complete.')
    } finally {
      setStabilityRunning(false)
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
    setTestPhase('Measuring HTTP latency')
    setServicePhase('idle')
    setServiceResults([])
    setTestError('')
    try {
      const latency = await measurePing()
      setProgress(32)
      setTestPhase('Measuring live download throughput')
      const download = await measureDownload((mbps, bytes) => {
        setLiveSpeed(Number(mbps.toFixed(1)))
        setDownloadBytes(bytes)
        setProgress(32 + Math.min(36, (bytes / DOWNLOAD_BYTES) * 36))
      })
      setProgress(68)
      setTestPhase('Measuring upload throughput')
      const upload = await measureUpload((sentBytes, mbps) => {
        setUploadBytes(sentBytes)
        setUploadLiveSpeed(Number(mbps.toFixed(1)))
        setProgress(68 + Math.min(4, (sentBytes / UPLOAD_BYTES) * 4))
      })
      setProgress(72)
      setTestPhase('Checking public app endpoints')
      setServicePhase('running')
      setServiceResults(services.map(service => ({ name: service.name, status: 'Checking' })))
      const checks = await Promise.all(services.map(checkService))
      setServiceResults(checks)
      setServicePhase('complete')
      setProgress(92)
      const next = { ping: Math.round(latency.ping), download: Number(download.toFixed(1)), upload: Number(upload.toFixed(1)), jitter: Number(latency.jitter.toFixed(1)), date: new Date().toISOString() }
      setResult(next)
      setHistory(current => [next, ...current].slice(0, 50))
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
            <button className={activeTab === 'Overview' ? 'selected' : ''} onClick={() => navigateTo('Overview')}><Home size={15}/> Home</button>
            <button onClick={() => { navigateTo('Overview'); document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior:'smooth' }) }}>Speed Test</button>
            <button className={activeTab === 'Internet Doctor' ? 'selected' : ''} onClick={() => navigateTo('Internet Doctor')}>Internet Doctor</button>
            <button className={activeTab === 'Network' ? 'selected' : ''} onClick={() => navigateTo('Network')}>Tools⌄</button>
            <button className={activeTab === 'Global Network' ? 'selected' : ''} onClick={() => { navigateTo('Global Network'); if (!edgeInfo && !edgeLoading) void refreshEdgeInfo() }}>Global Network</button>
            <button className={activeTab === 'History' ? 'selected' : ''} onClick={() => navigateTo('History')}>History</button>
            <button className={activeTab === 'Report' ? 'selected' : ''} onClick={() => navigateTo('Report')}>Report</button>
            <button className={activeTab === 'About' ? 'selected' : ''} onClick={() => navigateTo('About')}>About</button>
          </nav>
          <div className="tezz-header-actions"><button aria-label="Open network tools" title="Network tools" onClick={() => navigateTo('Network')}><Search size={18}/></button><button className="tezz-menu" aria-expanded={mobileMenuOpen} aria-controls="tezz-mobile-nav" onClick={() => setMobileMenuOpen(open => !open)}>{mobileMenuOpen ? '✕ Close' : '☰ Menu'}</button></div>
        </header>
        {mobileMenuOpen && <nav className="tezz-mobile-nav" id="tezz-mobile-nav" aria-label="Mobile navigation">
          <button className={activeTab === 'Overview' ? 'selected' : ''} onClick={() => navigateTo('Overview')}>Home</button>
          <button onClick={() => { navigateTo('Overview'); window.setTimeout(() => document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>Speed Test</button>
          <button className={activeTab === 'Internet Doctor' ? 'selected' : ''} onClick={() => navigateTo('Internet Doctor')}>Internet Doctor</button>
          <button className={activeTab === 'Network' ? 'selected' : ''} onClick={() => navigateTo('Network')}>Network Tools</button>
          <button className={activeTab === 'Global Network' ? 'selected' : ''} onClick={() => { navigateTo('Global Network'); if (!edgeInfo && !edgeLoading) void refreshEdgeInfo() }}>Global Network</button>
          <button className={activeTab === 'History' ? 'selected' : ''} onClick={() => navigateTo('History')}>History</button>
          <button className={activeTab === 'Report' ? 'selected' : ''} onClick={() => navigateTo('Report')}>Performance Report</button>
          <button className={activeTab === 'About' ? 'selected' : ''} onClick={() => navigateTo('About')}>About TEZZ CONNECT</button>
        </nav>}
        <div className={`content ${activeTab === "Overview" ? "home-content" : ""}`}>
          {activeTab === 'Overview' && <>
          <section className={`tezz-hero ${state === 'running' ? 'is-testing' : ''}`}>
            <div className="tezz-hero-copy">
              <span className="tezz-pill">INTERNET SPEED TEST</span>
              <h1>Free Internet <em>Speed Test</em></h1>
              <p>Check download, upload, ping and network stability in seconds.</p>
              <ul><li><CheckCircle2 size={17}/> 25 MB download & upload tests</li><li><CheckCircle2 size={17}/> Ping, jitter & stability</li><li><CheckCircle2 size={17}/> Gaming & streaming readiness</li><li><CheckCircle2 size={17}/> Free, instant results</li></ul>
            </div>
            <div className="tezz-meter-wrap tezz-digital-wrap" id="tezz-speed-test">
              <div className="tezz-digital-meter" aria-live="polite">
                <span className="tezz-digital-label">{state === 'running' && testPhase.includes('upload') ? 'UPLOAD SPEED' : state === 'running' && testPhase.includes('download') ? 'DOWNLOAD SPEED' : 'INTERNET SPEED'}</span>
                <div className="tezz-digital-reading"><strong>{state === 'running' ? testPhase.includes('upload') ? uploadLiveSpeed.toFixed(1) : testPhase.includes('download') ? liveSpeed.toFixed(1) : '0.0' : result ? result.download.toFixed(1) : '0.0'}</strong><span>Mbps</span></div>
                <div className="tezz-digital-caption">{state === 'running' ? testPhase.includes('upload') ? 'Measuring your upload speed in real time' : testPhase.includes('download') ? 'Measuring your download speed in real time' : testPhase : result ? 'Your latest measured download speed' : 'Ready to measure your internet speed'}</div>
                <div className="tezz-digital-accent"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
              </div>
              <button className={`tezz-digital-start ${state==='running'?'testing':''}`} onClick={runTest} disabled={state==='running'}><Zap size={19} fill="currentColor"/>{state==='running'?'TEST IN PROGRESS':'START SPEED TEST'}</button>
              {state==='running'&&<div className="tezz-live-progress"><span>{testPhase}</span><span className="tezz-progress-value">{Math.round(progress)}%</span>{testPhase.includes('upload')?<strong>{(uploadBytes/1_000_000).toFixed(1)} / 25 MB · {uploadLiveSpeed.toFixed(1)} Mbps</strong>:testPhase.includes('download')?<strong>{(downloadBytes/1_000_000).toFixed(1)} / 25 MB</strong>:null}</div>}
              {state==='error'&&<div className="tezz-live-progress error-note" role="alert">{testError || 'The test could not complete. Please try again.'}</div>}
            </div>
            <div className="tezz-health-card"><div className="tezz-health-title"><HeartPulse size={27}/><strong>Internet Connection Health Check</strong></div><span className={`tezz-health-badge ${result?'':'pending'}`}>{result?quality:'Ready to test'}</span><p>{result?'Your internet speed and connection quality have been measured. Review your download, upload, latency and stability results for browsing, streaming, gaming and video calls.':'Run a free internet speed test to check download speed, upload speed, ping and connection quality for everyday browsing, streaming and online gaming.'}</p><div className="tezz-signal-bars"><i/><i/><i/><i/></div></div>
            <div className="tezz-wave" aria-hidden="true"><svg viewBox="0 0 1000 500" preserveAspectRatio="none"><defs><linearGradient id="tezz-signal-blue"><stop stopColor="#58b8ff" stopOpacity=".02"/><stop offset=".5" stopColor="#1686ed" stopOpacity=".8"/><stop offset="1" stopColor="#65d9ee" stopOpacity=".05"/></linearGradient><linearGradient id="tezz-signal-cyan"><stop stopColor="#64d8e8" stopOpacity=".02"/><stop offset=".55" stopColor="#36b8df" stopOpacity=".7"/><stop offset="1" stopColor="#1686ed" stopOpacity=".04"/></linearGradient></defs><path className="signal-wave signal-wave-back" d="M-30 78 C90 18 170 142 300 78 S510 18 640 78 S850 142 1030 72"/><path className="signal-wave signal-wave-mid" d="M-30 145 C100 82 185 210 320 145 S530 82 665 145 S875 210 1030 138"/><path className="signal-wave signal-wave-front" d="M-30 215 C100 150 195 278 330 212 S540 150 680 215 S880 280 1030 208"/><path className="signal-wave signal-wave-back" d="M-30 285 C100 220 195 350 330 284 S540 220 680 285 S880 350 1030 278"/><path className="signal-wave signal-wave-mid" d="M-30 355 C100 292 195 420 330 354 S540 292 680 355 S880 420 1030 348"/><path className="signal-wave signal-wave-front" d="M-30 425 C100 362 195 490 330 424 S540 362 680 425 S880 490 1030 418"/></svg></div>
          </section>
          <section className="tezz-stat-grid">
            <div className="tezz-stat cyan"><ArrowDown/><span>Download</span><strong>{result?result.download.toFixed(2):'—'} <small>Mbps</small></strong></div>
            <div className="tezz-stat violet"><ArrowUp/><span>Upload</span><strong>{result?result.upload.toFixed(2):'—'} <small>Mbps</small></strong></div>
            <div className="tezz-stat green"><ArrowLeftRight/><span>HTTP latency</span><strong>{result?result.ping:'—'} <small>ms</small></strong></div>
            <div className="tezz-stat red"><Activity/><span>Jitter</span><strong>{result?result.jitter.toFixed(1):'—'} <small>ms</small></strong></div>
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
            <div className="about-feature-grid">
              <article style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="about-feature-icon" style={{background:'#DFF5F7',borderColor:'#B9E7EB',color:'#087F91'}}><Zap size={20}/></span><h3 style={{color:'#142B45'}}>Measure performance</h3><p style={{color:'#53677D'}}>Run download and upload throughput tests, plus HTTP response-time and jitter estimates, from your browser.</p></article>
              <article style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="about-feature-icon" style={{background:'#DFF5F7',borderColor:'#B9E7EB',color:'#087F91'}}><Stethoscope size={20}/></span><h3 style={{color:'#142B45'}}>Understand issues</h3><p style={{color:'#53677D'}}>Use Internet Doctor recommendations to investigate common causes such as congestion, weak Wi-Fi conditions and competing traffic.</p></article>
              <article style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="about-feature-icon" style={{background:'#DFF5F7',borderColor:'#B9E7EB',color:'#087F91'}}><Globe2 size={20}/></span><h3 style={{color:'#142B45'}}>Explore your network</h3><p style={{color:'#53677D'}}>Review available network-edge information, connection signals and public website endpoint checks.</p></article>
            </div>
            <div className="about-two-column">
              <article className="about-info-card" style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="section-kicker" style={{color:'#087F91'}}>OUR APPROACH</span><h3 style={{color:'#142B45'}}>Clarity over exaggerated claims.</h3><p style={{color:'#53677D'}}>We explain what each test measures and where browser-based checks have limits. Results can vary with your device, Wi-Fi, ISP routing, server distance and network conditions.</p><p style={{color:'#53677D'}}>TEZZ CONNECT is an independent measurement tool. It is not an internet service provider and does not control your connection.</p></article>
              <article className="about-info-card" style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="section-kicker" style={{color:'#087F91'}}>PRIVACY & CONTROL</span><h3 style={{color:'#142B45'}}>Your test history stays on this device.</h3><p style={{color:'#53677D'}}>Saved speed, latency and stability history is stored in your browser. It is not synced between devices. Running a test sends measurement requests to TEZZ CONNECT so the service can return results.</p><p style={{color:'#53677D'}}>We do not need GPS or your street address to run the tools on this page.</p></article>
            </div>
            <div className="about-method-note" style={{background:'#E8F7F2',border:'1px solid #C5E8DB',color:'#365D53'}}><ShieldCheck size={18} style={{color:'#087F91'}}/><p style={{color:'#365D53'}}><strong style={{color:'#153E34'}}>Measurement note:</strong> latency and jitter are based on HTTP request/response timing to the TEZZ network edge, not ICMP ping. Public app checks test website endpoint reachability only; they do not verify sign-in, feeds, messages or in-app functionality.</p></div>
            <div className="about-cta"><div><span className="section-kicker">READY TO CHECK YOUR CONNECTION?</span><h2 style={{color:'#F7FBFF'}}>Start with a fresh speed test.</h2></div><button onClick={() => { navigateTo('Overview'); window.setTimeout(() => document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior: 'smooth' }), 0) }}>Go to speed test <span aria-hidden="true">→</span></button></div>
          </section>}
          {activeTab === 'Global Network' && <section className="global-network-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ GLOBAL NETWORK INTELLIGENCE</div><h2>See the network edge serving your test.</h2><p>View the network edge location and connection metadata observed for this request, alongside your measured response time.</p></div><span className="doctor-symbol"><Globe2 size={23}/></span></div>
            <div className="global-edge-card">
              <div className="global-edge-top"><div><span className="section-kicker">CURRENT TEZZ EDGE</span><h3>{edgeInfo?.colo || (edgeLoading ? 'Identifying edge…' : 'Edge information not loaded')}</h3></div><span className={edgeLoading ? 'latency-live-dot running' : 'latency-live-dot'} /></div>
              <div className="global-edge-grid">
                <div><span>Edge location code</span><strong>{edgeInfo?.colo || '—'}</strong></div>
                <div><span>Country</span><strong>{edgeInfo?.country || '—'}</strong></div>
                <div><span>Region</span><strong>{edgeInfo?.region || '—'}</strong></div>
                <div><span>Network ASN</span><strong>{edgeInfo?.asn ? `AS${edgeInfo.asn}` : '—'}</strong></div>
                <div className="global-edge-operator"><span>Network operator (ASN name)</span><strong>{edgeInfo?.organization || '—'}</strong></div>
              </div>
              <div className="global-edge-footer"><span>{edgeInfo ? `Updated at ${edgeInfo.fetchedAt}` : 'Metadata is supplied by the network edge handling this request.'}</span><button className="doctor-run-test" onClick={refreshEdgeInfo} disabled={edgeLoading}>{edgeLoading ? 'Refreshing…' : 'Refresh edge details'} <span aria-hidden="true">↻</span></button></div>
              {edgeError && <p className="latency-error" role="alert">{edgeError}</p>}
            </div>
            <div className="global-route-card">
              <div className="section-kicker">WHAT THIS TELLS YOU</div><h3>Your request reaches TEZZ through this edge.</h3>
              <div className="global-route-flow"><div className="global-route-node"><Globe2 size={20}/><strong>Your browser</strong><span>Current device and network</span></div><div className="global-route-connector"><i/></div><div className="global-route-node edge"><Network size={20}/><strong>Network edge</strong><span>{edgeInfo?.colo || 'Edge location'}</span></div><div className="global-route-connector"><i/></div><div className="global-route-node"><Server size={20}/><strong>TEZZ service</strong><span>Speed-test endpoint</span></div></div>
              <p>This is an edge-ingress view, not a traceroute. It does not reveal every router, your full ISP path, physical cable route or the destination path used by other websites. The edge location may change as network routing changes.</p>
            </div>
            <div className="global-network-note"><ShieldCheck size={16}/><span>Privacy and accuracy: TEZZ displays only coarse network-edge metadata returned for this request. It does not request GPS, expose your street address or run an IP geolocation lookup. ASN information identifies the network associated with the request, when provided.</span></div>
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
              <div className="latency-tool-heading"><div><span className="section-kicker">INDEPENDENT NETWORK TEST</span><h3>Latency &amp; Jitter Test</h3><p>12 small HTTP requests to the TEZZ network edge. No large download or upload.</p></div><span className={latencyRunning ? 'latency-live-dot running' : 'latency-live-dot'} /></div>
              <div className="latency-primary-result"><span>AVERAGE HTTP RESPONSE TIME</span><strong>{latencySamples.length ? (latencySamples.reduce((a,b)=>a+b,0)/latencySamples.length).toFixed(1) : '—'}<small> ms</small></strong><p>{latencyRunning ? `Measuring sample ${latencySamples.length + latencyFailures} of 12…` : latencyCompletedAt ? `Completed at ${latencyCompletedAt}` : 'Run the test to measure your response time.'}</p></div>
              <div className="latency-metrics-grid">
                <div><span>Minimum</span><strong>{latencySamples.length ? Math.min(...latencySamples).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>Maximum</span><strong>{latencySamples.length ? Math.max(...latencySamples).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>Jitter estimate</span><strong>{latencySamples.length > 1 ? (latencySamples.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-latencySamples[index]),0)/(latencySamples.length-1)).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>Failed requests</span><strong>{latencyCompletedAt || latencyRunning ? `${latencyFailures} / 12` : '—'}</strong></div>
              </div>
              {latencySamples.length > 1 && (() => {
                const jitterValue = latencySamples.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-latencySamples[index]),0)/(latencySamples.length-1)
                const level = jitterValue > 50 ? 'high' : jitterValue > 20 ? 'moderate' : 'low'
                return <div className={`latency-stability-note ${level}`}><div><span className="section-kicker">RESPONSE CONSISTENCY</span><strong>{level === 'high' ? 'Highly variable response times' : level === 'moderate' ? 'Some response-time variation' : 'Consistent response times'}</strong></div><p>{level === 'high' ? 'Large changes between consecutive requests were measured. Try moving closer to your Wi-Fi router, pausing background downloads and repeating the test.' : level === 'moderate' ? 'Response times changed between samples. Repeat the test when the network is quieter to see whether this pattern continues.' : 'The measured response times were relatively consistent during this short test.'} These are indicative thresholds for this tool, not a formal line-quality certification.</p></div>
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
              {stabilityError && <p className="latency-error" role="alert">{stabilityError}</p>}
              <button className="doctor-run-test latency-run-button" onClick={runStabilityMonitor} disabled={stabilityRunning || !network.online}>{stabilityRunning ? 'Monitoring…' : stabilityFinished ? 'Run monitor again' : 'Start 30-second monitor'} <span aria-hidden="true">→</span></button>
            </div>
            <div className="network-capabilities"><div><strong>Wi-Fi signal strength</strong><span>Not exposed by standard browser APIs</span></div><div><strong>Router / gateway details</strong><span>Not exposed to this webpage</span></div><div><strong>Live connection updates</strong><span>{network.supported ? 'Browser API available' : 'Limited browser support'}</span></div></div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Latency and jitter are measured as HTTP request/response times to the TEZZ edge, not ICMP ping. Failed requests are not labelled packet loss. Results can vary with device load, Wi-Fi, server distance and ISP routing.</div>
          </section>}
          {activeTab === 'Internet Doctor' && <section className="doctor-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ INTERNET DOCTOR</div><h2>Find out what is slowing you down.</h2><p>Use your latest speed test and browser network signals to identify likely connection issues.</p></div><span className="doctor-symbol"><Activity size={23}/></span></div>
            <div className="doctor-grid">
              <div className="doctor-status"><span className="section-kicker">DIAGNOSTIC STATUS</span><strong>{result ? quality : 'Awaiting test'}</strong><p>{result ? `Measured download ${result.download} Mbps · HTTP round-trip ${result.ping} ms · jitter estimate ${result.jitter} ms.` : 'Run the speed test first. The Doctor will use those measurements to tailor its recommendations.'}</p></div>
              <div className="doctor-findings">
                {!result ? <div className="doctor-finding"><span className="finding-dot neutral" /><div><strong>No test data yet</strong><p>Run a full 25 MB download and upload test to generate a measured connection report.</p><button className="doctor-run-test" onClick={() => { navigateTo('Overview'); window.setTimeout(() => { void runTest() }, 0) }}>Run speed test <span aria-hidden="true">→</span></button></div></div> :
                  <>
                    <div className="doctor-finding"><span className={result.download < 10 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.download < 10 ? 'Low download throughput' : 'Download throughput'}</strong><p>{result.download < 10 ? 'Try moving closer to your router, pause large downloads, and retest over a wired connection if possible.' : 'Your measured download rate is not showing a severe throughput bottleneck.'}</p></div></div>
                    <div className="doctor-finding"><span className={result.ping > 100 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.ping > 100 ? 'High HTTP response time detected' : 'HTTP latency check'}</strong><p>{result.ping > 100 ? 'Restart the router, reduce competing traffic, and test again. For gaming or calls, use Ethernet where possible.' : 'HTTP response time is not showing a severe delay in this test. This is not an ICMP ping measurement.'}</p></div></div>
                    <div className="doctor-finding"><span className={result.upload < 2 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.upload < 2 ? 'Limited upload capacity' : 'Upload check'}</strong><p>{result.upload < 2 ? 'Pause cloud backups and file uploads, then retest. Contact your ISP if the result remains consistently low.' : 'Upload throughput is not showing an obvious severe restriction.'}</p></div></div>
                    <div className="doctor-finding"><span className={result.jitter > 30 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.jitter > 30 ? 'Variable response times' : 'Response-time variation'}</strong><p>{result.jitter > 30 ? 'The HTTP timing samples varied noticeably. Pause background traffic, use a stable Wi-Fi or wired connection, and repeat the test.' : 'The measured HTTP timing samples were relatively consistent during this short test.'}</p></div></div>
                  </>
                }
                {!network.online && <div className="doctor-finding"><span className="finding-dot alert" /><div><strong>Device reports offline</strong><p>Your browser currently reports no network connection. Check Wi-Fi or mobile data before running another test.</p></div></div>}
              </div>
            </div>
            <div className="doctor-next-steps">
              <div className="doctor-next-heading"><div><span className="section-kicker">PERSONALISED TROUBLESHOOTING</span><h3>Recommended next steps</h3></div><button className="doctor-run-test" onClick={() => { navigateTo('Overview'); window.setTimeout(() => { void runTest() }, 0) }} disabled={state === 'running'}>{state === 'running' ? 'Test running…' : 'Run new test'} <span aria-hidden="true">→</span></button></div>
              <div className="doctor-next-grid">{doctorRecommendations.map(item => <div className="doctor-next-item" key={item.title}><span className={`doctor-priority ${item.priority}`}>{item.priority === 'high' ? 'Priority' : item.priority === 'medium' ? 'Suggested' : 'Next step'}</span><strong>{item.title}</strong><p>{item.detail}</p></div>)}</div>
            </div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Latency and jitter here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.</div>
          </section>}
          {activeTab === 'History' && <section className="history-page-panel">
            <div className="doctor-heading"><div><div className="section-kicker">YOUR LOCAL TEST RECORDS</div><h2>Internet speed test history.</h2><p>Review your recent download, upload, HTTP latency and jitter measurements saved in this browser.</p></div><span className="doctor-symbol"><History size={23}/></span></div>
            <div className="history-page-summary"><div><span>Saved tests</span><strong>{history.length}</strong></div><div><span>Storage</span><strong>This browser only</strong></div><div><span>Retention</span><strong>Up to 50 tests</strong></div></div>
            {history.length === 0 ? <div className="empty-history"><History size={18}/><span>No saved tests yet. Run a speed test to build your history.</span></div> : <div className="history-table">
              <div className="history-table-head"><span>Date & time</span><span>Download</span><span>Upload</span><span>HTTP latency</span><span>Jitter</span></div>
              {history.map(item => <div className="history-table-row" key={item.date}><span>{new Date(item.date).toLocaleString()}</span><strong>{item.download.toFixed(1)} Mbps</strong><strong>{item.upload.toFixed(1)} Mbps</strong><span>{item.ping} ms</span><span>{item.jitter.toFixed(1)} ms</span></div>)}
            </div>}
            <div className="latency-history-section">
              <div className="latency-history-heading"><div><span className="section-kicker">NETWORK RESPONSE RECORDS</span><h3>Latency test history</h3><p>Compare independent response-time tests saved on this device.</p></div><span className="latency-history-count">{latencyHistory.length} / 30</span></div>
              {latencyHistory.length === 0 ? <div className="empty-history"><Activity size={18}/><span>No latency tests saved yet. Run a test from Tools to start tracking response consistency.</span></div> : <>
                {latencyHistory.length > 1 && <div className="latency-history-comparison"><div><span>Latest average</span><strong>{latencyHistory[0].average.toFixed(1)} ms</strong></div><div><span>Previous average</span><strong>{latencyHistory[1].average.toFixed(1)} ms</strong></div><div><span>Change</span><strong>{Math.abs(latencyHistory[0].average-latencyHistory[1].average).toFixed(1)} ms {latencyHistory[0].average < latencyHistory[1].average ? 'faster' : latencyHistory[0].average > latencyHistory[1].average ? 'slower' : 'unchanged'}</strong></div></div>}
                <div className="latency-history-list">{latencyHistory.map((item,index)=><div className="latency-history-row" key={item.date}><span className="latency-history-index">#{index+1}</span><span className="latency-history-date">{new Date(item.date).toLocaleString()}</span><strong>{item.average.toFixed(1)} ms</strong><span>Jitter {item.jitter.toFixed(1)} ms</span><span>{item.failures}/12 failed</span></div>)}</div>
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
              <div className="performance-report-card"><span className="section-kicker">SPEED TEST</span><strong>{result ? result.download.toFixed(1)+' Mbps' : 'Not tested'}</strong><p>{result ? `Download · Upload ${result.upload.toFixed(1)} Mbps` : 'Run a speed test to add measurements.'}</p><small>{result ? `HTTP latency ${result.ping} ms · Jitter ${result.jitter.toFixed(1)} ms` : 'No saved speed result'}</small></div>
              <div className="performance-report-card"><span className="section-kicker">LATENCY TEST</span><strong>{latencyHistory[0] ? latencyHistory[0].average.toFixed(1)+' ms' : 'Not tested'}</strong><p>Average HTTP response time</p><small>{latencyHistory[0] ? `Jitter ${latencyHistory[0].jitter.toFixed(1)} ms · ${latencyHistory[0].failures}/12 failed` : 'No saved latency result'}</small></div>
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
            <div className="services-grid">{services.map(service => { const item = serviceResults.find(result => result.name === service.name); return <div className="service-tile" key={service.name}><div className="service-logo"><img src={service.icon} alt="" loading="lazy" /></div><div className="service-name">{service.name}</div><div className={`service-status ${item?.status === 'Responding' ? 'reachable' : item?.status === 'Could not verify' ? 'inconclusive' : ''}`}>{item ? item.status === 'Responding' ? `Responding · ${item.ms} ms` : item.status === 'Checking' ? 'Checking…' : 'Could not verify' : 'Not checked'}</div></div> })}</div>
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
                <div><h3>Online gaming</h3><p>{result ? result.ping <= 50 && result.jitter <= 20 ? 'Your measured latency and jitter look favourable for many online games. Actual gameplay also depends on the game server route.' : 'Your measured latency or jitter may affect responsiveness. Try a wired connection or stronger Wi-Fi and retest.' : 'Run a speed test to review latency and jitter, which often matter more than download speed for gaming.'}</p></div>
              </article>
            </div>
          </section>

          {state === 'complete' && result && <section className="report-panel">
            <div className="report-heading"><div><div className="section-kicker">YOUR CONNECTION REPORT</div><h2>Internet health summary</h2><p>Completed {new Date(result.date).toLocaleString()}</p></div><button className="report-copy" onClick={copyReport}><ClipboardCopy size={15}/> Copy report</button></div>
            <div className="report-summary"><div><span>Overall assessment</span><strong>{quality}</strong></div><div><span>Public endpoints responding</span><strong>{serviceResults.filter(item => item.status === 'Responding').length} / {services.length}</strong></div><div><span>Test data transferred</span><strong>Approx. 50 MB</strong></div></div>
            <p className="report-note">This report combines a 25 MB download, 25 MB upload, browser HTTP latency samples and public website endpoint checks. Results describe this test session and may vary by device, Wi-Fi, ISP routing and server location. App checks do not verify sign-in or in-app features.</p>
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
          <footer><span>© 2026 TEZZ CONNECT</span><span>BUILT FOR A BETTER CONNECTION <span className="footer-dot">•</span> PRIVACY FIRST</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
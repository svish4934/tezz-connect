import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDown, ArrowUp, CheckCircle2, ClipboardCopy, MonitorPlay, Video, Gamepad2,
  History, Monitor, HeartPulse, Stethoscope, ArrowLeftRight, Grid2X2, Search,
  ShieldCheck, Signal, Wifi, Zap, Home
} from 'lucide-react'

type TestState = 'idle' | 'running' | 'complete' | 'error'
type TestResult = { download: number; upload: number; ping: number; jitter: number; date: string }
type ServiceResult = { name: string; status: 'Checking' | 'Responding' | 'Could not verify'; ms?: number }
const services = [{ name: 'Facebook', url: 'https://www.facebook.com/', icon: 'https://cdn.simpleicons.org/facebook/1877F2' }, { name: 'Instagram', url: 'https://www.instagram.com/', icon: 'https://cdn.simpleicons.org/instagram/E4405F' }, { name: 'YouTube', url: 'https://www.youtube.com/', icon: 'https://cdn.simpleicons.org/youtube/FF0033' }, { name: 'WhatsApp', url: 'https://www.whatsapp.com/', icon: 'https://cdn.simpleicons.org/whatsapp/25D366' }, { name: 'Netflix', url: 'https://www.netflix.com/', icon: 'https://cdn.simpleicons.org/netflix/E50914' }, { name: 'Google', url: 'https://www.google.com/', icon: 'https://cdn.simpleicons.org/google/4285F4' }, { name: 'X', url: 'https://x.com/', icon: 'https://cdn.simpleicons.org/x/000000' }, { name: 'TikTok', url: 'https://www.tiktok.com/', icon: 'https://cdn.simpleicons.org/tiktok/000000' }]

const DOWNLOAD_BYTES = 50_000_000
const UPLOAD_BYTES = 50_000_000
const downloadUrl = `/api/speed/download?bytes=${DOWNLOAD_BYTES}`
const uploadUrl = '/api/speed/upload'

async function measurePing(): Promise<{ ping: number; jitter: number }> {
  const samples: number[] = []
  for (let i = 0; i < 4; i++) {
    const start = performance.now()
    const response = await fetch('/api/speed/ping', { cache: 'no-store' })
    if (!response.ok) throw new Error('Latency test endpoint unavailable')
    samples.push(performance.now() - start)
  }
  const ping = samples.reduce((a, b) => a + b, 0) / samples.length
  const jitter = samples.slice(1).reduce((total, value, index) => total + Math.abs(value - samples[index]), 0) / Math.max(1, samples.length - 1)
  return { ping, jitter }
}

async function measureDownload(onSample: (mbps: number, receivedBytes: number) => void): Promise<number> {
  const start = performance.now()
  const response = await fetch(downloadUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error('Download test endpoint unavailable')
  if (!response.body) {
    const data = await response.arrayBuffer()
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
  if (!receivedBytes) throw new Error('Download test returned no data')
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
    request.onabort = () => reject(new Error('Upload test was cancelled'))
    request.send(payload)
  })
}

const HISTORY_KEY = 'tezz-connect-test-history-v1'

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
  const [history, setHistory] = useState<TestResult[]>(loadHistory)
  const [result, setResult] = useState<TestResult | null>(() => loadHistory()[0] ?? null)
  const [activeTab, setActiveTab] = useState('Overview')
  const [network, setNetwork] = useState<{ type: string; downlink: string; rtt: string; online: boolean; saveData: boolean; supported: boolean }>({
    type: 'Checking', downlink: '—', rtt: '—', online: navigator.onLine, saveData: false, supported: false
  })

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch { /* Storage may be unavailable or full. */ }
  }, [history])

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
    setResult(null)
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
    } catch {
      setTestPhase('Test could not complete')
      setState('error')
      setServicePhase('idle')
      setProgress(0)
    }
  }



  return (
    <div className="app-shell">
      <main className="main tezz-main">
        <header className="tezz-header">
          <a className="tezz-logo" href="#" aria-label="TEZZ CONNECT home"><span className="tezz-logo-word">TEZZ<span>CONNECT</span></span><i /></a>
          <nav className="tezz-nav">
            <button className={activeTab === 'Overview' ? 'selected' : ''} onClick={() => setActiveTab('Overview')}><Home size={15}/> Home</button>
            <button onClick={() => { setActiveTab('Overview'); document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior:'smooth' }) }}>Speed Test</button>
            <button className={activeTab === 'Internet Doctor' ? 'selected' : ''} onClick={() => setActiveTab('Internet Doctor')}>Internet Doctor</button>
            <button onClick={() => setActiveTab('Network')}>Tools⌄</button>
            <button onClick={() => setActiveTab('History')}>Guides</button>
          </nav>
          <div className="tezz-header-actions"><button aria-label="Search"><Search size={18}/></button><button className="tezz-menu" onClick={() => setActiveTab(activeTab === 'History' ? 'Overview' : 'History')}>☰ Menu</button></div>
        </header>
        <div className={`content ${activeTab === "Overview" ? "home-content" : ""}`}>
          {activeTab === 'Overview' && <>
          <section className={`tezz-hero ${state === 'running' ? 'is-testing' : ''}`}>
            <div className="tezz-hero-copy">
              <span className="tezz-pill">INTERNET SPEED TEST</span>
              <h1>Free Internet <em>Speed Test</em></h1>
              <p>Check download, upload, ping and network stability in seconds.</p>
              <ul><li><CheckCircle2 size={17}/> 50 MB download & upload tests</li><li><CheckCircle2 size={17}/> Ping, jitter & stability</li><li><CheckCircle2 size={17}/> Gaming & streaming readiness</li><li><CheckCircle2 size={17}/> Free, instant results</li></ul>
            </div>
            <div className="tezz-meter-wrap tezz-digital-wrap" id="tezz-speed-test">
              <div className="tezz-digital-meter" aria-live="polite">
                <span className="tezz-digital-label">{state === 'running' && testPhase.includes('upload') ? 'UPLOAD SPEED' : state === 'running' && testPhase.includes('download') ? 'DOWNLOAD SPEED' : 'INTERNET SPEED'}</span>
                <div className="tezz-digital-reading"><strong>{state === 'running' ? testPhase.includes('upload') ? uploadLiveSpeed.toFixed(1) : testPhase.includes('download') ? liveSpeed.toFixed(1) : '0.0' : result ? result.download.toFixed(1) : '0.0'}</strong><span>Mbps</span></div>
                <div className="tezz-digital-caption">{state === 'running' ? testPhase.includes('upload') ? 'Measuring your upload speed in real time' : testPhase.includes('download') ? 'Measuring your download speed in real time' : testPhase : result ? 'Your latest measured download speed' : 'Ready to measure your internet speed'}</div>
                <div className="tezz-digital-accent"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
              </div>
              <button className={`tezz-digital-start ${state==='running'?'testing':''}`} onClick={runTest} disabled={state==='running'}><Zap size={19} fill="currentColor"/>{state==='running'?'TEST IN PROGRESS':'START SPEED TEST'}</button>
              {state==='running'&&<div className="tezz-live-progress"><span>{testPhase}</span><span className="tezz-progress-value">{Math.round(progress)}%</span>{testPhase.includes('upload')?<strong>{(uploadBytes/1_000_000).toFixed(1)} / 50 MB · {uploadLiveSpeed.toFixed(1)} Mbps</strong>:testPhase.includes('download')?<strong>{(downloadBytes/1_000_000).toFixed(1)} / 50 MB</strong>:null}</div>}
              {state==='error'&&<div className="tezz-live-progress error-note">Test unavailable — check Worker deployment.</div>}
            </div>
            <div className="tezz-health-card"><div className="tezz-health-title"><HeartPulse size={27}/><strong>Internet Connection Health Check</strong></div><span className={`tezz-health-badge ${result?'':'pending'}`}>{result?quality:'Ready to test'}</span><p>{result?'Your internet speed and connection quality have been measured. Review your download, upload, latency and stability results for browsing, streaming, gaming and video calls.':'Run a free internet speed test to check download speed, upload speed, ping and connection quality for everyday browsing, streaming and online gaming.'}</p><div className="tezz-signal-bars"><i/><i/><i/><i/></div></div>
            <div className="tezz-wave" aria-hidden="true"><svg viewBox="0 0 1000 180" preserveAspectRatio="none"><defs><linearGradient id="tezz-signal-blue"><stop stopColor="#58b8ff" stopOpacity=".05"/><stop offset=".5" stopColor="#1686ed" stopOpacity=".9"/><stop offset="1" stopColor="#65d9ee" stopOpacity=".12"/></linearGradient><linearGradient id="tezz-signal-cyan"><stop stopColor="#64d8e8" stopOpacity=".05"/><stop offset=".55" stopColor="#36b8df" stopOpacity=".65"/><stop offset="1" stopColor="#1686ed" stopOpacity=".08"/></linearGradient></defs><path className="signal-wave signal-wave-back" d="M-20 95 C95 20 160 160 280 92 S470 22 590 94 S790 162 910 88 S1060 35 1100 95"/><path className="signal-wave signal-wave-mid" d="M-20 112 C100 52 170 168 300 108 S500 46 630 110 S820 168 950 104 S1070 58 1100 112"/><path className="signal-wave signal-wave-front" d="M-20 128 C100 80 185 158 315 126 S510 82 650 125 S850 158 980 122 S1080 92 1100 128"/></svg></div>
          </section>
          <section className="tezz-stat-grid">
            <div className="tezz-stat cyan"><ArrowDown/><span>Download</span><strong>{result?result.download.toFixed(2):'—'} <small>Mbps</small></strong></div>
            <div className="tezz-stat violet"><ArrowUp/><span>Upload</span><strong>{result?result.upload.toFixed(2):'—'} <small>Mbps</small></strong></div>
            <div className="tezz-stat green"><ArrowLeftRight/><span>Ping</span><strong>{result?result.ping:'—'} <small>ms</small></strong></div>
            <div className="tezz-stat red"><Activity/><span>Jitter</span><strong>{result?result.jitter.toFixed(1):'—'} <small>ms</small></strong></div>
          </section>
          <section className="tezz-feature-grid">
            <button onClick={()=>setActiveTab('Internet Doctor')}><Stethoscope/><strong>Internet Doctor</strong><span>Find and fix internet problems</span><b>›</b></button>
            <button onClick={()=>setActiveTab('Network')}><ArrowLeftRight/><strong>Ping Test</strong><span>Check your latency</span><b>›</b></button>
            <button onClick={()=>setActiveTab('Network')}><Wifi/><strong>Wi-Fi Test</strong><span>Test your Wi-Fi performance</span><b>›</b></button>
            <button onClick={()=>setActiveTab('History')}><Grid2X2/><strong>More Tools</strong><span>Explore all network tools</span><b>›</b></button>
          </section>
          </>}
          {activeTab === 'Network' && <section className="network-intel-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ NETWORK INTELLIGENCE</div><h2>Know what your browser can see.</h2><p>Live device connectivity signals and network estimates, refreshed when the connection changes.</p></div><span className="doctor-symbol"><Wifi size={23}/></span></div>
            <div className="network-intel-grid">
              <div className="network-primary"><span className={network.online ? 'finding-dot good' : 'finding-dot alert'} /><div><span className="section-kicker">INTERNET REACHABILITY</span><strong>{network.online ? 'Browser reports online' : 'Browser reports offline'}</strong><p>{network.online ? 'Your device reports an active network connection. This does not guarantee that every website is reachable.' : 'Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.'}</p></div></div>
              <div className="network-detail"><span>Effective connection type</span><strong>{network.type}</strong></div>
              <div className="network-detail"><span>Estimated downlink</span><strong>{network.downlink}</strong></div>
              <div className="network-detail"><span>Browser HTTP round-trip</span><strong>{network.rtt}</strong></div>
              <div className="network-detail"><span>Data saver preference</span><strong>{network.supported ? (network.saveData ? 'Enabled' : 'Not requested') : 'Not available'}</strong></div>
            </div>
            <div className="network-capabilities"><div><strong>Wi-Fi signal strength</strong><span>Not exposed by standard browser APIs</span></div><div><strong>Router / gateway details</strong><span>Not exposed to this webpage</span></div><div><strong>Live connection updates</strong><span>{network.supported ? 'Browser API available' : 'Limited browser support'}</span></div></div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Estimates are browser-provided and may be unavailable or rounded. For accurate Wi-Fi signal strength and router diagnostics, a native device-level test is required.</div>
          </section>}
          {activeTab === 'Internet Doctor' && <section className="doctor-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ INTERNET DOCTOR</div><h2>Find out what is slowing you down.</h2><p>Use your latest speed test and browser network signals to identify likely connection issues.</p></div><span className="doctor-symbol"><Activity size={23}/></span></div>
            <div className="doctor-grid">
              <div className="doctor-status"><span className="section-kicker">DIAGNOSTIC STATUS</span><strong>{result ? quality : 'Awaiting test'}</strong><p>{result ? `Measured download ${result.download} Mbps · HTTP round-trip ${result.ping} ms · jitter estimate ${result.jitter} ms.` : 'Run the speed test first. The Doctor will use those measurements to tailor its recommendations.'}</p></div>
              <div className="doctor-findings">
                {!result ? <div className="doctor-finding"><span className="finding-dot neutral" /><div><strong>No test data yet</strong><p>Start a speed test on Overview to generate a connection report.</p></div></div> :
                  <>
                    <div className="doctor-finding"><span className={result.download < 10 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.download < 10 ? 'Low download throughput' : 'Download throughput'}</strong><p>{result.download < 10 ? 'Try moving closer to your router, pause large downloads, and retest over a wired connection if possible.' : 'Your measured download rate is not showing a severe throughput bottleneck.'}</p></div></div>
                    <div className="doctor-finding"><span className={result.ping > 100 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.ping > 100 ? 'High HTTP response time detected' : 'HTTP latency check'}</strong><p>{result.ping > 100 ? 'Restart the router, reduce competing traffic, and test again. For gaming or calls, use Ethernet where possible.' : 'Latency is within a generally workable range for everyday browsing and calls.'}</p></div></div>
                    <div className="doctor-finding"><span className={result.upload < 2 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.upload < 2 ? 'Limited upload capacity' : 'Upload check'}</strong><p>{result.upload < 2 ? 'Pause cloud backups and file uploads, then retest. Contact your ISP if the result remains consistently low.' : 'Upload throughput is not showing an obvious severe restriction.'}</p></div></div>
                  </>
                }
              </div>
            </div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Latency and jitter here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.</div>
          </section>}
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
            <div className="report-summary"><div><span>Overall assessment</span><strong>{quality}</strong></div><div><span>Public endpoints responding</span><strong>{serviceResults.filter(item => item.status === 'Responding').length} / {services.length}</strong></div><div><span>Test data transferred</span><strong>Approx. 100 MB</strong></div></div>
            <p className="report-note">This report combines a 50 MB download, 50 MB upload, browser HTTP latency samples and public website endpoint checks. Results describe this test session and may vary by device, Wi-Fi, ISP routing and server location. App checks do not verify sign-in or in-app features.</p>
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
            <div className="history-heading"><div><div className="section-kicker">RECENT ACTIVITY</div><h3>Test history</h3></div><button onClick={() => setActiveTab('History')}>View history <span>→</span></button></div>
            {history.length === 0 ? <div className="empty-history"><History size={18} /><span>Your recent tests will appear here after your first run.</span></div> : history.slice(0, 3).map((item, i) => <div className="history-item" key={item.date}><span className="history-index">0{i + 1}</span><span>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><strong>{item.download} Mbps</strong><span>{item.ping} ms latency</span><span className="history-good">{item.download >= 25 ? 'Good' : 'Fair'}</span></div>)}
          </section>
          <footer><span>© 2026 TEZZ CONNECT</span><span>BUILT FOR A BETTER CONNECTION <span className="footer-dot">•</span> PRIVACY FIRST</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, CircleHelp, ClipboardCopy,
  Clock3, Gauge, History, Monitor, Play, RefreshCw, HeartPulse, Stethoscope, ArrowLeftRight, Grid2X2, Search,
  ShieldCheck, Signal, Wifi, Zap, Home
} from 'lucide-react'

type TestState = 'idle' | 'running' | 'complete' | 'error'
type TestResult = { download: number; upload: number; ping: number; jitter: number; date: string }
type ServiceResult = { name: string; status: 'Checking' | 'Reachable' | 'Unavailable'; ms?: number }
const services = [{ name: 'Facebook', host: 'https://www.facebook.com/favicon.ico', icon: 'https://cdn.simpleicons.org/facebook/1877F2' }, { name: 'Instagram', host: 'https://www.instagram.com/favicon.ico', icon: 'https://cdn.simpleicons.org/instagram/E4405F' }, { name: 'YouTube', host: 'https://www.youtube.com/favicon.ico', icon: 'https://cdn.simpleicons.org/youtube/FF0033' }, { name: 'WhatsApp', host: 'https://www.whatsapp.com/favicon.ico', icon: 'https://cdn.simpleicons.org/whatsapp/25D366' }, { name: 'Netflix', host: 'https://www.netflix.com/favicon.ico', icon: 'https://cdn.simpleicons.org/netflix/E50914' }, { name: 'Google', host: 'https://www.google.com/favicon.ico', icon: 'https://cdn.simpleicons.org/google/4285F4' }, { name: 'X', host: 'https://x.com/favicon.ico', icon: 'https://cdn.simpleicons.org/x/FFFFFF' }, { name: 'TikTok', host: 'https://www.tiktok.com/favicon.ico', icon: 'https://cdn.simpleicons.org/tiktok/FFFFFF' }]

const DOWNLOAD_BYTES = 100_000_000
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

async function measureUpload(): Promise<number> {
  const payload = new Uint8Array(1_000_000)
  for (let offset = 0; offset < payload.length; offset += 65_536) {
    crypto.getRandomValues(payload.subarray(offset, Math.min(offset + 65_536, payload.length)))
  }
  const start = performance.now()
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: payload,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Upload test endpoint unavailable')
  const seconds = (performance.now() - start) / 1000
  return (payload.byteLength * 8) / seconds / 1_000_000
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
  const [testPhase, setTestPhase] = useState('Ready to test')
  const [serviceResults, setServiceResults] = useState<ServiceResult[]>([])
  const [servicePhase, setServicePhase] = useState<'idle' | 'running' | 'complete'>('idle')
  const [reportMessage, setReportMessage] = useState('')
  const [history, setHistory] = useState<TestResult[]>(loadHistory)
  const [result, setResult] = useState<TestResult | null>(() => loadHistory()[0] ?? null)
  const [activeTab, setActiveTab] = useState('Overview')
  const gaugeSpeed = state === 'running' ? liveSpeed : (result?.download ?? 0)
  const needleAngle = -135 + (Math.min(Math.max(gaugeSpeed, 0), 100) / 100) * 270
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
    return new Promise(resolve => {
      const image = new Image()
      const timer = window.setTimeout(() => { image.src = ''; resolve({ name: service.name, status: 'Unavailable' }) }, 7000)
      image.onload = () => { window.clearTimeout(timer); resolve({ name: service.name, status: 'Reachable', ms: Math.round(performance.now() - started) }) }
      image.onerror = () => { window.clearTimeout(timer); resolve({ name: service.name, status: 'Unavailable' }) }
      image.src = `${service.host}?tezz=${Date.now()}`
    })
  }

  async function copyReport() {
    if (!result) return
    const reachable = serviceResults.filter(item => item.status === 'Reachable').length
    const report = [
      'TEZZ CONNECT — Internet Health Report',
      `Test date: ${new Date(result.date).toLocaleString()}`,
      `Download: ${result.download} Mbps`,
      `Upload: ${result.upload} Mbps`,
      `HTTP latency: ${result.ping} ms`,
      `HTTP jitter estimate: ${result.jitter} ms`,
      `Public service endpoints reachable: ${reachable}/${services.length}`,
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
      const upload = await measureUpload()
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

  const navItems = [
    { label: 'Overview', icon: Gauge },
    { label: 'Internet Doctor', icon: Activity },
    { label: 'Network', icon: Wifi },
    { label: 'History', icon: History },
  ]

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
        <div className="content">
          {activeTab === 'Overview' && <>
          <section className="tezz-hero">
            <div className="tezz-hero-copy">
              <span className="tezz-pill">INTERNET SPEED TEST</span>
              <h1>How fast is your <em>internet?</em></h1>
              <p>Test your connection, diagnose problems, and improve your online experience.</p>
              <ul><li><CheckCircle2 size={17}/> Download & Upload Speed</li><li><CheckCircle2 size={17}/> Ping & Network Quality</li><li><CheckCircle2 size={17}/> Instant Results</li><li><CheckCircle2 size={17}/> Free & Easy to Use</li></ul>
            </div>
            <div className="tezz-meter-wrap" id="tezz-speed-test">
              <svg className="tezz-arc" viewBox="0 0 340 220" role="img" aria-label="Internet speed meter">
                <defs><linearGradient id="tezz-spectrum" x1="0%" y1="100%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00f2e8"/><stop offset="30%" stopColor="#00bfff"/><stop offset="56%" stopColor="#6d5cff"/><stop offset="78%" stopColor="#c12cff"/><stop offset="100%" stopColor="#ff315e"/></linearGradient><filter id="tezz-glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
                <path d="M34 184 A136 136 0 0 1 306 184" fill="none" stroke="#17243c" strokeWidth="17" strokeLinecap="round"/>
                <path d="M34 184 A136 136 0 0 1 306 184" fill="none" stroke="url(#tezz-spectrum)" strokeWidth="13" strokeLinecap="round" filter="url(#tezz-glow)"/>
                {Array.from({length:17},(_,i)=>{const angle=(-180+i*11.25)*Math.PI/180;const x1=170+112*Math.cos(angle),y1=184+112*Math.sin(angle),x2=170+126*Math.cos(angle),y2=184+126*Math.sin(angle);return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i<5?'#19e9f2':i<10?'#8e6aff':i<14?'#d14cff':'#ff4777'} strokeWidth={i%2===0?3:2} strokeLinecap="round"/>})}
                {state==='running'&&<g transform={`rotate(${-90+(Math.min(Math.max(gaugeSpeed,0),300)/300)*180} 170 184)`}><path d="M170 184 L170 65" stroke="#eaffff" strokeWidth="3" strokeLinecap="round" filter="url(#tezz-glow)"/><circle cx="170" cy="184" r="6" fill="#fff" stroke="#24e7f0" strokeWidth="3"/></g>}
              </svg>
              <button className={`tezz-go ${state==='running'?'testing':''}`} onClick={runTest} disabled={state==='running'}><Zap size={27} fill="currentColor"/><strong>{state==='running'?(liveSpeed>0?liveSpeed.toFixed(1):'…'):result?result.download:'GO'}</strong><span>{state==='running'?'Mbps':result?'Mbps':'Start Test'}</span></button>
              {state==='running'&&<div className="tezz-live-progress"><span>{testPhase}</span><strong>{(downloadBytes/1_000_000).toFixed(1)} / 100 MB</strong></div>}
              {state==='error'&&<div className="tezz-live-progress error-note">Test unavailable — check Worker deployment.</div>}
            </div>
            <div className="tezz-health-card"><div className="tezz-health-title"><HeartPulse size={27}/><strong>Your Internet Health</strong></div><span className={`tezz-health-badge ${result?'':'pending'}`}>{result?quality:'Ready to test'}</span><p>{result?'Your connection has been measured. Review your results for browsing, streaming and gaming.':'Run a test to see how your connection performs for browsing, streaming and gaming.'}</p><div className="tezz-signal-bars"><i/><i/><i/><i/></div></div>
            <div className="tezz-wave" aria-hidden="true"><svg viewBox="0 0 1000 90" preserveAspectRatio="none"><defs><linearGradient id="wave-spectrum"><stop stopColor="#a12bff"/><stop offset=".5" stopColor="#00d8ff"/><stop offset="1" stopColor="#8a48ff"/></linearGradient></defs><path d="M0 48 C110 4 155 88 265 48 S420 8 530 48 S700 88 800 43 S920 8 1000 45" fill="none" stroke="url(#wave-spectrum)" strokeWidth="2" strokeDasharray="2 7"/></svg></div>
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
          <section className="services-panel">
            <div className="services-heading"><div><div className="section-kicker">APP & PLATFORM CONNECTIVITY</div><h2>Your everyday apps, checked.</h2><p>Automatically tested after the speed test completes.</p></div><span className="services-live">{servicePhase === 'running' ? 'SCANNING' : servicePhase === 'complete' ? 'SCAN COMPLETE' : 'READY'}</span></div>
            <div className="services-grid">{services.map(service => { const item = serviceResults.find(result => result.name === service.name); return <div className="service-tile" key={service.name}><div className="service-logo"><img src={service.icon} alt="" loading="lazy" /></div><div className="service-name">{service.name}</div><div className={`service-status ${item?.status === 'Reachable' ? 'reachable' : item?.status === 'Unavailable' ? 'unavailable' : ''}`}>{item ? item.status === 'Reachable' ? `Reachable · ${item.ms} ms` : 'Not verified' : 'Not tested yet'}</div></div> })}</div>
            <div className="service-note">These lightweight browser checks look for a response from each service's public website. A missing response can also be caused by content blockers, CDN rules or browser privacy settings; it does not prove the service is down. They do not verify login or in-app features.</div>
          </section>

          {state === 'complete' && result && <section className="report-panel">
            <div className="report-heading"><div><div className="section-kicker">YOUR CONNECTION REPORT</div><h2>Internet health summary</h2><p>Completed {new Date(result.date).toLocaleString()}</p></div><button className="report-copy" onClick={copyReport}><ClipboardCopy size={15}/> Copy report</button></div>
            <div className="report-summary"><div><span>Overall assessment</span><strong>{quality}</strong></div><div><span>Public endpoints responding</span><strong>{serviceResults.filter(item => item.status === 'Reachable').length} / {services.length}</strong></div><div><span>Test data transferred</span><strong>Approx. 101 MB</strong></div></div>
            <p className="report-note">This report combines a 100 MB download, 1 MB upload, browser HTTP latency samples and public website endpoint checks. Results describe this test session and may vary by device, Wi-Fi, ISP routing and server location. App checks do not verify sign-in or in-app features.</p>
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

function Metric({ icon, label, value, unit, tone }: { icon: ReactNode; label: string; value: string; unit: string; tone: string }) {
  return <div className="metric"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}<small> {unit}</small></strong></div></div>
}

export default App
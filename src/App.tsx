import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, CircleHelp,
  Clock3, Gauge, History, Monitor, Play, RefreshCw,
  ShieldCheck, Signal, Wifi, Zap
} from 'lucide-react'

type TestState = 'idle' | 'running' | 'complete' | 'error'
type TestResult = { download: number; upload: number; ping: number; jitter: number; date: string }

const downloadUrl = '/api/speed/download?bytes=5000000'
const uploadUrl = '/api/speed/upload'

async function measurePing(): Promise<{ ping: number; jitter: number }> {
  const samples: number[] = []
  for (let i = 0; i < 4; i++) {
    const start = performance.now()
    await fetch('/api/speed/ping', { cache: 'no-store' })
    samples.push(performance.now() - start)
  }
  const ping = samples.reduce((a, b) => a + b, 0) / samples.length
  const jitter = samples.slice(1).reduce((total, value, index) => total + Math.abs(value - samples[index]), 0) / Math.max(1, samples.length - 1)
  return { ping, jitter }
}

async function measureDownload(): Promise<number> {
  const start = performance.now()
  const response = await fetch(downloadUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error('Download test endpoint unavailable')
  const data = await response.arrayBuffer()
  const seconds = (performance.now() - start) / 1000
  return (data.byteLength * 8) / seconds / 1_000_000
}

async function measureUpload(): Promise<number> {
  const payload = new Uint8Array(1_000_000)
  crypto.getRandomValues(payload.subarray(0, 65_536))
  for (let i = 65_536; i < payload.length; i += 65_536) {
    payload.set(payload.subarray(0, Math.min(65_536, payload.length - i)), i)
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

  async function runTest() {
    if (state === 'running') return
    setState('running')
    setProgress(8)
    setResult(null)
    try {
      const latency = await measurePing()
      setProgress(32)
      const download = await measureDownload()
      setProgress(68)
      const upload = await measureUpload()
      setProgress(92)
      const next = { ping: Math.round(latency.ping), download: Number(download.toFixed(1)), upload: Number(upload.toFixed(1)), jitter: Number(latency.jitter.toFixed(1)), date: new Date().toISOString() }
      setResult(next)
      setHistory(current => [next, ...current].slice(0, 50))
      setProgress(100)
      setState('complete')
    } catch {
      setState('error')
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
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="TEZZ CONNECT home">
          <span className="brand-mark"><Zap size={21} fill="currentColor" /></span>
          <span>TEZZ<span className="brand-light">CONNECT</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeTab === label ? 'active' : ''}`} onClick={() => setActiveTab(label)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><ShieldCheck size={18} /><div><strong>Your data stays yours</strong><span>Tests run securely. History is saved on this device.</span></div></div>
          <div className="profile"><div className="avatar">T</div><div><strong>TEZZ CONNECT</strong><span>Personal workspace</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <a className="brand" href="#" aria-label="TEZZ CONNECT home"><span className="brand-mark"><Zap size={20} fill="currentColor" /></span><span>TEZZ<span className="brand-light">CONNECT</span></span></a>
          <nav className="desktop-nav">
            {navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeTab === label ? 'active' : ''}`} onClick={() => setActiveTab(label)}><Icon size={16}/><span>{label}</span></button>)}
          </nav>
          <div className="topbar-right"><span className="live-dot" /> SYSTEM READY <div className="top-icon"><CircleHelp size={18} /></div></div>
        </header>

        <div className="content">
          <section className="welcome">
            <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR INTERNET, DECODED</div><h1>Connection clarity.<br /><span>At full speed.</span></h1><p>Measure your connection, understand your network, and get more from every megabit.</p></div>
            <div className="welcome-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Wifi size={34} /></div><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /></div>
          </section>

          {activeTab === 'Network' && <section className="network-intel-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ NETWORK INTELLIGENCE</div><h2>Know what your browser can see.</h2><p>Live device connectivity signals and network estimates, refreshed when the connection changes.</p></div><span className="doctor-symbol"><Wifi size={23}/></span></div>
            <div className="network-intel-grid">
              <div className="network-primary"><span className={network.online ? 'finding-dot good' : 'finding-dot alert'} /><div><span className="section-kicker">INTERNET REACHABILITY</span><strong>{network.online ? 'Browser reports online' : 'Browser reports offline'}</strong><p>{network.online ? 'Your device reports an active network connection. This does not guarantee that every website is reachable.' : 'Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.'}</p></div></div>
              <div className="network-detail"><span>Effective connection type</span><strong>{network.type}</strong></div>
              <div className="network-detail"><span>Estimated downlink</span><strong>{network.downlink}</strong></div>
              <div className="network-detail"><span>Estimated round-trip time</span><strong>{network.rtt}</strong></div>
              <div className="network-detail"><span>Data saver preference</span><strong>{network.supported ? (network.saveData ? 'Enabled' : 'Not requested') : 'Not available'}</strong></div>
            </div>
            <div className="network-capabilities"><div><strong>Wi-Fi signal strength</strong><span>Not exposed by standard browser APIs</span></div><div><strong>Router / gateway details</strong><span>Not exposed to this webpage</span></div><div><strong>Live connection updates</strong><span>{network.supported ? 'Browser API available' : 'Limited browser support'}</span></div></div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Estimates are browser-provided and may be unavailable or rounded. For accurate Wi-Fi signal strength and router diagnostics, a native device-level test is required.</div>
          </section>}
          {activeTab === 'Internet Doctor' && <section className="doctor-panel">
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ INTERNET DOCTOR</div><h2>Find out what is slowing you down.</h2><p>Use your latest speed test and browser network signals to identify likely connection issues.</p></div><span className="doctor-symbol"><Activity size={23}/></span></div>
            <div className="doctor-grid">
              <div className="doctor-status"><span className="section-kicker">DIAGNOSTIC STATUS</span><strong>{result ? quality : 'Awaiting test'}</strong><p>{result ? `Measured download ${result.download} Mbps · latency ${result.ping} ms · jitter estimate ${result.jitter} ms.` : 'Run the speed test first. The Doctor will use those measurements to tailor its recommendations.'}</p></div>
              <div className="doctor-findings">
                {!result ? <div className="doctor-finding"><span className="finding-dot neutral" /><div><strong>No test data yet</strong><p>Start a speed test on Overview to generate a connection report.</p></div></div> :
                  <>
                    <div className="doctor-finding"><span className={result.download < 10 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.download < 10 ? 'Low download throughput' : 'Download throughput'}</strong><p>{result.download < 10 ? 'Try moving closer to your router, pause large downloads, and retest over a wired connection if possible.' : 'Your measured download rate is not showing a severe throughput bottleneck.'}</p></div></div>
                    <div className="doctor-finding"><span className={result.ping > 100 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.ping > 100 ? 'High latency detected' : 'Latency check'}</strong><p>{result.ping > 100 ? 'Restart the router, reduce competing traffic, and test again. For gaming or calls, use Ethernet where possible.' : 'Latency is within a generally workable range for everyday browsing and calls.'}</p></div></div>
                    <div className="doctor-finding"><span className={result.upload < 2 ? 'finding-dot alert' : 'finding-dot good'} /><div><strong>{result.upload < 2 ? 'Limited upload capacity' : 'Upload check'}</strong><p>{result.upload < 2 ? 'Pause cloud backups and file uploads, then retest. Contact your ISP if the result remains consistently low.' : 'Upload throughput is not showing an obvious severe restriction.'}</p></div></div>
                  </>
                }
              </div>
            </div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.</div>
          </section>}
          <section className="test-panel">
            <div className="panel-heading"><div><div className="section-kicker">SPEED TEST</div><h2>How fast is your internet?</h2><p>Run a quick test to see your real-world connection performance.</p></div><div className="test-status"><span className={state === 'running' ? 'pulse-dot' : 'live-dot'} />{state === 'running' ? 'TEST IN PROGRESS' : state === 'complete' ? 'TEST COMPLETE' : state === 'error' ? 'TEST UNAVAILABLE' : 'READY WHEN YOU ARE'}</div></div>
            <div className="speed-layout">
              <div className="speed-gauge">
                <div className="gauge-halo"><div className="gauge-inner"><span className="gauge-label">DOWNLOAD</span><strong>{result ? result.download : '—'}</strong><span className="gauge-unit">Mbps</span></div></div>
                <button className="run-button" onClick={runTest} disabled={state === 'running'}><Play size={17} fill="currentColor" />{state === 'running' ? 'Testing…' : state === 'complete' ? 'Test again' : 'Start test'}</button>
                {state === 'running' && <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>}
                {state === 'error' && <p className="error-note">Speed test service is not deployed yet. The interface is ready; deploy the Worker to enable live measurements.</p>}
              </div>
              <div className="metrics-grid">
                <Metric icon={<ArrowDown size={17} />} label="Download" value={result ? result.download.toString() : '—'} unit="Mbps" tone="cyan" />
                <Metric icon={<ArrowUp size={17} />} label="Upload" value={result ? result.upload.toString() : '—'} unit="Mbps" tone="violet" />
                <Metric icon={<Clock3 size={17} />} label="Latency" value={result ? result.ping.toString() : '—'} unit="ms" tone="mint" />
                <Metric icon={<Activity size={17} />} label="Jitter" value={result ? result.jitter.toString() : '—'} unit="ms" tone="amber" />
              </div>
            </div>
            <div className="panel-foot"><span><ShieldCheck size={15} /> No account required</span><span><RefreshCw size={14} /> Results are estimates and vary by device and network</span></div>
          </section>

          <div className="lower-grid">
            <section className="info-card">
              <div className="card-title"><div><div className="section-kicker">NETWORK SNAPSHOT</div><h3>Your connection</h3></div><span className="card-icon"><Signal size={18} /></span></div>
              <div className="network-row"><span>Connection type</span><strong>{network.type}</strong></div>
              <div className="network-row"><span>Estimated downlink</span><strong>{network.downlink}</strong></div>
              <div className="network-row"><span>Browser RTT estimate</span><strong>{network.rtt}</strong></div>
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
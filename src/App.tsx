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

async function measureDownload(durationMs: number, maxBytes: number, onSample: (mbps: number, receivedBytes: number) => void): Promise<number> {
  const url = `/api/v1/speed/download?durationMs=${durationMs}&maxBytes=${maxBytes}`
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(Math.max(durationMs + 45000, 60000)) })
  const contentType = response.headers.get('content-type') ?? 'missing'
  if (!response.ok) throw new Error(`Download endpoint returned HTTP ${response.status} (${contentType})`)
  if (!contentType.toLowerCase().includes('application/octet-stream')) {
    const preview = (await response.clone().text()).slice(0, 120).replace(/\\s+/g, ' ')
    throw new Error(`Download endpoint returned unexpected content type: ${contentType}. Response: ${preview || 'empty'}`)
  }
  if (!response.body) throw new Error('Streaming download is not supported by this browser')
  const started = performance.now()
  const reader = response.body.getReader()
  let receivedBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    const seconds = Math.max((performance.now() - started) / 1000, 0.001)
    const mbps = (receivedBytes * 8) / seconds / 1_000_000
    onSample(mbps, receivedBytes)
  }
  if (receivedBytes < 1) throw new Error('Download test returned no data')
  const elapsedMs = performance.now() - started
  return (receivedBytes * 8) / Math.max(elapsedMs / 1000, 0.001) / 1_000_000
}

async function measureUpload(bytes: number, onProgress: (sentBytes: number, mbps: number) => void): Promise<number> {
  const payload = new Uint8Array(bytes)
  for (let offset = 0; offset < payload.length; offset += 65_536) {
    crypto.getRandomValues(payload.subarray(offset, Math.min(offset + 65_536, payload.length)))
  }
  const started = performance.now()
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    let uploadCompletedAt: number | null = null
    request.open('POST', uploadUrl(bytes))
    request.timeout = 90000
    request.responseType = 'json'
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    request.upload.onload = () => {
      uploadCompletedAt = performance.now()
    }
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
      const result = request.response as { ok?: boolean; receivedBytes?: number; elapsedMs?: number; mbps?: number } | null
      if (!result || result.ok !== true || result.receivedBytes !== bytes ||
          typeof result.elapsedMs !== 'number' || !Number.isFinite(result.elapsedMs) || result.elapsedMs <= 0 ||
          uploadCompletedAt === null || uploadCompletedAt <= started) {
        reject(new Error('Upload endpoint did not confirm the complete payload transfer'))
        return
      }
      // Use the browser's upload-complete event for throughput. Worker read time
      // is useful for diagnostics but can exclude bytes buffered before the Worker reads.
      const elapsedSeconds = Math.max((uploadCompletedAt - started) / 1000, 0.001)
      resolve((bytes * 8) / elapsedSeconds / 1_000_000)
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


type DnsAnswer = { name: string; type: number; TTL: number; data: string }
function NetworkStarterTools() {
  const [ip, setIp] = useState('')
  const [ipStatus, setIpStatus] = useState('Not checked yet')
  const [ipLoading, setIpLoading] = useState(false)
  const [hostname, setHostname] = useState('')
  const [recordType, setRecordType] = useState('A')
  const [dnsAnswers, setDnsAnswers] = useState<DnsAnswer[]>([])
  const [dnsStatus, setDnsStatus] = useState('')
  const [dnsLoading, setDnsLoading] = useState(false)
  const [symptom, setSymptom] = useState('slow')
  const [room, setRoom] = useState('far')
  const [wifiAdvice, setWifiAdvice] = useState(false)

  async function checkPublicIp() {
    setIpLoading(true); setIpStatus('Checking this connection…')
    try {
      const response = await fetch('/api/v1/network/public-ip', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (!response.ok) throw new Error('The IP check is temporarily unavailable.')
      const data = await response.json() as { ok?: boolean; ip?: string }
      if (!data.ok || !data.ip) throw new Error('The network edge did not return an IP address.')
      setIp(data.ip); setIpStatus('Detected by the TEZZ network edge')
    } catch (error) {
      setIpStatus(error instanceof Error ? error.message : 'Could not check this connection.')
    } finally { setIpLoading(false) }
  }

  async function lookupDns(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanHost = hostname.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
    if (!/^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(cleanHost)) {
      setDnsAnswers([]); setDnsStatus('Enter a valid domain name, such as example.com. Do not include a page path.'); return
    }
    setDnsLoading(true); setDnsAnswers([]); setDnsStatus('Querying Cloudflare DNS over HTTPS…')
    try {
      const query = new URL('https://cloudflare-dns.com/dns-query')
      query.searchParams.set('name', cleanHost); query.searchParams.set('type', recordType)
      const response = await fetch(query.toString(), { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(10000), cache: 'no-store' })
      if (!response.ok) throw new Error('DNS resolver request failed. Try again shortly.')
      const data = await response.json() as { Status?: number; Answer?: DnsAnswer[] }
      if (data.Status === 3) { setDnsStatus('NXDOMAIN: the DNS resolver reports that this domain name does not exist.'); return }
      const recordCodes: Record<string, number> = { A: 1, AAAA: 28, MX: 15, TXT: 16, CNAME: 5 }
      const answers = (data.Answer ?? []).filter(item => item.type === recordCodes[recordType])
      setDnsAnswers(answers)
      setDnsStatus(answers.length ? answers.length + ' ' + recordType + ' record(s) returned by the resolver.' : 'No records of this type were returned. The domain may use another record type or have no published answer.')
    } catch (error) { setDnsStatus(error instanceof Error ? error.message : 'DNS lookup could not be completed.') }
    finally { setDnsLoading(false) }
  }

  const advice: Record<string, Record<string, string>> = {
    slow: {
      near: 'If the device is close to the router and still slow, compare a wired connection with Wi-Fi. Pause large downloads, restart the router once, then run TEZZ speed and latency tests again. If both wired and wireless are slow, ask your ISP to check the line.',
      far: 'Distance and walls may be weakening the Wi-Fi link. Move the router into an open, central position, raise it off the floor and test from the same room. Consider an access point or mesh node only if the weak area remains.'
    },
    drops: {
      near: 'Intermittent drops close to the router can point to router instability, interference or an ISP issue. Check whether every device disconnects at the same time, update router firmware using the manufacturer instructions, and record the times of disconnections.',
      far: 'If drops happen mainly in distant rooms, treat coverage as the first suspect. Test in the router room, then in the affected room. If only the distant room fails, improve placement or add a properly connected access point.'
    },
    video: {
      near: 'Video calls need stable upload as well as download. Pause cloud backups and uploads, check upload speed, and use Ethernet if possible. If calls fail across several devices, ask the ISP to investigate upstream quality.',
      far: 'A weak Wi-Fi link can cause call freezes even when the broadband plan is fast. Move closer to the router, reduce obstacles and pause other household traffic. Compare call quality beside the router and in the usual room.'
    },
    gaming: {
      near: 'For gaming, prioritise stable latency over headline download speed. Use Ethernet where possible, stop background downloads and check whether latency rises when someone else uploads. A router with effective SQM/QoS may help bufferbloat, but verify the cause first.',
      far: 'Wireless interference and weak signal can create inconsistent game response. Test near the router, use the 5 GHz or 6 GHz band when signal is strong, and prefer Ethernet for competitive play.'
    }
  }
  return <div className="starter-tools-stack">
    <div className="starter-tools-heading"><span className="section-kicker">NEW · FREE NETWORK UTILITIES</span><h3>Three practical tools to get more from your connection.</h3><p>These checks run on demand. No account is required, and DNS queries are sent to Cloudflare's public DNS resolver.</p></div>
    <div className="starter-tool-grid">
      <article className="starter-tool-card">
        <div className="starter-tool-icon"><Globe2 size={20}/></div><span className="section-kicker">TOOL 01</span><h3>My public IP address</h3>
        <p>See the public IP address that your request presents to the TEZZ network edge. This is not your device's private Wi-Fi address.</p>
        <div className="starter-result-value" aria-live="polite">{ip || 'Not checked'}</div><div className="starter-result-caption">{ipStatus}</div>
        <button className="doctor-run-test" onClick={checkPublicIp} disabled={ipLoading}>{ipLoading ? 'Checking…' : ip ? 'Check again' : 'Detect my IP'} <span aria-hidden="true">→</span></button>
        <small className="starter-privacy-note">Privacy: the edge already receives your IP to deliver this page. This endpoint returns it to your browser only; TEZZ does not save it in a database.</small>
      </article>
      <article className="starter-tool-card">
        <div className="starter-tool-icon"><Search size={20}/></div><span className="section-kicker">TOOL 02</span><h3>DNS lookup</h3>
        <p>Look up common DNS records to understand how a domain points to services on the internet.</p>
        <form className="starter-dns-form" onSubmit={lookupDns}>
          <label htmlFor="tezz-dns-domain">Domain name</label><input id="tezz-dns-domain" value={hostname} onChange={event=>setHostname(event.target.value)} placeholder="example.com" autoComplete="url"/>
          <label htmlFor="tezz-dns-type">Record type</label><select id="tezz-dns-type" value={recordType} onChange={event=>setRecordType(event.target.value)}><option value="A">A · IPv4 address</option><option value="AAAA">AAAA · IPv6 address</option><option value="MX">MX · Mail server</option><option value="TXT">TXT · Text record</option><option value="CNAME">CNAME · Alias</option></select>
          <button className="doctor-run-test" type="submit" disabled={dnsLoading}>{dnsLoading ? 'Looking up…' : 'Look up DNS'} <span aria-hidden="true">→</span></button>
        </form>
        <div className="starter-dns-output" aria-live="polite"><p>{dnsStatus || 'Enter a domain and choose a record type.'}</p>{dnsAnswers.map((answer,index)=><div className="starter-dns-answer" key={answer.name+answer.data+index}><strong>{answer.data}</strong><span>TTL {answer.TTL}s</span></div>)}</div>
        <small className="starter-privacy-note">DNS query is sent to Cloudflare DNS over HTTPS. TXT records can contain verification data; avoid looking up domains you do not administer.</small>
      </article>
      <article className="starter-tool-card">
        <div className="starter-tool-icon"><Wifi size={20}/></div><span className="section-kicker">TOOL 03</span><h3>Wi-Fi problem solver</h3>
        <p>Choose what is going wrong and where it happens. Get a practical first troubleshooting sequence.</p>
        <label htmlFor="tezz-wifi-symptom">What is the problem?</label>
        <select id="tezz-wifi-symptom" value={symptom} onChange={event=>{setSymptom(event.target.value);setWifiAdvice(false)}}><option value="slow">Wi-Fi feels slow</option><option value="drops">Connection keeps dropping</option><option value="video">Video calls freeze</option><option value="gaming">Online games lag</option></select>
        <label htmlFor="tezz-wifi-room">Where does it happen?</label>
        <select id="tezz-wifi-room" value={room} onChange={event=>{setRoom(event.target.value);setWifiAdvice(false)}}><option value="far">Mostly far from the router</option><option value="near">Even beside the router</option></select>
        <button className="doctor-run-test" onClick={()=>setWifiAdvice(true)}>Show my next steps <span aria-hidden="true">→</span></button>
        {wifiAdvice && <div className="starter-wifi-advice" aria-live="polite"><strong>Your first troubleshooting steps</strong><p>{advice[symptom][room]}</p><a href="/guides/improve-wifi-speed/">Read the Wi-Fi improvement guide →</a></div>}
        <small className="starter-privacy-note">This is a guided checklist, not a direct measurement of radio signal strength. Browsers do not expose reliable Wi-Fi signal or router diagnostics to ordinary websites.</small>
      </article>
    </div>
  </div>
}

type UiLanguage = 'en' | 'hi' | 'mr' | 'bn' | 'zh-CN' | 'pt-BR' | 'es' | 'fr' | 'ar'
const UI_LANGUAGES = [{"code":"en","native":"English"},{"code":"hi","native":"हिन्दी"},{"code":"mr","native":"मराठी"},{"code":"bn","native":"বাংলা"},{"code":"zh-CN","native":"简体中文"},{"code":"pt-BR","native":"Português (Brasil)"},{"code":"es","native":"Español"},{"code":"fr","native":"Français"},{"code":"ar","native":"العربية"}]
const SPEED_COPY: Record<string, Record<string, string>> = {"en":{},"hi":{"INTERNET SPEED TEST":"इंटरनेट स्पीड टेस्ट","Free Internet ":"मुफ़्त इंटरनेट ","Speed Test":"स्पीड टेस्ट","Check download, upload, HTTP latency and response variation in seconds.":"डाउनलोड, अपलोड, HTTP लेटेंसी और प्रतिक्रिया में बदलाव कुछ ही सेकंड में जाँचें।","Sustained streaming download · client-timed, server-confirmed upload":"लगातार डाउनलोड मापन · ब्राउज़र से समय मापा गया, सर्वर से पुष्टि किया गया अपलोड","HTTP latency, response variation & stability":"HTTP लेटेंसी, प्रतिक्रिया में बदलाव और स्थिरता","Gaming & streaming readiness":"गेमिंग और स्ट्रीमिंग की तैयारी","Free, instant results":"मुफ़्त और तुरंत परिणाम","UPLOAD":"अपलोड","DOWNLOAD":"डाउनलोड","DOWNLOAD SPEED":"डाउनलोड गति","TESTING":"जाँच जारी","MEASURED":"मापा गया","READY":"तैयार","Live measurement in progress":"लाइव मापन जारी है","Latest download measurement":"नवीनतम डाउनलोड मापन","Your connection speed, measured live":"आपके कनेक्शन की गति का लाइव मापन","TEST IN PROGRESS":"टेस्ट जारी है","START SPEED TEST":"स्पीड टेस्ट शुरू करें","Internet Connection Health Check":"इंटरनेट कनेक्शन की स्थिति जाँचें","Download":"डाउनलोड","Upload":"अपलोड","HTTP latency":"HTTP लेटेंसी","HTTP variation":"HTTP प्रतिक्रिया में बदलाव","HELP BUILD A BETTER INTERNET PICTURE":"बेहतर इंटरनेट तस्वीर बनाने में मदद करें","Contribute to global benchmarks":"वैश्विक बेंचमार्क में योगदान दें","Optional. When enabled, a completed speed test shares only download, upload, browser HTTP latency, response variation, and coarse country/region with TEZZ CONNECT. We store hourly regional aggregates—not individual test records, IP addresses, device IDs, or precise location. Public comparisons appear only after at least 30 contributions in a region. HTTP latency is measured to the TEZZ CONNECT edge, not your ISP's full network.":"यह वैकल्पिक है। सक्षम करने पर पूरा हुआ स्पीड टेस्ट केवल डाउनलोड, अपलोड, ब्राउज़र HTTP लेटेंसी, प्रतिक्रिया में बदलाव और मोटे देश/क्षेत्र का डेटा TEZZ CONNECT के साथ साझा करता है। हम व्यक्तिगत टेस्ट रिकॉर्ड, IP पते, डिवाइस ID या सटीक स्थान के बजाय प्रति घंटे क्षेत्रीय समेकित आँकड़े रखते हैं। किसी क्षेत्र में कम-से-कम 30 योगदान मिलने पर ही सार्वजनिक तुलना दिखाई जाती है। HTTP लेटेंसी TEZZ CONNECT एज तक मापी जाती है, आपके ISP के पूरे नेटवर्क तक नहीं।","Yes, I agree to share anonymous aggregate measurements from my completed speed tests.":"हाँ, मैं अपने पूरे हुए स्पीड टेस्ट के गुमनाम समेकित माप साझा करने के लिए सहमत हूँ।","Opt-in is enabled.":"साझा करने की अनुमति चालू है।","Benchmark sharing is off by default.":"बेंचमार्क साझा करना डिफ़ॉल्ट रूप से बंद है।","Find and fix internet problems":"इंटरनेट की समस्याएँ पहचानें और ठीक करें","Latency Test":"लेटेंसी टेस्ट","Check browser response time":"ब्राउज़र प्रतिक्रिया समय जाँचें","Wi-Fi Test":"वाई-फ़ाई टेस्ट","Test your Wi-Fi performance":"अपने वाई-फ़ाई का प्रदर्शन जाँचें","More Tools":"और टूल","Explore all network tools":"सभी नेटवर्क टूल देखें","TEZZ INTERNET DOCTOR":"TEZZ इंटरनेट डॉक्टर","Find out what is slowing you down.":"जानें कि आपका इंटरनेट धीमा क्यों है।","Use your latest speed test and browser network signals to identify likely connection issues.":"संभावित कनेक्शन समस्याओं की पहचान के लिए अपने नवीनतम स्पीड टेस्ट और ब्राउज़र नेटवर्क संकेतों का उपयोग करें।","DIAGNOSTIC STATUS":"जाँच की स्थिति","Awaiting test":"टेस्ट का इंतज़ार है","Run the speed test first. The Doctor will use those measurements to tailor its recommendations.":"पहले स्पीड टेस्ट चलाएँ। डॉक्टर उन्हीं मापों के आधार पर सुझाव देगा।","Test running…":"टेस्ट चल रहा है…","Run speed test":"स्पीड टेस्ट चलाएँ","PERSONALISED TROUBLESHOOTING":"आपकी समस्या के अनुसार समाधान","Recommended next steps":"अगले सुझाए गए कदम","Run new test":"नया टेस्ट चलाएँ","Priority":"प्राथमिकता","Suggested":"सुझाव","Next step":"अगला कदम","Latency and response variation here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.":"यहाँ लेटेंसी और प्रतिक्रिया में बदलाव ब्राउज़र के HTTP माप हैं, ICMP ping नहीं। ये शुरुआती संकेत हैं, लाइन की खराबी का अंतिम निदान नहीं। Wi-Fi सिग्नल, डिवाइस के लोड, सर्वर की दूरी और ISP रूटिंग से परिणाम बदल सकते हैं।","TEZZ NETWORK INTELLIGENCE":"TEZZ नेटवर्क जानकारी","Understand your connection.":"अपने कनेक्शन को समझें।","Run independent response-time checks and review the network information your browser makes available.":"स्वतंत्र प्रतिक्रिया-समय जाँचें और ब्राउज़र द्वारा उपलब्ध कराई गई नेटवर्क जानकारी देखें।","INTERNET REACHABILITY":"इंटरनेट उपलब्धता","Browser reports online":"ब्राउज़र के अनुसार ऑनलाइन","Browser reports offline":"ब्राउज़र के अनुसार ऑफलाइन","Your device reports an active network connection. This does not guarantee that every website is reachable.":"आपका डिवाइस सक्रिय नेटवर्क कनेक्शन दिखा रहा है। इसका मतलब यह नहीं कि हर वेबसाइट खुल पाएगी।","Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.":"आपका डिवाइस सक्रिय नेटवर्क कनेक्शन नहीं दिखा रहा। Wi-Fi या मोबाइल डेटा जाँचें और फिर से कनेक्ट करें।","Effective connection type":"प्रभावी कनेक्शन प्रकार","Estimated downlink":"अनुमानित डाउनलोड गति","Browser-reported RTT":"ब्राउज़र द्वारा बताई गई RTT","Data saver preference":"डेटा सेवर सेटिंग","Enabled":"चालू","Not requested":"अनुरोध नहीं किया गया","Not available":"उपलब्ध नहीं","INDEPENDENT NETWORK TEST":"स्वतंत्र नेटवर्क टेस्ट","HTTP Latency & Response Variation Test":"HTTP लेटेंसी और प्रतिक्रिया बदलाव टेस्ट","12 small HTTP requests to the TEZZ network edge. No large download or upload.":"TEZZ नेटवर्क एज को 12 छोटे HTTP अनुरोध। कोई बड़ा डाउनलोड या अपलोड नहीं।","AVERAGE HTTP RESPONSE TIME":"औसत HTTP प्रतिक्रिया समय","Minimum":"न्यूनतम","Maximum":"अधिकतम","HTTP response variation":"HTTP प्रतिक्रिया बदलाव","Failed requests":"असफल अनुरोध","RESPONSE CONSISTENCY":"प्रतिक्रिया स्थिरता","Consistent response times":"स्थिर प्रतिक्रिया समय","Some response-time variation":"प्रतिक्रिया समय में कुछ बदलाव","Highly variable response times":"प्रतिक्रिया समय में बहुत बदलाव","Start latency test":"लेटेंसी टेस्ट शुरू करें","Run again":"फिर से चलाएँ","Testing connection…":"कनेक्शन जाँचा जा रहा है…","LIVE CONNECTION MONITOR":"लाइव कनेक्शन मॉनिटर","Connection Stability Monitor":"कनेक्शन स्थिरता मॉनिटर","Successful samples":"सफल नमूने","Average response":"औसत प्रतिक्रिया","Highest response":"सबसे अधिक प्रतिक्रिया","95th percentile":"95वाँ पर्सेंटाइल","Start 30-second monitor":"30 सेकंड मॉनिटर शुरू करें","Run monitor again":"मॉनिटर फिर चलाएँ","TEZZ CONNECTION HEALTH INDEX":"TEZZ कनेक्शन हेल्थ इंडेक्स","Wi-Fi signal strength":"Wi-Fi सिग्नल की ताकत","Router / gateway details":"राउटर / गेटवे विवरण","Not exposed by standard browser APIs":"मानक ब्राउज़र API यह जानकारी नहीं देते","Not exposed to this webpage":"इस वेबपेज को उपलब्ध नहीं"},"mr":{"INTERNET SPEED TEST":"इंटरनेट स्पीड टेस्ट","Free Internet ":"मोफत इंटरनेट ","Speed Test":"स्पीड टेस्ट","Check download, upload, HTTP latency and response variation in seconds.":"डाउनलोड, अपलोड, HTTP लेटन्सी आणि प्रतिसादातील बदल काही सेकंदांत तपासा.","Sustained streaming download · client-timed, server-confirmed upload":"सतत डाउनलोड मापन · ब्राउझरने वेळ मोजलेला, सर्व्हरने पुष्टी केलेला अपलोड","HTTP latency, response variation & stability":"HTTP लेटन्सी, प्रतिसादातील बदल आणि स्थिरता","Gaming & streaming readiness":"गेमिंग आणि स्ट्रीमिंगची तयारी","Free, instant results":"मोफत आणि त्वरित निकाल","UPLOAD":"अपलोड","DOWNLOAD":"डाउनलोड","DOWNLOAD SPEED":"डाउनलोड वेग","TESTING":"चाचणी सुरू","MEASURED":"मोजले","READY":"तयार","Live measurement in progress":"थेट मापन सुरू आहे","Latest download measurement":"नवीनतम डाउनलोड मापन","Your connection speed, measured live":"तुमच्या कनेक्शनचा वेग थेट मोजला जात आहे","TEST IN PROGRESS":"चाचणी सुरू आहे","START SPEED TEST":"स्पीड टेस्ट सुरू करा","Internet Connection Health Check":"इंटरनेट कनेक्शनची स्थिती तपासा","Download":"डाउनलोड","Upload":"अपलोड","HTTP latency":"HTTP लेटन्सी","HTTP variation":"HTTP प्रतिसादातील बदल","HELP BUILD A BETTER INTERNET PICTURE":"इंटरनेटचे अधिक चांगले चित्र तयार करण्यात मदत करा","Contribute to global benchmarks":"जागतिक बेंचमार्कमध्ये योगदान द्या","Optional. When enabled, a completed speed test shares only download, upload, browser HTTP latency, response variation, and coarse country/region with TEZZ CONNECT. We store hourly regional aggregates—not individual test records, IP addresses, device IDs, or precise location. Public comparisons appear only after at least 30 contributions in a region. HTTP latency is measured to the TEZZ CONNECT edge, not your ISP's full network.":"हे ऐच्छिक आहे. सुरू केल्यास पूर्ण झालेल्या स्पीड टेस्टमधील डाउनलोड, अपलोड, ब्राउझर HTTP लेटन्सी, प्रतिसादातील बदल आणि साधारण देश/प्रदेशाची माहितीच TEZZ CONNECT सोबत शेअर केली जाते. आम्ही वैयक्तिक टेस्ट रेकॉर्ड, IP पत्ते, डिव्हाइस ID किंवा अचूक स्थान साठवत नाही; फक्त तासानुसार एकत्रित प्रादेशिक आकडे ठेवतो. एखाद्या प्रदेशात किमान ३० योगदान मिळाल्यावरच सार्वजनिक तुलना दाखवली जाते. HTTP लेटन्सी TEZZ CONNECT एजपर्यंत मोजली जाते, तुमच्या ISP च्या संपूर्ण नेटवर्कपर्यंत नाही.","Yes, I agree to share anonymous aggregate measurements from my completed speed tests.":"माझ्या पूर्ण झालेल्या स्पीड टेस्टमधील अनामिक एकत्रित मोजमाप शेअर करण्यास मी सहमत आहे.","Opt-in is enabled.":"शेअर करण्याची संमती सुरू आहे.","Benchmark sharing is off by default.":"बेंचमार्क शेअरिंग डीफॉल्टने बंद आहे.","Find and fix internet problems":"इंटरनेट समस्या शोधा आणि सोडवा","Latency Test":"लेटन्सी चाचणी","Check browser response time":"ब्राउझर प्रतिसाद वेळ तपासा","Wi-Fi Test":"वाय-फाय चाचणी","Test your Wi-Fi performance":"तुमच्या वाय-फायची कार्यक्षमता तपासा","More Tools":"अधिक साधने","Explore all network tools":"सर्व नेटवर्क साधने पाहा","TEZZ INTERNET DOCTOR":"TEZZ इंटरनेट डॉक्टर","Find out what is slowing you down.":"तुमचे इंटरनेट कशामुळे मंदावते ते जाणून घ्या.","Use your latest speed test and browser network signals to identify likely connection issues.":"संभाव्य कनेक्शन समस्या ओळखण्यासाठी तुमची नवीनतम स्पीड टेस्ट आणि ब्राउझर नेटवर्क संकेत वापरा.","DIAGNOSTIC STATUS":"निदान स्थिती","Awaiting test":"चाचणीची प्रतीक्षा","Run the speed test first. The Doctor will use those measurements to tailor its recommendations.":"प्रथम स्पीड टेस्ट चालवा. त्या मोजमापांवरून डॉक्टर शिफारसी देईल.","Test running…":"चाचणी सुरू आहे…","Run speed test":"स्पीड टेस्ट चालवा","PERSONALISED TROUBLESHOOTING":"तुमच्या समस्येनुसार उपाय","Recommended next steps":"पुढील शिफारस केलेली पावले","Run new test":"नवीन चाचणी चालवा","Priority":"प्राधान्य","Suggested":"सूचना","Next step":"पुढील पाऊल","Latency and response variation here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.":"येथील लेटन्सी आणि प्रतिसादातील बदल हे ब्राउझरमधील HTTP मोजमाप आहेत; ICMP ping नाहीत. हे प्राथमिक संकेत आहेत, लाईनमधील बिघाडाचे अंतिम निदान नाही. Wi-Fi सिग्नल, डिव्हाइसवरील भार, सर्व्हरचे अंतर आणि ISP रूटिंगमुळे निकाल बदलू शकतात.","TEZZ NETWORK INTELLIGENCE":"TEZZ नेटवर्क माहिती","Understand your connection.":"तुमचे कनेक्शन समजून घ्या.","Run independent response-time checks and review the network information your browser makes available.":"स्वतंत्र प्रतिसाद-वेळ चाचण्या करा आणि ब्राउझरने उपलब्ध केलेली नेटवर्क माहिती पाहा.","INTERNET REACHABILITY":"इंटरनेट उपलब्धता","Browser reports online":"ब्राउझरनुसार ऑनलाइन","Browser reports offline":"ब्राउझरनुसार ऑफलाइन","Your device reports an active network connection. This does not guarantee that every website is reachable.":"तुमचे डिव्हाइस सक्रिय नेटवर्क कनेक्शन दाखवत आहे. याचा अर्थ प्रत्येक वेबसाइट उपलब्ध असेलच असे नाही.","Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.":"तुमचे डिव्हाइस सक्रिय नेटवर्क कनेक्शन दाखवत नाही. Wi-Fi किंवा मोबाइल डेटा तपासा आणि पुन्हा कनेक्ट करा.","Effective connection type":"प्रभावी कनेक्शन प्रकार","Estimated downlink":"अंदाजित डाउनलोड वेग","Browser-reported RTT":"ब्राउझरने नोंदवलेली RTT","Data saver preference":"डेटा सेव्हर प्राधान्य","Enabled":"सुरू","Not requested":"विनंती केलेली नाही","Not available":"उपलब्ध नाही","INDEPENDENT NETWORK TEST":"स्वतंत्र नेटवर्क चाचणी","HTTP Latency & Response Variation Test":"HTTP लेटन्सी आणि प्रतिसाद बदल चाचणी","12 small HTTP requests to the TEZZ network edge. No large download or upload.":"TEZZ नेटवर्क एजला 12 लहान HTTP विनंत्या. मोठे डाउनलोड किंवा अपलोड नाही.","AVERAGE HTTP RESPONSE TIME":"सरासरी HTTP प्रतिसाद वेळ","Minimum":"किमान","Maximum":"कमाल","HTTP response variation":"HTTP प्रतिसादातील बदल","Failed requests":"अयशस्वी विनंत्या","RESPONSE CONSISTENCY":"प्रतिसादातील सातत्य","Consistent response times":"सातत्यपूर्ण प्रतिसाद वेळ","Some response-time variation":"प्रतिसाद वेळेत काही बदल","Highly variable response times":"प्रतिसाद वेळेत मोठे बदल","Start latency test":"लेटन्सी चाचणी सुरू करा","Run again":"पुन्हा चालवा","Testing connection…":"कनेक्शन तपासत आहे…","LIVE CONNECTION MONITOR":"थेट कनेक्शन मॉनिटर","Connection Stability Monitor":"कनेक्शन स्थिरता मॉनिटर","Successful samples":"यशस्वी नमुने","Average response":"सरासरी प्रतिसाद","Highest response":"सर्वाधिक प्रतिसाद","95th percentile":"95वा पर्सेंटाइल","Start 30-second monitor":"30 सेकंद मॉनिटर सुरू करा","Run monitor again":"मॉनिटर पुन्हा चालवा","TEZZ CONNECTION HEALTH INDEX":"TEZZ कनेक्शन हेल्थ इंडेक्स","Wi-Fi signal strength":"Wi-Fi सिग्नलची ताकद","Router / gateway details":"राउटर / गेटवे तपशील","Not exposed by standard browser APIs":"मानक ब्राउझर API ही माहिती देत नाहीत","Not exposed to this webpage":"या वेबपेजला उपलब्ध नाही"},"bn":{"INTERNET SPEED TEST":"ইন্টারনেট স্পিড টেস্ট","Free Internet ":"বিনামূল্যে ইন্টারনেট ","Speed Test":"স্পিড টেস্ট","Check download, upload, HTTP latency and response variation in seconds.":"কয়েক সেকেন্ডে ডাউনলোড, আপলোড, HTTP ল্যাটেন্সি এবং প্রতিক্রিয়ার পরিবর্তন পরীক্ষা করুন।","Sustained streaming download · client-timed, server-confirmed upload":"ধারাবাহিক ডাউনলোড মাপ · ব্রাউজারে সময় গণনা, সার্ভারে নিশ্চিত আপলোড","HTTP latency, response variation & stability":"HTTP ল্যাটেন্সি, প্রতিক্রিয়ার পরিবর্তন ও স্থিতিশীলতা","Gaming & streaming readiness":"গেমিং ও স্ট্রিমিং প্রস্তুতি","Free, instant results":"বিনামূল্যে তাৎক্ষণিক ফলাফল","UPLOAD":"আপলোড","DOWNLOAD":"ডাউনলোড","DOWNLOAD SPEED":"ডাউনলোড গতি","TESTING":"পরীক্ষা চলছে","MEASURED":"পরিমাপ করা হয়েছে","READY":"প্রস্তুত","Live measurement in progress":"লাইভ পরিমাপ চলছে","Latest download measurement":"সর্বশেষ ডাউনলোড পরিমাপ","Your connection speed, measured live":"আপনার সংযোগের গতি সরাসরি মাপা হচ্ছে","TEST IN PROGRESS":"পরীক্ষা চলছে","START SPEED TEST":"স্পিড টেস্ট শুরু করুন","Internet Connection Health Check":"ইন্টারনেট সংযোগের স্বাস্থ্য পরীক্ষা","Download":"ডাউনলোড","Upload":"আপলোড","HTTP latency":"HTTP ল্যাটেন্সি","HTTP variation":"HTTP প্রতিক্রিয়ার পরিবর্তন","HELP BUILD A BETTER INTERNET PICTURE":"আরও ভালো ইন্টারনেট চিত্র গড়তে সাহায্য করুন","Contribute to global benchmarks":"বিশ্বব্যাপী বেঞ্চমার্কে অবদান রাখুন","Optional. When enabled, a completed speed test shares only download, upload, browser HTTP latency, response variation, and coarse country/region with TEZZ CONNECT. We store hourly regional aggregates—not individual test records, IP addresses, device IDs, or precise location. Public comparisons appear only after at least 30 contributions in a region. HTTP latency is measured to the TEZZ CONNECT edge, not your ISP's full network.":"এটি ঐচ্ছিক। চালু করলে সম্পন্ন স্পিড টেস্ট থেকে শুধু ডাউনলোড, আপলোড, ব্রাউজার HTTP ল্যাটেন্সি, প্রতিক্রিয়ার পরিবর্তন এবং আনুমানিক দেশ/অঞ্চলের তথ্য TEZZ CONNECT-এর সঙ্গে ভাগ করা হয়। আমরা ব্যক্তিগত টেস্ট রেকর্ড, IP ঠিকানা, ডিভাইস ID বা সঠিক অবস্থান সংরক্ষণ করি না; ঘণ্টাভিত্তিক আঞ্চলিক সমষ্টিগত তথ্য রাখি। কোনো অঞ্চলে অন্তত ৩০টি অবদান না হলে প্রকাশ্য তুলনা দেখানো হয় না। HTTP ল্যাটেন্সি TEZZ CONNECT edge পর্যন্ত মাপা হয়, আপনার ISP-এর সম্পূর্ণ নেটওয়ার্ক পর্যন্ত নয়।","Yes, I agree to share anonymous aggregate measurements from my completed speed tests.":"আমার সম্পন্ন স্পিড টেস্টের বেনামী সমষ্টিগত পরিমাপ ভাগ করতে আমি সম্মত।","Opt-in is enabled.":"শেয়ার করার সম্মতি চালু আছে।","Benchmark sharing is off by default.":"বেঞ্চমার্ক শেয়ারিং ডিফল্টভাবে বন্ধ।","Find and fix internet problems":"ইন্টারনেটের সমস্যা খুঁজুন ও সমাধান করুন","Latency Test":"ল্যাটেন্সি পরীক্ষা","Check browser response time":"ব্রাউজারের প্রতিক্রিয়ার সময় পরীক্ষা করুন","Wi-Fi Test":"ওয়াই-ফাই পরীক্ষা","Test your Wi-Fi performance":"আপনার ওয়াই-ফাই কর্মক্ষমতা পরীক্ষা করুন","More Tools":"আরও টুল","Explore all network tools":"সব নেটওয়ার্ক টুল দেখুন","TEZZ INTERNET DOCTOR":"TEZZ ইন্টারনেট ডাক্তার","Find out what is slowing you down.":"আপনার ইন্টারনেটের গতি কমার কারণ খুঁজে বের করুন।","Use your latest speed test and browser network signals to identify likely connection issues.":"সম্ভাব্য সংযোগ সমস্যা শনাক্ত করতে আপনার সর্বশেষ স্পিড টেস্ট ও ব্রাউজারের নেটওয়ার্ক সংকেত ব্যবহার করুন।","DIAGNOSTIC STATUS":"ডায়াগনস্টিক অবস্থা","Awaiting test":"পরীক্ষার অপেক্ষায়","Run the speed test first. The Doctor will use those measurements to tailor its recommendations.":"প্রথমে স্পিড টেস্ট চালান। সেই পরিমাপের ভিত্তিতে ডক্টর পরামর্শ দেবে।","Test running…":"পরীক্ষা চলছে…","Run speed test":"স্পিড টেস্ট চালান","PERSONALISED TROUBLESHOOTING":"আপনার সমস্যার উপযোগী সমাধান","Recommended next steps":"প্রস্তাবিত পরবর্তী পদক্ষেপ","Run new test":"নতুন পরীক্ষা চালান","Priority":"অগ্রাধিকার","Suggested":"প্রস্তাবিত","Next step":"পরবর্তী পদক্ষেপ","Latency and response variation here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.":"এখানে ল্যাটেন্সি ও প্রতিক্রিয়ার পরিবর্তন ব্রাউজারের HTTP পরিমাপ, ICMP পিং নয়। এগুলি প্রাথমিক ইঙ্গিত, লাইনের ত্রুটির চূড়ান্ত নির্ণয় নয়। Wi-Fi সিগন্যাল, ডিভাইসের চাপ, সার্ভারের দূরত্ব ও ISP রাউটিংয়ের কারণে ফল বদলাতে পারে।","TEZZ NETWORK INTELLIGENCE":"TEZZ নেটওয়ার্ক তথ্য","Understand your connection.":"আপনার সংযোগ বুঝুন।","Run independent response-time checks and review the network information your browser makes available.":"স্বাধীন প্রতিক্রিয়ার সময় পরীক্ষা করুন এবং ব্রাউজার যে নেটওয়ার্ক তথ্য দেয় তা দেখুন।","INTERNET REACHABILITY":"ইন্টারনেট সংযোগযোগ্যতা","Browser reports online":"ব্রাউজার অনুযায়ী অনলাইন","Browser reports offline":"ব্রাউজার অনুযায়ী অফলাইন","Your device reports an active network connection. This does not guarantee that every website is reachable.":"আপনার ডিভাইস সক্রিয় নেটওয়ার্ক সংযোগ দেখাচ্ছে। এর অর্থ এই নয় যে প্রতিটি ওয়েবসাইটে পৌঁছানো যাবে।","Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.":"আপনার ডিভাইস সক্রিয় নেটওয়ার্ক সংযোগ দেখাচ্ছে না। Wi-Fi বা মোবাইল ডেটা পরীক্ষা করে আবার সংযোগ করুন।","Effective connection type":"কার্যকর সংযোগের ধরন","Estimated downlink":"আনুমানিক ডাউনলিংক","Browser-reported RTT":"ব্রাউজার-প্রদত্ত RTT","Data saver preference":"ডেটা সেভার পছন্দ","Enabled":"সক্রিয়","Not requested":"অনুরোধ করা হয়নি","Not available":"পাওয়া যায়নি","INDEPENDENT NETWORK TEST":"স্বাধীন নেটওয়ার্ক পরীক্ষা","HTTP Latency & Response Variation Test":"HTTP ল্যাটেন্সি ও প্রতিক্রিয়া পরিবর্তন পরীক্ষা","12 small HTTP requests to the TEZZ network edge. No large download or upload.":"TEZZ নেটওয়ার্ক এজে ১২টি ছোট HTTP অনুরোধ। বড় ডাউনলোড বা আপলোড নয়।","AVERAGE HTTP RESPONSE TIME":"গড় HTTP প্রতিক্রিয়া সময়","Minimum":"সর্বনিম্ন","Maximum":"সর্বোচ্চ","HTTP response variation":"HTTP প্রতিক্রিয়ার পরিবর্তন","Failed requests":"ব্যর্থ অনুরোধ","RESPONSE CONSISTENCY":"প্রতিক্রিয়ার ধারাবাহিকতা","Consistent response times":"স্থিতিশীল প্রতিক্রিয়ার সময়","Some response-time variation":"প্রতিক্রিয়ার সময়ে কিছু পরিবর্তন","Highly variable response times":"প্রতিক্রিয়ার সময়ে বড় পরিবর্তন","Start latency test":"ল্যাটেন্সি পরীক্ষা শুরু করুন","Run again":"আবার চালান","Testing connection…":"সংযোগ পরীক্ষা চলছে…","LIVE CONNECTION MONITOR":"লাইভ সংযোগ মনিটর","Connection Stability Monitor":"সংযোগ স্থিতিশীলতা মনিটর","Successful samples":"সফল নমুনা","Average response":"গড় প্রতিক্রিয়া","Highest response":"সর্বোচ্চ প্রতিক্রিয়া","95th percentile":"৯৫তম পার্সেন্টাইল","Start 30-second monitor":"৩০ সেকেন্ডের মনিটর শুরু করুন","Run monitor again":"মনিটর আবার চালান","TEZZ CONNECTION HEALTH INDEX":"TEZZ সংযোগ স্বাস্থ্য সূচক","Wi-Fi signal strength":"Wi-Fi সিগন্যালের শক্তি","Router / gateway details":"রাউটার / গেটওয়ে বিবরণ","Not exposed by standard browser APIs":"সাধারণ ব্রাউজার API এই তথ্য দেয় না","Not exposed to this webpage":"এই ওয়েবপেজে প্রকাশ করা হয় না"},"zh-CN":{},"pt-BR":{},"es":{},"fr":{},"ar":{}}
;

const EXTRA_SPEED_COPY: Record<string, Record<string, string>> = {"hi":{"TEZZ GLOBAL NETWORK INTELLIGENCE":"TEZZ वैश्विक नेटवर्क जानकारी","See the network edge serving your test.":"देखें कि आपका टेस्ट किस नेटवर्क एज से जुड़ता है।","View the Cloudflare data centre handling this request separately from the source network's approximate country and region.":"इस अनुरोध को संभालने वाले Cloudflare डेटा सेंटर और स्रोत नेटवर्क के अनुमानित देश व क्षेत्र को अलग-अलग देखें।","CURRENT TEZZ EDGE":"वर्तमान TEZZ एज","Identifying edge…":"एज की पहचान हो रही है…","Edge information not loaded":"एज की जानकारी लोड नहीं हुई","Cloudflare data centre (colo)":"Cloudflare डेटा सेंटर (colo)","Source country (IP geolocation)":"स्रोत देश (IP जियोलोकेशन)","Source region (IP geolocation)":"स्रोत क्षेत्र (IP जियोलोकेशन)","Source network ASN":"स्रोत नेटवर्क ASN","Source network operator (ASN name)":"स्रोत नेटवर्क ऑपरेटर (ASN नाम)","Refresh edge details":"एज विवरण रीफ़्रेश करें","WHAT THIS TELLS YOU":"इससे क्या पता चलता है","Your request reaches TEZZ through this edge.":"आपका अनुरोध इसी एज के ज़रिए TEZZ तक पहुँचता है।","Your browser":"आपका ब्राउज़र","Current device and network":"वर्तमान डिवाइस और नेटवर्क","Cloudflare data centre":"Cloudflare डेटा सेंटर","TEZZ service":"TEZZ सेवा","Speed-test endpoint":"स्पीड टेस्ट एंडपॉइंट","COMMUNITY NETWORK BENCHMARKS":"कम्युनिटी नेटवर्क बेंचमार्क","Regional performance overview":"क्षेत्रीय प्रदर्शन का अवलोकन","Refresh data":"डेटा रीफ़्रेश करें","Reporting window: last 7 days":"रिपोर्ट अवधि: पिछले 7 दिन","Publication threshold: 30 contributions per region":"प्रकाशन सीमा: प्रति क्षेत्र 30 योगदान","YOUR LOCAL TEST RECORDS":"आपके स्थानीय टेस्ट रिकॉर्ड","Internet speed test history.":"इंटरनेट स्पीड टेस्ट का इतिहास।","Review your recent download, upload, HTTP latency and response variation measurements saved in this browser.":"इस ब्राउज़र में सेव किए गए हाल के डाउनलोड, अपलोड, HTTP लेटेंसी और प्रतिक्रिया बदलाव के माप देखें।","Saved tests":"सेव किए गए टेस्ट","Storage":"स्टोरेज","This browser only":"केवल यह ब्राउज़र","Retention":"रिकॉर्ड अवधि","Up to 50 tests":"अधिकतम 50 टेस्ट","No saved tests yet. Run a speed test to build your history.":"अभी कोई टेस्ट सेव नहीं है। इतिहास बनाने के लिए स्पीड टेस्ट चलाएँ।","Date & time":"तारीख और समय","NETWORK RESPONSE RECORDS":"नेटवर्क प्रतिक्रिया रिकॉर्ड","Latency test history":"लेटेंसी टेस्ट इतिहास","Compare independent response-time tests saved on this device.":"इस डिवाइस पर सेव किए गए स्वतंत्र प्रतिक्रिया-समय टेस्ट की तुलना करें।","No latency tests saved yet. Run a test from Tools to start tracking response consistency.":"अभी कोई लेटेंसी टेस्ट सेव नहीं है। प्रतिक्रिया स्थिरता ट्रैक करने के लिए टूल्स से टेस्ट चलाएँ।","CONNECTION CONSISTENCY RECORDS":"कनेक्शन स्थिरता रिकॉर्ड","Stability monitor history":"स्थिरता मॉनिटर इतिहास","Review completed 30-sample monitoring sessions saved on this device.":"इस डिवाइस पर सेव किए गए 30-सैंपल मॉनिटरिंग सत्र देखें।","No stability sessions saved yet. Run the Connection Stability Monitor in Tools to start tracking.":"अभी कोई स्थिरता सत्र सेव नहीं है। ट्रैकिंग शुरू करने के लिए टूल्स में कनेक्शन स्थिरता मॉनिटर चलाएँ।","TEZZ CONNECT PERFORMANCE SUMMARY":"TEZZ CONNECT प्रदर्शन सारांश","Your internet performance report.":"आपके इंटरनेट प्रदर्शन की रिपोर्ट।","A combined view of your latest speed, latency and connection stability measurements saved in this browser.":"इस ब्राउज़र में सेव किए गए नवीनतम गति, लेटेंसी और कनेक्शन स्थिरता मापों का संयुक्त दृश्य।","Generated":"बनाया गया","Local browser data · Private":"स्थानीय ब्राउज़र डेटा · निजी","AT A GLANCE":"एक नज़र में","Speed":"गति","Latency":"लेटेंसी","Stability":"स्थिरता","Recent performance trend":"हाल के प्रदर्शन का रुझान","Latest saved measurements on this device. Compare sessions over time; different test types are shown separately.":"इस डिवाइस पर सेव किए गए नवीनतम माप। समय के साथ सत्रों की तुलना करें; अलग-अलग टेस्ट प्रकार अलग दिखाए गए हैं।","Copy full report":"पूरी रिपोर्ट कॉपी करें","Download PDF":"PDF डाउनलोड करें"},"mr":{"TEZZ GLOBAL NETWORK INTELLIGENCE":"TEZZ जागतिक नेटवर्क माहिती","See the network edge serving your test.":"तुमची चाचणी कोणत्या नेटवर्क एजद्वारे हाताळली जाते ते पाहा.","View the Cloudflare data centre handling this request separately from the source network's approximate country and region.":"ही विनंती हाताळणारे Cloudflare डेटा सेंटर आणि स्रोत नेटवर्कचा अंदाजे देश व प्रदेश स्वतंत्रपणे पाहा.","CURRENT TEZZ EDGE":"सध्याचा TEZZ एज","Identifying edge…":"एज ओळखत आहे…","Edge information not loaded":"एजची माहिती लोड झालेली नाही","Cloudflare data centre (colo)":"Cloudflare डेटा सेंटर (colo)","Source country (IP geolocation)":"स्रोत देश (IP स्थान)","Source region (IP geolocation)":"स्रोत प्रदेश (IP स्थान)","Source network ASN":"स्रोत नेटवर्क ASN","Source network operator (ASN name)":"स्रोत नेटवर्क ऑपरेटर (ASN नाव)","Refresh edge details":"एज तपशील रिफ्रेश करा","WHAT THIS TELLS YOU":"यातून काय समजते","Your request reaches TEZZ through this edge.":"तुमची विनंती या एजद्वारे TEZZ पर्यंत पोहोचते.","Your browser":"तुमचा ब्राउझर","Current device and network":"सध्याचे डिव्हाइस आणि नेटवर्क","Cloudflare data centre":"Cloudflare डेटा सेंटर","TEZZ service":"TEZZ सेवा","Speed-test endpoint":"स्पीड टेस्ट एंडपॉइंट","COMMUNITY NETWORK BENCHMARKS":"समुदाय नेटवर्क बेंचमार्क","Regional performance overview":"प्रादेशिक कामगिरीचा आढावा","Refresh data":"डेटा रिफ्रेश करा","Reporting window: last 7 days":"अहवाल कालावधी: मागील 7 दिवस","Publication threshold: 30 contributions per region":"प्रकाशन मर्यादा: प्रत्येक प्रदेशासाठी 30 योगदान","YOUR LOCAL TEST RECORDS":"तुमच्या स्थानिक चाचणी नोंदी","Internet speed test history.":"इंटरनेट स्पीड टेस्टचा इतिहास.","Review your recent download, upload, HTTP latency and response variation measurements saved in this browser.":"या ब्राउझरमध्ये जतन केलेली अलीकडील डाउनलोड, अपलोड, HTTP लेटन्सी आणि प्रतिसादातील बदलांची मोजमापे पाहा.","Saved tests":"जतन केलेल्या चाचण्या","Storage":"स्टोरेज","This browser only":"फक्त हा ब्राउझर","Retention":"नोंदींचा कालावधी","Up to 50 tests":"कमाल 50 चाचण्या","No saved tests yet. Run a speed test to build your history.":"अजून चाचण्या जतन केलेल्या नाहीत. इतिहास तयार करण्यासाठी स्पीड टेस्ट चालवा.","Date & time":"दिनांक आणि वेळ","NETWORK RESPONSE RECORDS":"नेटवर्क प्रतिसाद नोंदी","Latency test history":"लेटन्सी चाचणी इतिहास","Compare independent response-time tests saved on this device.":"या डिव्हाइसवर जतन केलेल्या स्वतंत्र प्रतिसाद-वेळ चाचण्यांची तुलना करा.","No latency tests saved yet. Run a test from Tools to start tracking response consistency.":"अजून लेटन्सी चाचण्या जतन केलेल्या नाहीत. प्रतिसादातील सातत्य नोंदवण्यासाठी Tools मधून चाचणी चालवा.","CONNECTION CONSISTENCY RECORDS":"कनेक्शन स्थिरता नोंदी","Stability monitor history":"स्थिरता मॉनिटर इतिहास","Review completed 30-sample monitoring sessions saved on this device.":"या डिव्हाइसवर जतन केलेली पूर्ण झालेली 30-सॅम्पल मॉनिटरिंग सत्रे पाहा.","No stability sessions saved yet. Run the Connection Stability Monitor in Tools to start tracking.":"अजून स्थिरता सत्रे जतन केलेली नाहीत. नोंद सुरू करण्यासाठी Tools मधील Connection Stability Monitor चालवा.","TEZZ CONNECT PERFORMANCE SUMMARY":"TEZZ CONNECT कामगिरी सारांश","Your internet performance report.":"तुमचा इंटरनेट कामगिरी अहवाल.","A combined view of your latest speed, latency and connection stability measurements saved in this browser.":"या ब्राउझरमध्ये जतन केलेल्या नवीनतम वेग, लेटन्सी आणि कनेक्शन स्थिरता मोजमापांचा एकत्रित आढावा.","Generated":"तयार केले","Local browser data · Private":"स्थानिक ब्राउझर डेटा · खाजगी","AT A GLANCE":"एका नजरेत","Speed":"वेग","Latency":"लेटन्सी","Stability":"स्थिरता","Recent performance trend":"अलीकडील कामगिरीचा कल","Latest saved measurements on this device. Compare sessions over time; different test types are shown separately.":"या डिव्हाइसवरील नवीनतम जतन केलेली मोजमापे. वेगवेगळ्या सत्रांची तुलना करा; चाचणीचे प्रकार स्वतंत्र दाखवले आहेत.","Copy full report":"संपूर्ण अहवाल कॉपी करा","Download PDF":"PDF डाउनलोड करा"},"bn":{"TEZZ GLOBAL NETWORK INTELLIGENCE":"TEZZ গ্লোবাল নেটওয়ার্ক তথ্য","See the network edge serving your test.":"আপনার পরীক্ষা কোন নেটওয়ার্ক এজের মাধ্যমে পরিচালিত হচ্ছে দেখুন।","View the Cloudflare data centre handling this request separately from the source network's approximate country and region.":"এই অনুরোধ পরিচালনাকারী Cloudflare ডেটা সেন্টার এবং উৎস নেটওয়ার্কের আনুমানিক দেশ ও অঞ্চল আলাদাভাবে দেখুন।","CURRENT TEZZ EDGE":"বর্তমান TEZZ এজ","Identifying edge…":"এজ শনাক্ত করা হচ্ছে…","Edge information not loaded":"এজের তথ্য লোড হয়নি","Cloudflare data centre (colo)":"Cloudflare ডেটা সেন্টার (colo)","Source country (IP geolocation)":"উৎস দেশ (IP অবস্থান)","Source region (IP geolocation)":"উৎস অঞ্চল (IP অবস্থান)","Source network ASN":"উৎস নেটওয়ার্ক ASN","Source network operator (ASN name)":"উৎস নেটওয়ার্ক অপারেটর (ASN নাম)","Refresh edge details":"এজের বিবরণ রিফ্রেশ করুন","WHAT THIS TELLS YOU":"এতে কী বোঝা যায়","Your request reaches TEZZ through this edge.":"আপনার অনুরোধ এই এজের মাধ্যমে TEZZ-এ পৌঁছায়।","Your browser":"আপনার ব্রাউজার","Current device and network":"বর্তমান ডিভাইস ও নেটওয়ার্ক","Cloudflare data centre":"Cloudflare ডেটা সেন্টার","TEZZ service":"TEZZ পরিষেবা","Speed-test endpoint":"স্পিড টেস্ট এন্ডপয়েন্ট","COMMUNITY NETWORK BENCHMARKS":"কমিউনিটি নেটওয়ার্ক বেঞ্চমার্ক","Regional performance overview":"আঞ্চলিক পারফরম্যান্সের সারাংশ","Refresh data":"ডেটা রিফ্রেশ করুন","Reporting window: last 7 days":"রিপোর্টের সময়সীমা: গত ৭ দিন","Publication threshold: 30 contributions per region":"প্রকাশের সীমা: প্রতি অঞ্চলে ৩০টি অবদান","YOUR LOCAL TEST RECORDS":"আপনার স্থানীয় পরীক্ষার রেকর্ড","Internet speed test history.":"ইন্টারনেট স্পিড টেস্টের ইতিহাস।","Review your recent download, upload, HTTP latency and response variation measurements saved in this browser.":"এই ব্রাউজারে সংরক্ষিত সাম্প্রতিক ডাউনলোড, আপলোড, HTTP ল্যাটেন্সি ও প্রতিক্রিয়ার পরিবর্তনের পরিমাপ দেখুন।","Saved tests":"সংরক্ষিত পরীক্ষা","Storage":"স্টোরেজ","This browser only":"শুধু এই ব্রাউজার","Retention":"সংরক্ষণের সীমা","Up to 50 tests":"সর্বোচ্চ ৫০টি পরীক্ষা","No saved tests yet. Run a speed test to build your history.":"এখনও কোনো পরীক্ষা সংরক্ষিত নেই। ইতিহাস তৈরি করতে স্পিড টেস্ট চালান।","Date & time":"তারিখ ও সময়","NETWORK RESPONSE RECORDS":"নেটওয়ার্ক প্রতিক্রিয়ার রেকর্ড","Latency test history":"ল্যাটেন্সি পরীক্ষার ইতিহাস","Compare independent response-time tests saved on this device.":"এই ডিভাইসে সংরক্ষিত স্বতন্ত্র প্রতিক্রিয়া-সময়ের পরীক্ষাগুলি তুলনা করুন।","No latency tests saved yet. Run a test from Tools to start tracking response consistency.":"এখনও কোনো ল্যাটেন্সি পরীক্ষা সংরক্ষিত নেই। প্রতিক্রিয়ার ধারাবাহিকতা ট্র্যাক করতে Tools থেকে পরীক্ষা চালান।","CONNECTION CONSISTENCY RECORDS":"সংযোগের স্থিতিশীলতার রেকর্ড","Stability monitor history":"স্থিতিশীলতা মনিটরের ইতিহাস","Review completed 30-sample monitoring sessions saved on this device.":"এই ডিভাইসে সংরক্ষিত সম্পূর্ণ ৩০-নমুনার মনিটরিং সেশন দেখুন।","No stability sessions saved yet. Run the Connection Stability Monitor in Tools to start tracking.":"এখনও কোনো স্থিতিশীলতা সেশন সংরক্ষিত নেই। ট্র্যাকিং শুরু করতে Tools-এ Connection Stability Monitor চালান।","TEZZ CONNECT PERFORMANCE SUMMARY":"TEZZ CONNECT পারফরম্যান্স সারাংশ","Your internet performance report.":"আপনার ইন্টারনেট পারফরম্যান্স রিপোর্ট।","A combined view of your latest speed, latency and connection stability measurements saved in this browser.":"এই ব্রাউজারে সংরক্ষিত সর্বশেষ গতি, ল্যাটেন্সি ও সংযোগের স্থিতিশীলতার পরিমাপের সম্মিলিত দৃশ্য।","Generated":"তৈরি হয়েছে","Local browser data · Private":"স্থানীয় ব্রাউজার ডেটা · ব্যক্তিগত","AT A GLANCE":"এক নজরে","Speed":"গতি","Latency":"ল্যাটেন্সি","Stability":"স্থিতিশীলতা","Recent performance trend":"সাম্প্রতিক পারফরম্যান্সের প্রবণতা","Latest saved measurements on this device. Compare sessions over time; different test types are shown separately.":"এই ডিভাইসে সংরক্ষিত সর্বশেষ পরিমাপ। সময়ের সঙ্গে সেশন তুলনা করুন; বিভিন্ন পরীক্ষার ধরন আলাদাভাবে দেখানো হয়েছে।","Copy full report":"সম্পূর্ণ রিপোর্ট কপি করুন","Download PDF":"PDF ডাউনলোড করুন"},"zh-CN":{},"pt-BR":{},"es":{},"fr":{},"ar":{}}

let activeLocaleBundle: Record<string, unknown> = {}
function speedText(language: UiLanguage, text: string): string { const bundled = activeLocaleBundle[text]; return (typeof bundled === 'string' ? bundled : undefined) ?? EXTRA_SPEED_COPY[language]?.[text] ?? SPEED_COPY[language]?.[text] ?? text }

const UI_COPY: Record<UiLanguage, string[]> = {"en":["Home","Free Speed Test","Internet Doctor","Network Tools","Global Network","Test History","Performance Report","About TEZZ CONNECT","Language"],"hi":["होम","मुफ़्त स्पीड टेस्ट","इंटरनेट डॉक्टर","नेटवर्क टूल","ग्लोबल नेटवर्क","टेस्ट इतिहास","प्रदर्शन रिपोर्ट","TEZZ CONNECT के बारे में","भाषा"],"mr":["मुख्यपृष्ठ","मोफत स्पीड टेस्ट","इंटरनेट डॉक्टर","नेटवर्क साधने","जागतिक नेटवर्क","चाचणी इतिहास","कामगिरी अहवाल","TEZZ CONNECT बद्दल","भाषा"],"bn":["হোম","বিনামূল্যে স্পিড টেস্ট","ইন্টারনেট ডাক্তার","নেটওয়ার্ক টুল","বিশ্ব নেটওয়ার্ক","পরীক্ষার ইতিহাস","পারফরম্যান্স রিপোর্ট","TEZZ CONNECT সম্পর্কে","ভাষা"],"zh-CN":["首页","免费网速测试","网络诊断助手","网络工具","全球网络","测试历史","性能报告","关于 TEZZ CONNECT","语言"],"pt-BR":["Início","Teste de velocidade grátis","Diagnóstico da internet","Ferramentas de rede","Rede global","Histórico de testes","Relatório de desempenho","Sobre a TEZZ CONNECT","Idioma"],"es":["Inicio","Prueba de velocidad gratis","Diagnóstico de internet","Herramientas de red","Red global","Historial de pruebas","Informe de rendimiento","Acerca de TEZZ CONNECT","Idioma"],"fr":["Accueil","Test de débit gratuit","Diagnostic Internet","Outils réseau","Réseau mondial","Historique des tests","Rapport de performances","À propos de TEZZ CONNECT","Langue"],"ar":["الرئيسية","اختبار سرعة مجاني","طبيب الإنترنت","أدوات الشبكة","الشبكة العالمية","سجل الاختبارات","تقرير الأداء","حول TEZZ CONNECT","اللغة"]}


const LOCALE_CODES: UiLanguage[] = ['en', 'hi', 'mr', 'bn', 'zh-CN', 'pt-BR', 'es', 'fr', 'ar']
function localeFromPath(pathname: string): UiLanguage | null {
  const match = pathname.match(/^\/(hi|mr|bn|zh-CN|pt-BR|es|fr|ar)(?:\/|$)/)
  return match ? match[1] as UiLanguage : null
}
function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/(?:hi|mr|bn|zh-CN|pt-BR|es|fr|ar)(?=\/|$)/, '') || '/'
}
function localizedPath(locale: UiLanguage, basePath: string): string {
  const cleanPath = basePath.startsWith('/') ? basePath : `/${basePath}`
  return locale === 'en' ? cleanPath : `/${locale}${cleanPath === '/' ? '/' : cleanPath}`
}
function countryLocale(country: string): UiLanguage {
  if (country === 'CN') return 'zh-CN'
  if (country === 'BR') return 'pt-BR'
  if (country === 'FR') return 'fr'
  if (['ES','MX','AR','BO','CL','CO','CR','CU','DO','EC','SV','GT','HN','NI','PA','PY','PE','PR','UY','VE'].includes(country)) return 'es'
  if (['DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'].includes(country)) return 'ar'
  return 'en'
}
function browserLocale(): UiLanguage {
  const values = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const value of values) {
    const tag = value.toLowerCase()
    if (tag.startsWith('zh')) return 'zh-CN'
    if (tag === 'pt-br' || tag.startsWith('pt-')) return 'pt-BR'
    if (tag.startsWith('es')) return 'es'
    if (tag.startsWith('fr')) return 'fr'
    if (tag.startsWith('ar')) return 'ar'
    if (tag.startsWith('hi')) return 'hi'
    if (tag.startsWith('mr')) return 'mr'
    if (tag.startsWith('bn')) return 'bn'
  }
  return 'en'
}
const originalLocalizedText = new WeakMap<Text, { original: string; applied: string }>()
function translatePageText(root: ParentNode, locale: UiLanguage, dictionary: Record<string, unknown>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|OPTION|CODE|PRE)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (parent.closest('[data-no-translate],[contenteditable="true"]')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const current = node.nodeValue || ''
    const saved = originalLocalizedText.get(node)
    const original = saved && current === saved.applied ? saved.original : current
    const key = original.trim()
    const translated = locale !== 'en' && typeof dictionary[key] === 'string' ? String(dictionary[key]) : original
    if (current !== translated) node.nodeValue = translated
    originalLocalizedText.set(node, { original, applied: translated })
  }
}

function App() {
  const [language, setLanguage] = useState<UiLanguage>(() => {
    const pathLocale = localeFromPath(window.location.pathname)
    if (pathLocale) return pathLocale
    try {
      const saved = localStorage.getItem('tezz-connect-language')
      if (saved && UI_LANGUAGES.some(item => item.code === saved)) return saved as UiLanguage
    } catch { /* Browser storage may be unavailable. */ }
    return browserLocale()
  })
  const [localeBundle, setLocaleBundle] = useState<Record<string, unknown>>({})

  const copy = UI_COPY[language] ?? UI_COPY.en
  function changeLanguage(next: UiLanguage) {
    setLanguage(next)
    try { localStorage.setItem('tezz-connect-language', next) } catch { /* Preference storage may be unavailable. */ }
    document.documentElement.lang = next
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
    const basePath = stripLocalePrefix(window.location.pathname)
    const nextPath = localizedPath(next, basePath)
    if (window.location.pathname !== nextPath) window.history.replaceState({}, '', nextPath)
    window.dispatchEvent(new CustomEvent('tezz-language-change', { detail: { language: next } }))
  }
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    const syncLanguage = (event: StorageEvent) => { if (event.key === 'tezz-connect-language' && event.newValue && UI_LANGUAGES.some(item => item.code === event.newValue)) setLanguage(event.newValue as UiLanguage) }
    window.addEventListener('storage', syncLanguage)
    return () => window.removeEventListener('storage', syncLanguage)
  }, [language])
  useEffect(() => {
    let active = true
    try {
      if (localStorage.getItem('tezz-connect-language')) return
    } catch { return }
    if (browserLocale() !== 'en') return
    fetch('/locale-country', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<{ country?: string }> : Promise.reject(new Error('Country lookup unavailable')))
      .then(data => {
        if (!active) return
        try { if (localStorage.getItem('tezz-connect-language')) return } catch { return }
        const next = countryLocale(data.country || 'XX')
        if (next !== 'en') {
          setLanguage(next)
          try { localStorage.setItem('tezz-connect-language', next) } catch { /* Preference storage may be unavailable. */ }
        }
      })
      .catch(() => { /* Country detection is optional; English remains the fallback. */ })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const pathLocale = localeFromPath(window.location.pathname)
    if (pathLocale && pathLocale !== language) setLanguage(pathLocale)
    else if (!pathLocale && language !== 'en') {
      const saved = (() => { try { return localStorage.getItem('tezz-connect-language') } catch { return null } })()
      if (saved === language) window.history.replaceState({}, '', localizedPath(language, stripLocalePrefix(window.location.pathname)))
    }
  }, [language])
  useEffect(() => {
    let active = true
    if (language === 'en') { activeLocaleBundle = {}; setLocaleBundle({}); return }
    fetch(`/locales/${language}/common.json`, { credentials: 'same-origin' })
      .then(response => { if (!response.ok) throw new Error('Locale bundle unavailable'); return response.json() })
      .then(bundle => { if (active && bundle && typeof bundle === 'object' && !Array.isArray(bundle)) { activeLocaleBundle = bundle as Record<string, unknown>; setLocaleBundle(activeLocaleBundle) } })
      .catch(() => { if (active) { activeLocaleBundle = {}; setLocaleBundle({}) } })
    return () => { active = false }
  }, [language])
  useEffect(() => {
    const dictionary = localeBundle
    translatePageText(document.body, language, dictionary)
    const observer = new MutationObserver(records => records.forEach(record => {
      if (record.type === 'childList') record.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) translatePageText(node.parentElement || document.body, language, dictionary)
        else if (node.nodeType === Node.ELEMENT_NODE) translatePageText(node as Element, language, dictionary)
      })
      else if (record.type === 'characterData') translatePageText(record.target.parentElement || document.body, language, dictionary)
    }))
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [language, localeBundle])
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
  const [activeTab, setActiveTab] = useState(() => routeToTab[stripLocalePrefix(window.location.pathname)] ?? 'Overview')
  useEffect(() => {
    if (activeTab === 'Global Network' && !benchmarkLoaded && !benchmarkLoading) void refreshBenchmarkRegions()
  }, [activeTab, benchmarkLoaded, benchmarkLoading])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function navigateTo(tab: string) {
    setMobileMenuOpen(false)
    const basePath = tabToRoute[tab] ?? '/'
    const nextPath = localizedPath(language, basePath)
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const handlePopState = () => {
      setMobileMenuOpen(false)
      const pathLocale = localeFromPath(window.location.pathname)
      const nextLanguage = pathLocale || 'en'
      if (nextLanguage !== language) {
        setLanguage(nextLanguage)
        try { localStorage.setItem('tezz-connect-language', nextLanguage) } catch { /* Preference storage may be unavailable. */ }
      }
      setActiveTab(routeToTab[stripLocalePrefix(window.location.pathname)] ?? 'Overview')
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
    const localizedMeta = (localeBundle._meta && typeof localeBundle._meta === 'object' ? localeBundle._meta : {}) as { pageTitles?: Record<string, string>; pageDescriptions?: Record<string, string>; title?: string; description?: string }
    document.title = language !== 'en' ? (localizedMeta.pageTitles?.[activeTab] ?? (activeTab === 'Overview' ? localizedMeta.title : undefined) ?? titles[activeTab] ?? 'TEZZ CONNECT | Internet Performance Tools') : (titles[activeTab] ?? 'TEZZ CONNECT | Internet Performance Tools')

    const descriptions: Record<string, string> = {
      Overview: 'Run a free internet speed test with TEZZ CONNECT. Measure download and upload speed, browser response time and connection stability.',
      'Internet Doctor': 'Investigate slow or unstable internet with practical connection checks. Review speed, response time, Wi-Fi and stability signals, then follow clear troubleshooting steps.',
      Network: 'Free IP address lookup, DNS record checker, Wi-Fi troubleshooting and browser-based network diagnostics from TEZZ CONNECT.',
      'Global Network': 'Explore aggregate regional internet performance benchmarks from participating TEZZ CONNECT tests. See how opt-in samples are grouped and understand their limits.',
      About: 'Learn how TEZZ CONNECT measures internet performance with free browser-based tools and practical network guides.',
      History: 'Review speed-test results saved locally in this browser. Your history is private to this device and is not uploaded or synced.',
      Report: 'View and export a private summary of speed, latency and connection-stability measurements saved in this browser.',
    }
    const description = language !== 'en' ? (localizedMeta.pageDescriptions?.[activeTab] ?? (activeTab === 'Overview' ? localizedMeta.description : undefined) ?? descriptions[activeTab]) : descriptions[activeTab]
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description && descriptionMeta) descriptionMeta.content = description
    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')
    if (description && ogDescription) ogDescription.content = description
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
    if (ogTitle) ogTitle.content = document.title
    const twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')
    if (twitterTitle) twitterTitle.content = document.title
    const twitterDescription = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')
    if (description && twitterDescription) twitterDescription.content = description

    // Keep the canonical URL aligned with the SPA route instead of
    // inheriting the homepage canonical from the static HTML shell.
    const canonicalPath = tabToRoute[activeTab] ?? '/'
    const localizedCanonicalPath = localizedPath(language, canonicalPath)
    const canonicalUrl = new URL(localizedCanonicalPath, window.location.origin).toString()
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')
    if (ogUrl) ogUrl.content = canonicalUrl

    document.querySelectorAll('link[data-tezz-hreflang]').forEach(link => link.remove())
    const alternateLocales: UiLanguage[] = [...LOCALE_CODES]
    alternateLocales.forEach(locale => {
      const alternate = document.createElement('link')
      alternate.rel = 'alternate'
      alternate.hreflang = locale
      alternate.href = new URL(localizedPath(locale, canonicalPath), window.location.origin).toString()
      alternate.dataset.tezzHreflang = 'true'
      document.head.appendChild(alternate)
    })
    const fallback = document.createElement('link')
    fallback.rel = 'alternate'
    fallback.hreflang = 'x-default'
    fallback.href = new URL(canonicalPath, window.location.origin).toString()
    fallback.dataset.tezzHreflang = 'true'
    document.head.appendChild(fallback)
  }, [activeTab, language, localeBundle])
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
    if (network.supported) {
      const slowProfile = network.type === 'SLOW-2G' || network.type === '2G' || network.type === '3G'
      const estimateParts = [
        network.type,
        network.downlink !== 'Not reported' ? `estimated downlink ${network.downlink}` : null,
        network.rtt !== 'Not reported' ? `browser-estimated RTT ${network.rtt}` : null,
      ].filter(Boolean)
      findings.push({
        title: slowProfile ? 'Browser reports a slower network profile' : 'Browser network profile',
        detail: slowProfile
          ? 'The browser classifies the current connection as a slower effective network type. This estimate can be coarse or stale; compare a fresh TEZZ speed test before drawing conclusions.'
          : 'These values are browser-provided estimates. They may be rounded, stale or unavailable and do not identify whether you are on Wi-Fi or mobile data.',
        evidence: estimateParts.join(' · '),
        status: slowProfile ? 'alert' : 'neutral',
      })
      if (network.saveData) {
        findings.push({
          title: 'Data Saver is enabled',
          detail: 'The browser or device reports a reduced-data preference. Some pages and media may load at lower quality or defer background activity; this is not evidence of a network fault.',
          evidence: 'Save-Data preference reported by browser',
          status: 'neutral',
        })
      }
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
        // Three short sustained samples; use the median to reduce one-off
        // scheduling or radio fluctuations while keeping total transfer <=25 MB.
        setTestPhase('Measuring 3 sustained download samples (up to 7.5 seconds / 25 MB total)')
        const downloadRuns: number[] = []
        const sampleMaxBytes = 8_333_333
        for (let run = 0; run < 3; run++) {
          downloadRuns.push(await measureDownload(2500, sampleMaxBytes, (mbps, received) => {
            setLiveSpeed(Number(mbps.toFixed(1)))
            appendSpeedSample(mbps)
            setDownloadBytes(received)
          }))
        }
        download = median(downloadRuns)
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
        setTestPhase(`Measuring upload throughput (${payloadBytes / 1_000_000} MB, client-timed, server-confirmed)`)
        const runs: number[] = []
        // Use a third independent sample for small mobile transfers, where the
        // extra payload stays modest. Keep two samples for larger calibrated
        // payloads to avoid excessive data use on fast connections.
        const uploadSampleCount = payloadBytes <= 2_000_000 ? 3 : 2
        for (let run = 0; run < uploadSampleCount; run++) {
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
            <a className={activeTab === 'Overview' ? 'selected' : ''} href="/" onClick={event => { event.preventDefault(); navigateTo('Overview') }}><Home size={15}/> {copy[0]}</a>
            <a href="/#tezz-speed-test" onClick={event => { event.preventDefault(); navigateTo('Overview'); window.setTimeout(() => document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>{copy[1]}</a>
            <a className={activeTab === 'Internet Doctor' ? 'selected' : ''} href="/internet-doctor" onClick={event => { event.preventDefault(); navigateTo('Internet Doctor') }}>{copy[2]}</a>
            <a className={activeTab === 'Network' ? 'selected' : ''} href="/tools" onClick={event => { event.preventDefault(); navigateTo('Network') }}>{copy[3]}</a>
            <details className={`tezz-nav-dropdown ${['Global Network', 'History', 'Report', 'About'].includes(activeTab) ? 'has-active' : ''}`}>
              <summary aria-label="Global Network menu">Global Network <span aria-hidden="true">▾</span></summary>
              <div className="tezz-nav-dropdown-menu">
                <a className={activeTab === 'Global Network' ? 'selected' : ''} href="/global-network" onClick={event => { event.preventDefault(); navigateTo('Global Network'); if (!edgeInfo && !edgeLoading) void refreshEdgeInfo() }}>{copy[4]}</a>
                <a className={activeTab === 'History' ? 'selected' : ''} href="/history" onClick={event => { event.preventDefault(); navigateTo('History') }}>{copy[5]}</a>
                <a className={activeTab === 'Report' ? 'selected' : ''} href="/report" onClick={event => { event.preventDefault(); navigateTo('Report') }}>{copy[6]}</a>
                <a className={activeTab === 'About' ? 'selected' : ''} href="/about" onClick={event => { event.preventDefault(); navigateTo('About') }}>{copy[7]}</a>
              </div>
            </details>
          </nav>
          <div className="tezz-header-actions"><label className="tezz-language-picker"><Globe2 size={15}/><span className="sr-only">{copy[8]}</span><select aria-label={copy[8]} value={language} onChange={event => changeLanguage(event.target.value as UiLanguage)}>{UI_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.native}</option>)}</select></label><a className="tezz-header-search" aria-label="Explore network tools" title="Explore network tools" href="/tools" onClick={event => { event.preventDefault(); navigateTo('Network') }}><Search size={18}/></a><button className="tezz-menu" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} title={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} aria-controls="tezz-mobile-nav" onClick={() => setMobileMenuOpen(open => !open)}>{mobileMenuOpen ? '✕' : '☰'}</button></div>
        </header>
        {mobileMenuOpen && <nav className="tezz-mobile-nav" id="tezz-mobile-nav" aria-label="Mobile navigation">
          <a className={activeTab === 'Overview' ? 'selected' : ''} href="/" onClick={event => { event.preventDefault(); navigateTo('Overview') }}>{copy[0]}</a>
          <a href="/#tezz-speed-test" onClick={event => { event.preventDefault(); navigateTo('Overview'); window.setTimeout(() => document.getElementById('tezz-speed-test')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>{copy[1]}</a>
          <a className={activeTab === 'Internet Doctor' ? 'selected' : ''} href="/internet-doctor" onClick={event => { event.preventDefault(); navigateTo('Internet Doctor') }}>Internet Doctor</a>
          <a className={activeTab === 'Network' ? 'selected' : ''} href="/tools" onClick={event => { event.preventDefault(); navigateTo('Network') }}>Network Tools</a>
          <details className={`tezz-mobile-nav-group ${['Global Network', 'History', 'Report', 'About'].includes(activeTab) ? 'has-active' : ''}`} open={['Global Network', 'History', 'Report', 'About'].includes(activeTab)}>
            <summary>Global Network <span aria-hidden="true">▾</span></summary>
            <div className="tezz-mobile-nav-submenu">
              <a className={activeTab === 'Global Network' ? 'selected' : ''} href="/global-network" onClick={event => { event.preventDefault(); navigateTo('Global Network'); setMobileMenuOpen(false); if (!edgeInfo && !edgeLoading) void refreshEdgeInfo() }}>Global Network overview</a>
              <a className={activeTab === 'History' ? 'selected' : ''} href="/history" onClick={event => { event.preventDefault(); navigateTo('History'); setMobileMenuOpen(false) }}>Test History</a>
              <a className={activeTab === 'Report' ? 'selected' : ''} href="/report" onClick={event => { event.preventDefault(); navigateTo('Report'); setMobileMenuOpen(false) }}>Performance Report</a>
              <a className={activeTab === 'About' ? 'selected' : ''} href="/about" onClick={event => { event.preventDefault(); navigateTo('About'); setMobileMenuOpen(false) }}>About TEZZ CONNECT</a>
            </div>
          </details>
        </nav>}
        <div className={`content ${activeTab === "Overview" ? "home-content" : ""}`}>
          {activeTab === 'Overview' && <>
          <section className={`tezz-hero ${state === 'running' ? 'is-testing' : ''}`}>
            <div className="tezz-hero-copy">
              <span className="tezz-pill">{speedText(language, 'INTERNET SPEED TEST')}</span>
              <h1>{speedText(language, 'Free Internet ')}<em>{speedText(language, 'Speed Test')}</em></h1>
              <p>{speedText(language, 'Check download, upload, HTTP latency and response variation in seconds.')}</p>
              <ul><li><CheckCircle2 size={17}/> {speedText(language, 'Sustained streaming download · client-timed, server-confirmed upload')}</li><li><CheckCircle2 size={17}/> {speedText(language, 'HTTP latency, response variation & stability')}</li><li><CheckCircle2 size={17}/> {speedText(language, 'Gaming & streaming readiness')}</li><li><CheckCircle2 size={17}/> {speedText(language, 'Free, instant results')}</li></ul>
            </div>
            <div className="tezz-meter-wrap tezz-digital-wrap" id="tezz-speed-test">
              <div className="tezz-digital-meter" aria-live="polite">
                <div className="tezz-meter-topline"><span className="tezz-digital-label">{state === 'running' && testPhase.toLowerCase().includes('upload') ? speedText(language, 'UPLOAD') : state === 'running' && testPhase.toLowerCase().includes('download') ? speedText(language, 'DOWNLOAD') : speedText(language, 'DOWNLOAD SPEED')}</span><span className={`tezz-meter-status ${state === 'running' ? 'active' : result ? 'complete' : ''}`}><i/>{state === 'running' ? speedText(language, 'TESTING') : result ? speedText(language, 'MEASURED') : speedText(language, 'READY')}</span></div>
                <div className="tezz-digital-reading"><strong>{state === 'running' ? testPhase.toLowerCase().includes('upload') ? uploadLiveSpeed.toFixed(1) : testPhase.toLowerCase().includes('download') ? liveSpeed.toFixed(1) : '—' : result ? result.download.toFixed(1) : '—'}</strong><span>Mbps</span></div>
                <div className="tezz-digital-caption">{state === 'running' ? speedText(language, 'Live measurement in progress') : result ? speedText(language, 'Latest download measurement') : speedText(language, 'Your connection speed, measured live')}</div>
                <div className="tezz-meter-scale" aria-hidden="true"><div className="tezz-meter-scale-track"><span className="tezz-meter-scale-sweep"/></div><div className="tezz-meter-scale-caption"><span>CONNECTION THROUGHPUT</span><span>{state === 'running' ? 'LIVE' : result ? 'RECORDED' : 'READY'}</span></div></div>
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
              <button className={`tezz-digital-start ${state==='running'?'testing':''}`} onClick={runTest} disabled={state==='running'}><Zap size={19} fill="currentColor"/>{state==='running'?speedText(language, 'TEST IN PROGRESS'):speedText(language, 'START SPEED TEST')}</button>
              {state==='running'&&<div className="tezz-live-progress"><span>{testPhase}</span><span className="tezz-progress-value">{Math.round(progress)}%</span>{testPhase.includes('upload')?<strong>{(uploadBytes/1_000_000).toFixed(1)} MB sent · {uploadLiveSpeed.toFixed(1)} Mbps</strong>:testPhase.includes('download')?<strong>{(downloadBytes/1_000_000).toFixed(1)} MB received</strong>:null}</div>}
              {state==='error'&&<div className="tezz-live-progress error-note" role="alert">{testError || 'The test could not complete. Please try again.'}</div>}
            </div>
            <div className="tezz-health-card"><div className="tezz-health-title"><HeartPulse size={27}/><strong>{speedText(language, 'Internet Connection Health Check')}</strong></div><span className={`tezz-health-badge ${result?'':'pending'}`}>{result?quality:'Ready to test'}</span><p>{result?'Your internet speed and connection quality have been measured. Review your download, upload, latency and stability results for browsing, streaming, gaming and video calls.':'Run a free internet speed test to check download speed, upload speed, HTTP latency and connection quality for everyday browsing, streaming and online gaming.'}</p><div className="tezz-signal-bars"><i/><i/><i/><i/></div></div>
            <div className="tezz-wave" aria-hidden="true"><svg viewBox="0 0 1000 500" preserveAspectRatio="none"><defs><linearGradient id="tezz-signal-blue"><stop stopColor="#58b8ff" stopOpacity=".02"/><stop offset=".5" stopColor="#1686ed" stopOpacity=".8"/><stop offset="1" stopColor="#65d9ee" stopOpacity=".05"/></linearGradient><linearGradient id="tezz-signal-cyan"><stop stopColor="#64d8e8" stopOpacity=".02"/><stop offset=".55" stopColor="#36b8df" stopOpacity=".7"/><stop offset="1" stopColor="#1686ed" stopOpacity=".04"/></linearGradient></defs><path className="signal-wave signal-wave-back" d="M-30 78 C90 18 170 142 300 78 S510 18 640 78 S850 142 1030 72"/><path className="signal-wave signal-wave-mid" d="M-30 145 C100 82 185 210 320 145 S530 82 665 145 S875 210 1030 138"/><path className="signal-wave signal-wave-front" d="M-30 215 C100 150 195 278 330 212 S540 150 680 215 S880 280 1030 208"/><path className="signal-wave signal-wave-back" d="M-30 285 C100 220 195 350 330 284 S540 220 680 285 S880 350 1030 278"/><path className="signal-wave signal-wave-mid" d="M-30 355 C100 292 195 420 330 354 S540 292 680 355 S880 420 1030 348"/><path className="signal-wave signal-wave-front" d="M-30 425 C100 362 195 490 330 424 S540 362 680 425 S880 490 1030 418"/></svg></div>
          </section>
          <section className="benchmark-consent-panel" aria-label="Global benchmark sharing">
            <div>
              <div className="section-kicker">{speedText(language, 'HELP BUILD A BETTER INTERNET PICTURE')}</div>
              <h2>{speedText(language, 'Contribute to global benchmarks')}</h2>
              <p>Optional. When enabled, a completed speed test shares only download, upload, browser HTTP latency, response variation, and coarse country/region with TEZZ CONNECT. We store hourly regional aggregates—not individual test records, IP addresses, device IDs, or precise location. Public comparisons appear only after at least 30 contributions in a region. HTTP latency is measured to the TEZZ CONNECT edge, not your ISP's full network.</p>
              <label className="benchmark-consent-toggle">
                <input type="checkbox" checked={benchmarkConsent} onChange={event => {
                  const enabled = event.target.checked
                  setBenchmarkConsent(enabled)
                  setBenchmarkStatus(enabled ? 'Opt-in enabled. Your next completed speed test can contribute.' : 'Opt-out enabled. No future benchmark contributions will be sent.')
                  try { localStorage.setItem('tezz_benchmark_consent_v1', String(enabled)) } catch { /* Consent remains active for this page session. */ }
                }} />
                <span>{speedText(language, 'Yes, I agree to share anonymous aggregate measurements from my completed speed tests.')}</span>
              </label>
              <div className="benchmark-consent-status" role="status">{benchmarkStatus || (benchmarkConsent ? 'Opt-in is enabled.' : 'Benchmark sharing is off by default.')}</div>
            </div>
          </section>
          <section className="tezz-stat-grid">
            <div className="tezz-stat cyan"><ArrowDown/><span>{speedText(language, 'Download')}</span><strong>{result?result.download.toFixed(2):'—'} <small>Mbps</small></strong></div>
            <div className="tezz-stat violet"><ArrowUp/><span>{speedText(language, 'Upload')}</span><strong>{result?result.upload.toFixed(2):'—'} <small>Mbps</small></strong></div>
            <div className="tezz-stat green"><ArrowLeftRight/><span>{speedText(language, 'HTTP latency')}</span><strong>{result?result.ping:'—'} <small>ms</small></strong></div>
            <div className="tezz-stat red"><Activity/><span>{speedText(language, 'HTTP variation')}</span><strong>{result?result.jitter.toFixed(1):'—'} <small>ms</small></strong></div>
          </section>
          <section className="tezz-feature-grid">
            <button onClick={()=>navigateTo('Internet Doctor')}><Stethoscope/><strong>{speedText(language, 'Internet Doctor')}</strong><span>{speedText(language, 'Find and fix internet problems')}</span><b>›</b></button>
            <button onClick={()=>navigateTo('Network')}><ArrowLeftRight/><strong>{speedText(language, 'Latency Test')}</strong><span>{speedText(language, 'Check browser response time')}</span><b>›</b></button>
            <button onClick={()=>navigateTo('Network')}><Wifi/><strong>{speedText(language, 'Wi-Fi Test')}</strong><span>{speedText(language, 'Test your Wi-Fi performance')}</span><b>›</b></button>
            <button onClick={()=>navigateTo('History')}><Grid2X2/><strong>{speedText(language, 'More Tools')}</strong><span>{speedText(language, 'Explore all network tools')}</span><b>›</b></button>
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
              <article style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="about-feature-icon" style={{background:'#DFF5F7',borderColor:'#B9E7EB',color:'#087F91'}}><Stethoscope size={20}/></span><h3 style={{color:'#142B45'}}>Understand issues</h3><p style={{color:'#53677D'}}>Use Internet Doctor recommendations to investigate common causes such as congestion, weak Wi-Fi conditions and competing traffic. Where supported, it also considers browser-reported network estimates such as effective connection type, estimated downlink and estimated RTT. These values can be approximate or stale, and cannot reliably identify whether you are using Wi-Fi or mobile data.</p></article>
              <article style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="about-feature-icon" style={{background:'#DFF5F7',borderColor:'#B9E7EB',color:'#087F91'}}><Globe2 size={20}/></span><h3 style={{color:'#142B45'}}>Explore your network</h3><p style={{color:'#53677D'}}>Review available network-edge information, connection signals and public website endpoint checks.</p></article>
            </div>
            <div className="about-two-column">
              <article className="about-info-card" style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="section-kicker" style={{color:'#087F91'}}>OUR APPROACH</span><h3 style={{color:'#142B45'}}>Clarity over exaggerated claims.</h3><p style={{color:'#53677D'}}>We explain what each test measures and where browser-based checks have limits. Results can vary with your device, Wi-Fi, ISP routing, server distance and network conditions.</p><p style={{color:'#53677D'}}>TEZZ CONNECT is an independent measurement tool. It is not an internet service provider and does not control your connection.</p></article>
              <article className="about-info-card" style={{background:'#F0F7FC',border:'1px solid #D4E4EF',color:'#142B45',boxShadow:'0 8px 24px rgba(20,48,76,.07)'}}><span className="section-kicker" style={{color:'#087F91'}}>PRIVACY & CONTROL</span><h3 style={{color:'#142B45'}}>Your test history stays on this device.</h3><p style={{color:'#53677D'}}>Saved speed, latency and stability history is stored in your browser and is not synced between devices. Running a test sends measurement requests to TEZZ CONNECT so the service can return results. Regional benchmark sharing is optional: when you give consent, the service may store limited measurement summaries for aggregate regional comparisons. Public regional results are shown only when a group meets the minimum sample threshold.</p><p style={{color:'#53677D'}}>We do not need GPS or your street address to run the tools on this page. You can use the speed test without contributing to public benchmarks; you control that separate sharing choice.</p></article>
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
            <h1 className="sr-only">Global Network Intelligence</h1>
            <div className="doctor-heading"><div><div className="section-kicker">{speedText(language, 'TEZZ GLOBAL NETWORK INTELLIGENCE')}</div><h2>{speedText(language, 'See the network edge serving your test.')}</h2><p>{speedText(language, "View the Cloudflare data centre handling this request separately from the source network's approximate country and region.")}</p></div><span className="doctor-symbol"><Globe2 size={23}/></span></div>
            <div className="global-edge-card">
              <div className="global-edge-top"><div><span className="section-kicker">{speedText(language, 'CURRENT TEZZ EDGE')}</span><h3>{edgeInfo?.colo || (edgeLoading ? 'Identifying edge…' : 'Edge information not loaded')}</h3></div><span className={edgeLoading ? 'latency-live-dot running' : 'latency-live-dot'} /></div>
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
              <div className="section-kicker">{speedText(language, 'WHAT THIS TELLS YOU')}</div><h3>{speedText(language, 'Your request reaches TEZZ through this edge.')}</h3>
              <div className="global-route-flow"><div className="global-route-node"><Globe2 size={20}/><strong>Your browser</strong><span>Current device and network</span></div><div className="global-route-connector"><i/></div><div className="global-route-node edge"><Network size={20}/><strong>Cloudflare data centre</strong><span>{edgeInfo?.colo || 'Colo code'}</span></div><div className="global-route-connector"><i/></div><div className="global-route-node"><Server size={20}/><strong>TEZZ service</strong><span>Speed-test endpoint</span></div></div>
              <p>The Cloudflare data-centre code identifies the point handling this request. Country, region and ASN describe the approximate source network based on IP geolocation; they do not identify the data-centre's physical location. This is not a traceroute and does not reveal your full ISP path, routers or cable route.</p>
            </div>

            <div className="global-benchmarks-card">
              <div className="global-benchmarks-heading">
                <div><div className="section-kicker">{speedText(language, 'COMMUNITY NETWORK BENCHMARKS')}</div><h3>{speedText(language, 'Regional performance overview')}</h3><p>Aggregated results from people who explicitly opted in to contribute completed TEZZ CONNECT tests.</p></div>
                <button className="doctor-run-test" onClick={refreshBenchmarkRegions} disabled={benchmarkLoading}>{benchmarkLoading ? 'Refreshing…' : 'Refresh data'} <span aria-hidden="true">↻</span></button>
              </div>
              <div className="global-benchmark-meta"><span>Reporting window: last 7 days</span><span>Publication threshold: 30 contributions per region</span></div>
              {benchmarkError && <p className="latency-error" role="alert">{benchmarkError}</p>}
              {benchmarkLoading && !benchmarkLoaded ? <div className="global-benchmark-empty"><Activity size={19}/><span>Loading regional aggregates…</span></div> :
                benchmarkRegions.length ? <div className="global-benchmark-table-wrap"><div className="global-benchmark-list">
                  {benchmarkRegions.map(region => <article className="global-benchmark-region" key={region.country_code + '-' + region.region_code}>
                    <div className="global-benchmark-region-title"><div><strong>{region.region_code === 'unknown' ? region.country_code : region.region_code + ', ' + region.country_code}</strong><span>{region.sample_count.toLocaleString()} participating tests</span></div><span className="global-benchmark-verified">Threshold met</span></div>
                    <div className="global-benchmark-metrics">
                      <div><span>Average download</span><strong>{typeof region.download_avg_mbps === 'number' ? region.download_avg_mbps.toFixed(1) : '—'} <small>Mbps</small></strong></div>
                      <div><span>Average upload</span><strong>{typeof region.upload_avg_mbps === 'number' ? region.upload_avg_mbps.toFixed(1) : '—'} <small>Mbps</small></strong></div>
                      <div><span>Average HTTP latency</span><strong>{typeof region.latency_avg_ms === 'number' ? region.latency_avg_ms.toFixed(1) : '—'} <small>ms</small></strong></div>
                      <div><span>Average HTTP response variation</span><strong>{typeof region.jitter_avg_ms === 'number' ? region.jitter_avg_ms.toFixed(1) : '—'} <small>ms</small></strong></div>
                    </div>
                  </article>)}
                </div></div> : <div className="global-benchmark-empty"><Globe2 size={21}/><div><strong>{benchmarkLoaded ? 'No regions meet the publication threshold yet.' : 'Regional data has not loaded.'}</strong><span>TEZZ only publishes a regional cohort after at least 30 opted-in contributions are available in the seven-day window. No placeholder or estimated figures are shown.</span></div></div>}
              <p className="global-benchmark-disclaimer">These are averages from participating TEZZ CONNECT tests, not a census of all users or an ISP-wide service rating. Repeat tests may contribute more than once, so counts are contributions rather than unique people or devices. HTTP latency is measured to the TEZZ edge. Regions with fewer than 30 contributions are withheld.</p>
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
            <h1 className="sr-only">Network Tools</h1>
            <div className="doctor-heading"><div><div className="section-kicker">{speedText(language, 'TEZZ NETWORK INTELLIGENCE')}</div><h2>{speedText(language, 'Understand your connection.')}</h2><p>{speedText(language, 'Run independent response-time checks and review the network information your browser makes available.')}</p></div><span className="doctor-symbol"><Wifi size={23}/></span></div>
            <div className="network-intel-grid">
              <div className="network-primary"><span className={network.online ? 'finding-dot good' : 'finding-dot alert'} /><div><span className="section-kicker">{speedText(language, 'INTERNET REACHABILITY')}</span><strong>{network.online ? 'Browser reports online' : 'Browser reports offline'}</strong><p>{network.online ? 'Your device reports an active network connection. This does not guarantee that every website is reachable.' : 'Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.'}</p></div></div>
              <div className="network-detail"><span>{speedText(language, 'Effective connection type')}</span><strong>{network.type}</strong></div>
              <div className="network-detail"><span>{speedText(language, 'Estimated downlink')}</span><strong>{network.downlink}</strong></div>
              <div className="network-detail"><span>{speedText(language, 'Browser-reported RTT')}</span><strong>{network.rtt}</strong></div>
              <div className="network-detail"><span>{speedText(language, 'Data saver preference')}</span><strong>{network.supported ? (network.saveData ? 'Enabled' : 'Not requested') : 'Not available'}</strong></div>
            </div>
            <NetworkStarterTools />
            <div className="latency-tool-card">
              <div className="latency-tool-heading"><div><span className="section-kicker">{speedText(language, 'INDEPENDENT NETWORK TEST')}</span><h3>HTTP Latency &amp; Response Variation Test</h3><p>{speedText(language, '12 small HTTP requests to the TEZZ network edge. No large download or upload.')}</p></div><span className={latencyRunning ? 'latency-live-dot running' : 'latency-live-dot'} /></div>
              <div className="latency-primary-result"><span>{speedText(language, 'AVERAGE HTTP RESPONSE TIME')}</span><strong>{latencySamples.length ? (latencySamples.reduce((a,b)=>a+b,0)/latencySamples.length).toFixed(1) : '—'}<small> ms</small></strong><p>{latencyRunning ? `Measuring sample ${latencySamples.length + latencyFailures} of 12…` : latencyCompletedAt ? `Completed at ${latencyCompletedAt}` : 'Run the test to measure your response time.'}</p></div>
              <div className="latency-metrics-grid">
                <div><span>{speedText(language, 'Minimum')}</span><strong>{latencySamples.length ? Math.min(...latencySamples).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>{speedText(language, 'Maximum')}</span><strong>{latencySamples.length ? Math.max(...latencySamples).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>{speedText(language, 'HTTP response variation')}</span><strong>{latencySamples.length > 1 ? (latencySamples.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-latencySamples[index]),0)/(latencySamples.length-1)).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>{speedText(language, 'Failed requests')}</span><strong>{latencyCompletedAt || latencyRunning ? `${latencyFailures} / 12` : '—'}</strong></div>
              </div>
              {latencySamples.length > 1 && (() => {
                const jitterValue = latencySamples.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-latencySamples[index]),0)/(latencySamples.length-1)
                const level = jitterValue > 50 ? 'high' : jitterValue > 20 ? 'moderate' : 'low'
                return <div className={`latency-stability-note ${level}`}><div><span className="section-kicker">{speedText(language, 'RESPONSE CONSISTENCY')}</span><strong>{level === 'high' ? 'Highly variable response times' : level === 'moderate' ? 'Some response-time variation' : 'Consistent response times'}</strong></div><p>{level === 'high' ? 'Large changes between consecutive requests were measured. Try moving closer to your Wi-Fi router, pausing background downloads and repeating the test.' : level === 'moderate' ? 'Response times changed between samples. Repeat the test when the network is quieter to see whether this pattern continues.' : 'HTTP response times were relatively consistent during this short test.'} These are indicative thresholds for this tool, not a formal line-quality certification.</p></div>
              })()}
              <div className="latency-sample-track" aria-label={`${latencySamples.length} successful latency samples`}>{Array.from({length:12},(_,i)=><span key={i} className={i < latencySamples.length ? 'sample-done' : i < latencySamples.length + latencyFailures ? 'sample-failed' : ''} />)}</div>
              {latencyError && <p className="latency-error" role="alert">{latencyError}</p>}
              <button className="doctor-run-test latency-run-button" onClick={runLatencyCheck} disabled={latencyRunning || !network.online}>{latencyRunning ? 'Testing connection…' : latencyCompletedAt ? 'Run again' : 'Start latency test'} <span aria-hidden="true">→</span></button>
            </div>
            <div className="stability-monitor-card">
              <div className="stability-monitor-heading"><div><span className="section-kicker">{speedText(language, 'LIVE CONNECTION MONITOR')}</span><h3>{speedText(language, 'Connection Stability Monitor')}</h3><p>30 response-time samples, approximately one second apart. Runs independently of the full speed test.</p></div><span className={stabilityRunning ? 'latency-live-dot running' : 'latency-live-dot'} /></div>
              <div className="stability-monitor-summary">
                <div><span>{speedText(language, 'Successful samples')}</span><strong>{stabilitySamples.length} / 30</strong></div>
                <div><span>{speedText(language, 'Failed requests')}</span><strong>{stabilityFailures}</strong></div>
                <div><span>{speedText(language, 'Average response')}</span><strong>{stabilitySamples.length ? (stabilitySamples.reduce((a,b)=>a+b,0)/stabilitySamples.length).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>{speedText(language, 'Highest response')}</span><strong>{stabilitySamples.length ? Math.max(...stabilitySamples).toFixed(1)+' ms' : '—'}</strong></div>
                <div><span>{speedText(language, '95th percentile')}</span><strong>{stabilitySamples.length ? percentile(stabilitySamples, 0.95).toFixed(1)+' ms' : '—'}</strong></div>
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
                <div className="connection-health-score-top"><div><span className="section-kicker">{speedText(language, 'TEZZ CONNECTION HEALTH INDEX')}</span><strong>{connectionHealthScore ? connectionHealthScore.total : '—'}<small>/100</small></strong><span className="connection-health-label">{connectionHealthScore ? connectionHealthScore.label : 'Insufficient measurement data'}</span></div><div className="connection-health-score-meta">{latestStability.samples} successful · {latestStability.failures} failed<br/>{new Date(latestStability.date).toLocaleString()}</div></div>
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
            <div className="network-capabilities"><div><strong>{speedText(language, 'Wi-Fi signal strength')}</strong><span>{speedText(language, 'Not exposed by standard browser APIs')}</span></div><div><strong>{speedText(language, 'Router / gateway details')}</strong><span>{speedText(language, 'Not exposed to this webpage')}</span></div><div><strong>Live connection updates</strong><span>{network.supported ? 'Browser API available' : 'Limited browser support'}</span></div></div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Latency and response variation are measured as HTTP request/response times to the TEZZ edge, not ICMP ping. {speedText(language, 'Failed requests')} are not labelled packet loss. Results can vary with device load, Wi-Fi, server distance and ISP routing.</div>
          </section>}
          {activeTab === 'Internet Doctor' && <section className="doctor-panel">
            <div className="doctor-heading"><div><div className="section-kicker">{speedText(language, 'TEZZ INTERNET DOCTOR')}</div><h2>{speedText(language, 'Find out what is slowing you down.')}</h2><p>{speedText(language, 'Use your latest speed test and browser network signals to identify likely connection issues.')}</p></div><span className="doctor-symbol"><Activity size={23}/></span></div>
            <div className="doctor-grid">
              <div className="doctor-status"><span className="section-kicker">{speedText(language, 'DIAGNOSTIC STATUS')}</span><strong className={result && quality === 'Needs attention' ? 'status-alert' : result && quality === 'Fair' ? 'status-caution' : 'status-positive'}>{result ? quality : speedText(language, 'Awaiting test')}</strong><p>{result ? `Measured download ${result.download} Mbps · HTTP round-trip ${result.ping} ms · HTTP response variation ${result.jitter} ms.` : speedText(language, 'Run the speed test first. The Doctor will use those measurements to tailor its recommendations.')}</p></div>
              <div className="doctor-findings">
                {doctorFindings.map((finding) => <div className="doctor-finding" key={finding.title}><span className={`finding-dot ${finding.status}`} /><div><strong>{finding.title}</strong><p>{finding.detail}</p><small className="doctor-evidence">{finding.evidence}</small></div></div>)}
                {!result && network.online && <button className="doctor-run-test" onClick={() => { void runTest() }} disabled={state === 'running'}>{state === 'running' ? speedText(language, 'Test running…') : speedText(language, 'Run speed test')} <span aria-hidden="true">→</span></button>}
              </div>
            </div>
            <div className="doctor-next-steps">
              <div className="doctor-next-heading"><div><span className="section-kicker">{speedText(language, 'PERSONALISED TROUBLESHOOTING')}</span><h3>{speedText(language, 'Recommended next steps')}</h3></div><button className="doctor-run-test" onClick={() => { void runTest() }} disabled={state === 'running'}>{state === 'running' ? speedText(language, 'Test running…') : speedText(language, 'Run new test')} <span aria-hidden="true">→</span></button></div>
              <div className="doctor-next-grid">{doctorRecommendations.map(item => <div className="doctor-next-item" key={item.title}><span className={`doctor-priority ${item.priority}`}>{item.priority === 'high' ? speedText(language, 'Priority') : item.priority === 'medium' ? speedText(language, 'Suggested') : speedText(language, 'Next step')}</span><strong>{item.title}</strong><p>{item.detail}</p></div>)}</div>
            </div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> {speedText(language, 'Latency and response variation here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.')}</div>
          </section>}
          {activeTab === 'History' && <section className="history-page-panel">
            <h1 className="sr-only">Internet Speed Test History</h1>
            <div className="doctor-heading"><div><div className="section-kicker">YOUR LOCAL TEST RECORDS</div><h2>Internet speed test history.</h2><p>Review your recent download, upload, HTTP latency and response variation measurements saved in this browser.</p></div><span className="doctor-symbol"><History size={23}/></span></div>
            <div className="history-page-summary"><div><span>Saved tests</span><strong>{history.length}</strong></div><div><span>Storage</span><strong>This browser only</strong></div><div><span>Retention</span><strong>Up to 50 tests</strong></div></div>
            {history.length === 0 ? <div className="empty-history"><History size={18}/><span>No saved tests yet. Run a speed test to build your history.</span></div> : <div className="history-table">
              <div className="history-table-head"><span>Date & time</span><span>Download</span><span>Upload</span><span>HTTP latency</span><span>HTTP response variation</span></div>
              {history.map(item => <div className="history-table-row" key={item.date}><span>{new Date(item.date).toLocaleString()}</span><strong>{item.download.toFixed(1)} Mbps</strong><strong>{item.upload.toFixed(1)} Mbps</strong><span>{item.ping} ms</span><span>{item.jitter.toFixed(1)} ms</span></div>)}
            </div>}
            <div className="latency-history-section">
              <div className="latency-history-heading"><div><span className="section-kicker">{speedText(language, 'NETWORK RESPONSE RECORDS')}</span><h3>{speedText(language, 'Latency test history')}</h3><p>Compare independent response-time tests saved on this device.</p></div><span className="latency-history-count">{latencyHistory.length} / 30</span></div>
              {latencyHistory.length === 0 ? <div className="empty-history"><Activity size={18}/><span>No latency tests saved yet. Run a test from Tools to start tracking response consistency.</span></div> : <>
                {latencyHistory.length > 1 && <div className="latency-history-comparison"><div><span>Latest average</span><strong>{latencyHistory[0].average.toFixed(1)} ms</strong></div><div><span>Previous average</span><strong>{latencyHistory[1].average.toFixed(1)} ms</strong></div><div><span>Change</span><strong>{Math.abs(latencyHistory[0].average-latencyHistory[1].average).toFixed(1)} ms {latencyHistory[0].average < latencyHistory[1].average ? 'faster' : latencyHistory[0].average > latencyHistory[1].average ? 'slower' : 'unchanged'}</strong></div></div>}
                <div className="latency-history-list">{latencyHistory.map((item,index)=><div className="latency-history-row" key={item.date}><span className="latency-history-index">#{index+1}</span><span className="latency-history-date">{new Date(item.date).toLocaleString()}</span><strong>{item.average.toFixed(1)} ms</strong><span>Variation {item.jitter.toFixed(1)} ms</span><span>{item.failures}/12 failed</span></div>)}</div>
              </>}
            </div>
            <div className="latency-history-section stability-history-section">
              <div className="latency-history-heading"><div><span className="section-kicker">{speedText(language, 'CONNECTION CONSISTENCY RECORDS')}</span><h3>{speedText(language, 'Stability monitor history')}</h3><p>Review completed 30-sample monitoring sessions saved on this device.</p></div><span className="latency-history-count">{stabilityHistory.length} / 30</span></div>
              {stabilityHistory.length === 0 ? <div className="empty-history"><Activity size={18}/><span>No stability sessions saved yet. Run the Connection Stability Monitor in Tools to start tracking.</span></div> : <>
                {stabilityHistory.length > 1 && <div className="latency-history-comparison"><div><span>Latest average</span><strong>{stabilityHistory[0].average.toFixed(1)} ms</strong></div><div><span>Previous average</span><strong>{stabilityHistory[1].average.toFixed(1)} ms</strong></div><div><span>Change</span><strong>{Math.abs(stabilityHistory[0].average-stabilityHistory[1].average).toFixed(1)} ms {stabilityHistory[0].average < stabilityHistory[1].average ? 'faster' : stabilityHistory[0].average > stabilityHistory[1].average ? 'slower' : 'unchanged'}</strong></div></div>}
                <div className="latency-history-list stability-history-list">{stabilityHistory.map((item,index)=><div className="latency-history-row" key={item.date}><span className="latency-history-index">#{index+1}</span><span className="latency-history-date">{new Date(item.date).toLocaleString()}</span><strong>{item.average.toFixed(1)} ms</strong><span>{item.spikes} spikes · {item.jitter.toFixed(1)} ms variation</span><span>{item.failures} failed</span></div>)}</div>
              </>}
            </div>
            <div className="doctor-disclaimer"><ShieldCheck size={15}/> Speed, latency and stability histories are stored locally in this browser and are not synced across devices. Clearing browser site data may remove these records.</div>
          </section>}
          {activeTab === 'Report' && <section className="performance-report-panel">
            <h1 className="sr-only">Internet Performance Report</h1>
            <div className="doctor-heading"><div><div className="section-kicker">TEZZ CONNECT PERFORMANCE SUMMARY</div><h2>Your internet performance report.</h2><p>A combined view of your latest speed, latency and connection stability measurements saved in this browser.</p></div><span className="doctor-symbol"><ClipboardCopy size={23}/></span></div>
            <div className="performance-report-meta"><span>Generated {new Date().toLocaleString()}</span><span>Local browser data · Private</span></div>
            <div className="performance-report-visual">
              <div className="performance-report-visual-head"><span className="section-kicker">{speedText(language, 'AT A GLANCE')}</span><strong>{result && latencyHistory[0] && stabilityHistory[0] ? '3 measurement categories available' : 'Your measurement coverage'}</strong></div>
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
            <div className="performance-report-section"><h3>{speedText(language, 'Recent performance trend')}</h3><p>Latest saved measurements on this device. Compare sessions over time; different test types are shown separately.</p>
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
            <div className="report-summary"><div><span>Overall assessment</span><strong>{quality}</strong></div><div><span>Public endpoints responding</span><strong>{serviceResults.filter(item => item.status === 'Responding').length} / {services.length}</strong></div><div><span>Test data transferred</span><strong>Download up to 25 MB · upload up to 10 MB per run</strong></div></div>
            <p className="report-note">This report combines streamed download throughput (up to 25 MB or 6 seconds) and client-timed, server-confirmed upload throughput (up to 10 MB per transfer), median browser HTTP response-time samples, mean absolute difference between consecutive HTTP response-time samples and public website endpoint checks. Results describe this test session and may vary by device, Wi-Fi, ISP routing and server location. App checks do not verify sign-in or in-app features.</p>
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
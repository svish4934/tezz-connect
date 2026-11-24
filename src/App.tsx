import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import NetworkEdgeMap from './NetworkEdgeMap'
import {
  Activity, ArrowDown, ArrowUp, CheckCircle2, ClipboardCopy, MonitorPlay, Video, Gamepad2, Globe2,
  History, Monitor, Stethoscope, ArrowLeftRight, Search,
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
const UI_LANGUAGES = [{ code: 'en', native: 'English' }]
const SPEED_COPY: Record<string, Record<string, string>> = {"en":{},"hi":{"INTERNET SPEED TEST":"इंटरनेट स्पीड टेस्ट","Free Internet ":"मुफ़्त इंटरनेट ","Speed Test":"स्पीड टेस्ट","Check download, upload, HTTP latency and response variation in seconds.":"डाउनलोड, अपलोड, HTTP लेटेंसी और प्रतिक्रिया में बदलाव कुछ ही सेकंड में जाँचें।","Sustained streaming download · client-timed, server-confirmed upload":"लगातार डाउनलोड मापन · ब्राउज़र से समय मापा गया, सर्वर से पुष्टि किया गया अपलोड","HTTP latency, response variation & stability":"HTTP लेटेंसी, प्रतिक्रिया में बदलाव और स्थिरता","Gaming & streaming readiness":"गेमिंग और स्ट्रीमिंग की तैयारी","Free, instant results":"मुफ़्त और तुरंत परिणाम","UPLOAD":"अपलोड","DOWNLOAD":"डाउनलोड","DOWNLOAD SPEED":"डाउनलोड गति","TESTING":"जाँच जारी","MEASURED":"मापा गया","READY":"तैयार","Live measurement in progress":"लाइव मापन जारी है","Latest download measurement":"नवीनतम डाउनलोड मापन","Your connection speed, measured live":"आपके कनेक्शन की गति का लाइव मापन","TEST IN PROGRESS":"टेस्ट जारी है","START SPEED TEST":"स्पीड टेस्ट शुरू करें","Internet Connection Health Check":"इंटरनेट कनेक्शन की स्थिति जाँचें","Download":"डाउनलोड","Upload":"अपलोड","HTTP latency":"HTTP लेटेंसी","HTTP variation":"HTTP प्रतिक्रिया में बदलाव","HELP BUILD A BETTER INTERNET PICTURE":"बेहतर इंटरनेट तस्वीर बनाने में मदद करें","Contribute to global benchmarks":"वैश्विक बेंचमार्क में योगदान दें","Optional. When enabled, a completed speed test shares only download, upload, browser HTTP latency, response variation, and coarse country/region with TEZZ CONNECT. We store hourly regional aggregates—not individual test records, IP addresses, device IDs, or precise location. Public comparisons appear only after at least 30 contributions in a region. HTTP latency is measured to the TEZZ CONNECT edge, not your ISP's full network.":"यह वैकल्पिक है। सक्षम करने पर पूरा हुआ स्पीड टेस्ट केवल डाउनलोड, अपलोड, ब्राउज़र HTTP लेटेंसी, प्रतिक्रिया में बदलाव और मोटे देश/क्षेत्र का डेटा TEZZ CONNECT के साथ साझा करता है। हम व्यक्तिगत टेस्ट रिकॉर्ड, IP पते, डिवाइस ID या सटीक स्थान के बजाय प्रति घंटे क्षेत्रीय समेकित आँकड़े रखते हैं। किसी क्षेत्र में कम-से-कम 30 योगदान मिलने पर ही सार्वजनिक तुलना दिखाई जाती है। HTTP लेटेंसी TEZZ CONNECT एज तक मापी जाती है, आपके ISP के पूरे नेटवर्क तक नहीं।","Yes, I agree to share anonymous aggregate measurements from my completed speed tests.":"हाँ, मैं अपने पूरे हुए स्पीड टेस्ट के गुमनाम समेकित माप साझा करने के लिए सहमत हूँ।","Opt-in is enabled.":"साझा करने की अनुमति चालू है।","Benchmark sharing is off by default.":"बेंचमार्क साझा करना डिफ़ॉल्ट रूप से बंद है।","Find and fix internet problems":"इंटरनेट की समस्याएँ पहचानें और ठीक करें","Latency Test":"लेटेंसी टेस्ट","Check browser response time":"ब्राउज़र प्रतिक्रिया समय जाँचें","Wi-Fi Test":"वाई-फ़ाई टेस्ट","Test your Wi-Fi performance":"अपने वाई-फ़ाई का प्रदर्शन जाँचें","More Tools":"और टूल","Explore all network tools":"सभी नेटवर्क टूल देखें","TEZZ INTERNET DOCTOR":"TEZZ इंटरनेट डॉक्टर","Find out what is slowing you down.":"जानें कि आपका इंटरनेट धीमा क्यों है।","Use your latest speed test and browser network signals to identify likely connection issues.":"संभावित कनेक्शन समस्याओं की पहचान के लिए अपने नवीनतम स्पीड टेस्ट और ब्राउज़र नेटवर्क संकेतों का उपयोग करें।","DIAGNOSTIC STATUS":"जाँच की स्थिति","Awaiting test":"टेस्ट का इंतज़ार है","Run the speed test first. The Doctor will use those measurements to tailor its recommendations.":"पहले स्पीड टेस्ट चलाएँ। डॉक्टर उन्हीं मापों के आधार पर सुझाव देगा।","Test running…":"टेस्ट चल रहा है…","Run speed test":"स्पीड टेस्ट चलाएँ","PERSONALISED TROUBLESHOOTING":"आपकी समस्या के अनुसार समाधान","Recommended next steps":"अगले सुझाए गए कदम","Run new test":"नया टेस्ट चलाएँ","Priority":"प्राथमिकता","Suggested":"सुझाव","Next step":"अगला कदम","Latency and response variation here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.":"यहाँ लेटेंसी और प्रतिक्रिया में बदलाव ब्राउज़र के HTTP माप हैं, ICMP ping नहीं। ये शुरुआती संकेत हैं, लाइन की खराबी का अंतिम निदान नहीं। Wi-Fi सिग्नल, डिवाइस के लोड, सर्वर की दूरी और ISP रूटिंग से परिणाम बदल सकते हैं।","TEZZ NETWORK INTELLIGENCE":"TEZZ नेटवर्क जानकारी","Understand your connection.":"अपने कनेक्शन को समझें।","Run independent response-time checks and review the network information your browser makes available.":"स्वतंत्र प्रतिक्रिया-समय जाँचें और ब्राउज़र द्वारा उपलब्ध कराई गई नेटवर्क जानकारी देखें।","INTERNET REACHABILITY":"इंटरनेट उपलब्धता","Browser reports online":"ब्राउज़र के अनुसार ऑनलाइन","Browser reports offline":"ब्राउज़र के अनुसार ऑफलाइन","Your device reports an active network connection. This does not guarantee that every website is reachable.":"आपका डिवाइस सक्रिय नेटवर्क कनेक्शन दिखा रहा है। इसका मतलब यह नहीं कि हर वेबसाइट खुल पाएगी।","Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.":"आपका डिवाइस सक्रिय नेटवर्क कनेक्शन नहीं दिखा रहा। Wi-Fi या मोबाइल डेटा जाँचें और फिर से कनेक्ट करें।","Effective connection type":"प्रभावी कनेक्शन प्रकार","Estimated downlink":"अनुमानित डाउनलोड गति","Browser-reported RTT":"ब्राउज़र द्वारा बताई गई RTT","Data saver preference":"डेटा सेवर सेटिंग","Enabled":"चालू","Not requested":"अनुरोध नहीं किया गया","Not available":"उपलब्ध नहीं","INDEPENDENT NETWORK TEST":"स्वतंत्र नेटवर्क टेस्ट","HTTP Latency & Response Variation Test":"HTTP लेटेंसी और प्रतिक्रिया बदलाव टेस्ट","12 small HTTP requests to the TEZZ network edge. No large download or upload.":"TEZZ नेटवर्क एज को 12 छोटे HTTP अनुरोध। कोई बड़ा डाउनलोड या अपलोड नहीं।","AVERAGE HTTP RESPONSE TIME":"औसत HTTP प्रतिक्रिया समय","Minimum":"न्यूनतम","Maximum":"अधिकतम","HTTP response variation":"HTTP प्रतिक्रिया बदलाव","Failed requests":"असफल अनुरोध","RESPONSE CONSISTENCY":"प्रतिक्रिया स्थिरता","Consistent response times":"स्थिर प्रतिक्रिया समय","Some response-time variation":"प्रतिक्रिया समय में कुछ बदलाव","Highly variable response times":"प्रतिक्रिया समय में बहुत बदलाव","Start latency test":"लेटेंसी टेस्ट शुरू करें","Run again":"फिर से चलाएँ","Testing connection…":"कनेक्शन जाँचा जा रहा है…","LIVE CONNECTION MONITOR":"लाइव कनेक्शन मॉनिटर","Connection Stability Monitor":"कनेक्शन स्थिरता मॉनिटर","Successful samples":"सफल नमूने","Average response":"औसत प्रतिक्रिया","Highest response":"सबसे अधिक प्रतिक्रिया","95th percentile":"95वाँ पर्सेंटाइल","Start 30-second monitor":"30 सेकंड मॉनिटर शुरू करें","Run monitor again":"मॉनिटर फिर चलाएँ","TEZZ CONNECTION HEALTH INDEX":"TEZZ कनेक्शन हेल्थ इंडेक्स","Wi-Fi signal strength":"Wi-Fi सिग्नल की ताकत","Router / gateway details":"राउटर / गेटवे विवरण","Not exposed by standard browser APIs":"मानक ब्राउज़र API यह जानकारी नहीं देते","Not exposed to this webpage":"इस वेबपेज को उपलब्ध नहीं"},"mr":{"INTERNET SPEED TEST":"इंटरनेट स्पीड टेस्ट","Free Internet ":"मोफत इंटरनेट ","Speed Test":"स्पीड टेस्ट","Check download, upload, HTTP latency and response variation in seconds.":"डाउनलोड, अपलोड, HTTP लेटन्सी आणि प्रतिसादातील बदल काही सेकंदांत तपासा.","Sustained streaming download · client-timed, server-confirmed upload":"सतत डाउनलोड मापन · ब्राउझरने वेळ मोजलेला, सर्व्हरने पुष्टी केलेला अपलोड","HTTP latency, response variation & stability":"HTTP लेटन्सी, प्रतिसादातील बदल आणि स्थिरता","Gaming & streaming readiness":"गेमिंग आणि स्ट्रीमिंगची तयारी","Free, instant results":"मोफत आणि त्वरित निकाल","UPLOAD":"अपलोड","DOWNLOAD":"डाउनलोड","DOWNLOAD SPEED":"डाउनलोड वेग","TESTING":"चाचणी सुरू","MEASURED":"मोजले","READY":"तयार","Live measurement in progress":"थेट मापन सुरू आहे","Latest download measurement":"नवीनतम डाउनलोड मापन","Your connection speed, measured live":"तुमच्या कनेक्शनचा वेग थेट मोजला जात आहे","TEST IN PROGRESS":"चाचणी सुरू आहे","START SPEED TEST":"स्पीड टेस्ट सुरू करा","Internet Connection Health Check":"इंटरनेट कनेक्शनची स्थिती तपासा","Download":"डाउनलोड","Upload":"अपलोड","HTTP latency":"HTTP लेटन्सी","HTTP variation":"HTTP प्रतिसादातील बदल","HELP BUILD A BETTER INTERNET PICTURE":"इंटरनेटचे अधिक चांगले चित्र तयार करण्यात मदत करा","Contribute to global benchmarks":"जागतिक बेंचमार्कमध्ये योगदान द्या","Optional. When enabled, a completed speed test shares only download, upload, browser HTTP latency, response variation, and coarse country/region with TEZZ CONNECT. We store hourly regional aggregates—not individual test records, IP addresses, device IDs, or precise location. Public comparisons appear only after at least 30 contributions in a region. HTTP latency is measured to the TEZZ CONNECT edge, not your ISP's full network.":"हे ऐच्छिक आहे. सुरू केल्यास पूर्ण झालेल्या स्पीड टेस्टमधील डाउनलोड, अपलोड, ब्राउझर HTTP लेटन्सी, प्रतिसादातील बदल आणि साधारण देश/प्रदेशाची माहितीच TEZZ CONNECT सोबत शेअर केली जाते. आम्ही वैयक्तिक टेस्ट रेकॉर्ड, IP पत्ते, डिव्हाइस ID किंवा अचूक स्थान साठवत नाही; फक्त तासानुसार एकत्रित प्रादेशिक आकडे ठेवतो. एखाद्या प्रदेशात किमान ३० योगदान मिळाल्यावरच सार्वजनिक तुलना दाखवली जाते. HTTP लेटन्सी TEZZ CONNECT एजपर्यंत मोजली जाते, तुमच्या ISP च्या संपूर्ण नेटवर्कपर्यंत नाही.","Yes, I agree to share anonymous aggregate measurements from my completed speed tests.":"माझ्या पूर्ण झालेल्या स्पीड टेस्टमधील अनामिक एकत्रित मोजमाप शेअर करण्यास मी सहमत आहे.","Opt-in is enabled.":"शेअर करण्याची संमती सुरू आहे.","Benchmark sharing is off by default.":"बेंचमार्क शेअरिंग डीफॉल्टने बंद आहे.","Find and fix internet problems":"इंटरनेट समस्या शोधा आणि सोडवा","Latency Test":"लेटन्सी चाचणी","Check browser response time":"ब्राउझर प्रतिसाद वेळ तपासा","Wi-Fi Test":"वाय-फाय चाचणी","Test your Wi-Fi performance":"तुमच्या वाय-फायची कार्यक्षमता तपासा","More Tools":"अधिक साधने","Explore all network tools":"सर्व नेटवर्क साधने पाहा","TEZZ INTERNET DOCTOR":"TEZZ इंटरनेट डॉक्टर","Find out what is slowing you down.":"तुमचे इंटरनेट कशामुळे मंदावते ते जाणून घ्या.","Use your latest speed test and browser network signals to identify likely connection issues.":"संभाव्य कनेक्शन समस्या ओळखण्यासाठी तुमची नवीनतम स्पीड टेस्ट आणि ब्राउझर नेटवर्क संकेत वापरा.","DIAGNOSTIC STATUS":"निदान स्थिती","Awaiting test":"चाचणीची प्रतीक्षा","Run the speed test first. The Doctor will use those measurements to tailor its recommendations.":"प्रथम स्पीड टेस्ट चालवा. त्या मोजमापांवरून डॉक्टर शिफारसी देईल.","Test running…":"चाचणी सुरू आहे…","Run speed test":"स्पीड टेस्ट चालवा","PERSONALISED TROUBLESHOOTING":"तुमच्या समस्येनुसार उपाय","Recommended next steps":"पुढील शिफारस केलेली पावले","Run new test":"नवीन चाचणी चालवा","Priority":"प्राधान्य","Suggested":"सूचना","Next step":"पुढील पाऊल","Latency and response variation here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.":"येथील लेटन्सी आणि प्रतिसादातील बदल हे ब्राउझरमधील HTTP मोजमाप आहेत; ICMP ping नाहीत. हे प्राथमिक संकेत आहेत, लाईनमधील बिघाडाचे अंतिम निदान नाही. Wi-Fi सिग्नल, डिव्हाइसवरील भार, सर्व्हरचे अंतर आणि ISP रूटिंगमुळे निकाल बदलू शकतात.","TEZZ NETWORK INTELLIGENCE":"TEZZ नेटवर्क माहिती","Understand your connection.":"तुमचे कनेक्शन समजून घ्या.","Run independent response-time checks and review the network information your browser makes available.":"स्वतंत्र प्रतिसाद-वेळ चाचण्या करा आणि ब्राउझरने उपलब्ध केलेली नेटवर्क माहिती पाहा.","INTERNET REACHABILITY":"इंटरनेट उपलब्धता","Browser reports online":"ब्राउझरनुसार ऑनलाइन","Browser reports offline":"ब्राउझरनुसार ऑफलाइन","Your device reports an active network connection. This does not guarantee that every website is reachable.":"तुमचे डिव्हाइस सक्रिय नेटवर्क कनेक्शन दाखवत आहे. याचा अर्थ प्रत्येक वेबसाइट उपलब्ध असेलच असे नाही.","Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.":"तुमचे डिव्हाइस सक्रिय नेटवर्क कनेक्शन दाखवत नाही. Wi-Fi किंवा मोबाइल डेटा तपासा आणि पुन्हा कनेक्ट करा.","Effective connection type":"प्रभावी कनेक्शन प्रकार","Estimated downlink":"अंदाजित डाउनलोड वेग","Browser-reported RTT":"ब्राउझरने नोंदवलेली RTT","Data saver preference":"डेटा सेव्हर प्राधान्य","Enabled":"सुरू","Not requested":"विनंती केलेली नाही","Not available":"उपलब्ध नाही","INDEPENDENT NETWORK TEST":"स्वतंत्र नेटवर्क चाचणी","HTTP Latency & Response Variation Test":"HTTP लेटन्सी आणि प्रतिसाद बदल चाचणी","12 small HTTP requests to the TEZZ network edge. No large download or upload.":"TEZZ नेटवर्क एजला 12 लहान HTTP विनंत्या. मोठे डाउनलोड किंवा अपलोड नाही.","AVERAGE HTTP RESPONSE TIME":"सरासरी HTTP प्रतिसाद वेळ","Minimum":"किमान","Maximum":"कमाल","HTTP response variation":"HTTP प्रतिसादातील बदल","Failed requests":"अयशस्वी विनंत्या","RESPONSE CONSISTENCY":"प्रतिसादातील सातत्य","Consistent response times":"सातत्यपूर्ण प्रतिसाद वेळ","Some response-time variation":"प्रतिसाद वेळेत काही बदल","Highly variable response times":"प्रतिसाद वेळेत मोठे बदल","Start latency test":"लेटन्सी चाचणी सुरू करा","Run again":"पुन्हा चालवा","Testing connection…":"कनेक्शन तपासत आहे…","LIVE CONNECTION MONITOR":"थेट कनेक्शन मॉनिटर","Connection Stability Monitor":"कनेक्शन स्थिरता मॉनिटर","Successful samples":"यशस्वी नमुने","Average response":"सरासरी प्रतिसाद","Highest response":"सर्वाधिक प्रतिसाद","95th percentile":"95वा पर्सेंटाइल","Start 30-second monitor":"30 सेकंद मॉनिटर सुरू करा","Run monitor again":"मॉनिटर पुन्हा चालवा","TEZZ CONNECTION HEALTH INDEX":"TEZZ कनेक्शन हेल्थ इंडेक्स","Wi-Fi signal strength":"Wi-Fi सिग्नलची ताकद","Router / gateway details":"राउटर / गेटवे तपशील","Not exposed by standard browser APIs":"मानक ब्राउझर API ही माहिती देत नाहीत","Not exposed to this webpage":"या वेबपेजला उपलब्ध नाही"},"bn":{"INTERNET SPEED TEST":"ইন্টারনেট স্পিড টেস্ট","Free Internet ":"বিনামূল্যে ইন্টারনেট ","Speed Test":"স্পিড টেস্ট","Check download, upload, HTTP latency and response variation in seconds.":"কয়েক সেকেন্ডে ডাউনলোড, আপলোড, HTTP ল্যাটেন্সি এবং প্রতিক্রিয়ার পরিবর্তন পরীক্ষা করুন।","Sustained streaming download · client-timed, server-confirmed upload":"ধারাবাহিক ডাউনলোড মাপ · ব্রাউজারে সময় গণনা, সার্ভারে নিশ্চিত আপলোড","HTTP latency, response variation & stability":"HTTP ল্যাটেন্সি, প্রতিক্রিয়ার পরিবর্তন ও স্থিতিশীলতা","Gaming & streaming readiness":"গেমিং ও স্ট্রিমিং প্রস্তুতি","Free, instant results":"বিনামূল্যে তাৎক্ষণিক ফলাফল","UPLOAD":"আপলোড","DOWNLOAD":"ডাউনলোড","DOWNLOAD SPEED":"ডাউনলোড গতি","TESTING":"পরীক্ষা চলছে","MEASURED":"পরিমাপ করা হয়েছে","READY":"প্রস্তুত","Live measurement in progress":"লাইভ পরিমাপ চলছে","Latest download measurement":"সর্বশেষ ডাউনলোড পরিমাপ","Your connection speed, measured live":"আপনার সংযোগের গতি সরাসরি মাপা হচ্ছে","TEST IN PROGRESS":"পরীক্ষা চলছে","START SPEED TEST":"স্পিড টেস্ট শুরু করুন","Internet Connection Health Check":"ইন্টারনেট সংযোগের স্বাস্থ্য পরীক্ষা","Download":"ডাউনলোড","Upload":"আপলোড","HTTP latency":"HTTP ল্যাটেন্সি","HTTP variation":"HTTP প্রতিক্রিয়ার পরিবর্তন","HELP BUILD A BETTER INTERNET PICTURE":"আরও ভালো ইন্টারনেট চিত্র গড়তে সাহায্য করুন","Contribute to global benchmarks":"বিশ্বব্যাপী বেঞ্চমার্কে অবদান রাখুন","Optional. When enabled, a completed speed test shares only download, upload, browser HTTP latency, response variation, and coarse country/region with TEZZ CONNECT. We store hourly regional aggregates—not individual test records, IP addresses, device IDs, or precise location. Public comparisons appear only after at least 30 contributions in a region. HTTP latency is measured to the TEZZ CONNECT edge, not your ISP's full network.":"এটি ঐচ্ছিক। চালু করলে সম্পন্ন স্পিড টেস্ট থেকে শুধু ডাউনলোড, আপলোড, ব্রাউজার HTTP ল্যাটেন্সি, প্রতিক্রিয়ার পরিবর্তন এবং আনুমানিক দেশ/অঞ্চলের তথ্য TEZZ CONNECT-এর সঙ্গে ভাগ করা হয়। আমরা ব্যক্তিগত টেস্ট রেকর্ড, IP ঠিকানা, ডিভাইস ID বা সঠিক অবস্থান সংরক্ষণ করি না; ঘণ্টাভিত্তিক আঞ্চলিক সমষ্টিগত তথ্য রাখি। কোনো অঞ্চলে অন্তত ৩০টি অবদান না হলে প্রকাশ্য তুলনা দেখানো হয় না। HTTP ল্যাটেন্সি TEZZ CONNECT edge পর্যন্ত মাপা হয়, আপনার ISP-এর সম্পূর্ণ নেটওয়ার্ক পর্যন্ত নয়।","Yes, I agree to share anonymous aggregate measurements from my completed speed tests.":"আমার সম্পন্ন স্পিড টেস্টের বেনামী সমষ্টিগত পরিমাপ ভাগ করতে আমি সম্মত।","Opt-in is enabled.":"শেয়ার করার সম্মতি চালু আছে।","Benchmark sharing is off by default.":"বেঞ্চমার্ক শেয়ারিং ডিফল্টভাবে বন্ধ।","Find and fix internet problems":"ইন্টারনেটের সমস্যা খুঁজুন ও সমাধান করুন","Latency Test":"ল্যাটেন্সি পরীক্ষা","Check browser response time":"ব্রাউজারের প্রতিক্রিয়ার সময় পরীক্ষা করুন","Wi-Fi Test":"ওয়াই-ফাই পরীক্ষা","Test your Wi-Fi performance":"আপনার ওয়াই-ফাই কর্মক্ষমতা পরীক্ষা করুন","More Tools":"আরও টুল","Explore all network tools":"সব নেটওয়ার্ক টুল দেখুন","TEZZ INTERNET DOCTOR":"TEZZ ইন্টারনেট ডাক্তার","Find out what is slowing you down.":"আপনার ইন্টারনেটের গতি কমার কারণ খুঁজে বের করুন।","Use your latest speed test and browser network signals to identify likely connection issues.":"সম্ভাব্য সংযোগ সমস্যা শনাক্ত করতে আপনার সর্বশেষ স্পিড টেস্ট ও ব্রাউজারের নেটওয়ার্ক সংকেত ব্যবহার করুন।","DIAGNOSTIC STATUS":"ডায়াগনস্টিক অবস্থা","Awaiting test":"পরীক্ষার অপেক্ষায়","Run the speed test first. The Doctor will use those measurements to tailor its recommendations.":"প্রথমে স্পিড টেস্ট চালান। সেই পরিমাপের ভিত্তিতে ডক্টর পরামর্শ দেবে।","Test running…":"পরীক্ষা চলছে…","Run speed test":"স্পিড টেস্ট চালান","PERSONALISED TROUBLESHOOTING":"আপনার সমস্যার উপযোগী সমাধান","Recommended next steps":"প্রস্তাবিত পরবর্তী পদক্ষেপ","Run new test":"নতুন পরীক্ষা চালান","Priority":"অগ্রাধিকার","Suggested":"প্রস্তাবিত","Next step":"পরবর্তী পদক্ষেপ","Latency and response variation here are browser HTTP measurements, not ICMP ping. These are first-pass indicators, not a definitive line fault diagnosis. Results can vary with Wi-Fi signal, device load, server distance and ISP routing.":"এখানে ল্যাটেন্সি ও প্রতিক্রিয়ার পরিবর্তন ব্রাউজারের HTTP পরিমাপ, ICMP পিং নয়। এগুলি প্রাথমিক ইঙ্গিত, লাইনের ত্রুটির চূড়ান্ত নির্ণয় নয়। Wi-Fi সিগন্যাল, ডিভাইসের চাপ, সার্ভারের দূরত্ব ও ISP রাউটিংয়ের কারণে ফল বদলাতে পারে।","TEZZ NETWORK INTELLIGENCE":"TEZZ নেটওয়ার্ক তথ্য","Understand your connection.":"আপনার সংযোগ বুঝুন।","Run independent response-time checks and review the network information your browser makes available.":"স্বাধীন প্রতিক্রিয়ার সময় পরীক্ষা করুন এবং ব্রাউজার যে নেটওয়ার্ক তথ্য দেয় তা দেখুন।","INTERNET REACHABILITY":"ইন্টারনেট সংযোগযোগ্যতা","Browser reports online":"ব্রাউজার অনুযায়ী অনলাইন","Browser reports offline":"ব্রাউজার অনুযায়ী অফলাইন","Your device reports an active network connection. This does not guarantee that every website is reachable.":"আপনার ডিভাইস সক্রিয় নেটওয়ার্ক সংযোগ দেখাচ্ছে। এর অর্থ এই নয় যে প্রতিটি ওয়েবসাইটে পৌঁছানো যাবে।","Your device reports no active network connection. Check Wi-Fi or mobile data, then reconnect.":"আপনার ডিভাইস সক্রিয় নেটওয়ার্ক সংযোগ দেখাচ্ছে না। Wi-Fi বা মোবাইল ডেটা পরীক্ষা করে আবার সংযোগ করুন।","Effective connection type":"কার্যকর সংযোগের ধরন","Estimated downlink":"আনুমানিক ডাউনলিংক","Browser-reported RTT":"ব্রাউজার-প্রদত্ত RTT","Data saver preference":"ডেটা সেভার পছন্দ","Enabled":"সক্রিয়","Not requested":"অনুরোধ করা হয়নি","Not available":"পাওয়া যায়নি","INDEPENDENT NETWORK TEST":"স্বাধীন নেটওয়ার্ক পরীক্ষা","HTTP Latency & Response Variation Test":"HTTP ল্যাটেন্সি ও প্রতিক্রিয়া পরিবর্তন পরীক্ষা","12 small HTTP requests to the TEZZ network edge. No large download or upload.":"TEZZ নেটওয়ার্ক এজে ১২টি ছোট HTTP অনুরোধ। বড় ডাউনলোড বা আপলোড নয়।","AVERAGE HTTP RESPONSE TIME":"গড় HTTP প্রতিক্রিয়া সময়","Minimum":"সর্বনিম্ন","Maximum":"সর্বোচ্চ","HTTP response variation":"HTTP প্রতিক্রিয়ার পরিবর্তন","Failed requests":"ব্যর্থ অনুরোধ","RESPONSE CONSISTENCY":"প্রতিক্রিয়ার ধারাবাহিকতা","Consistent response times":"স্থিতিশীল প্রতিক্রিয়ার সময়","Some response-time variation":"প্রতিক্রিয়ার সময়ে কিছু পরিবর্তন","Highly variable response times":"প্রতিক্রিয়ার সময়ে বড় পরিবর্তন","Start latency test":"ল্যাটেন্সি পরীক্ষা শুরু করুন","Run again":"আবার চালান","Testing connection…":"সংযোগ পরীক্ষা চলছে…","LIVE CONNECTION MONITOR":"লাইভ সংযোগ মনিটর","Connection Stability Monitor":"সংযোগ স্থিতিশীলতা মনিটর","Successful samples":"সফল নমুনা","Average response":"গড় প্রতিক্রিয়া","Highest response":"সর্বোচ্চ প্রতিক্রিয়া","95th percentile":"৯৫তম পার্সেন্টাইল","Start 30-second monitor":"৩০ সেকেন্ডের মনিটর শুরু করুন","Run monitor again":"মনিটর আবার চালান","TEZZ CONNECTION HEALTH INDEX":"TEZZ সংযোগ স্বাস্থ্য সূচক","Wi-Fi signal strength":"Wi-Fi সিগন্যালের শক্তি","Router / gateway details":"রাউটার / গেটওয়ে বিবরণ","Not exposed by standard browser APIs":"সাধারণ ব্রাউজার API এই তথ্য দেয় না","Not exposed to this webpage":"এই ওয়েবপেজে প্রকাশ করা হয় না"},"zh-CN":{},"pt-BR":{},"es":{},"fr":{},"ar":{}}
;

const EXTRA_SPEED_COPY: Record<string, Record<string, string>> = {"hi":{"TEZZ GLOBAL NETWORK INTELLIGENCE":"TEZZ वैश्विक नेटवर्क जानकारी","See the network edge serving your test.":"देखें कि आपका टेस्ट किस नेटवर्क एज से जुड़ता है।","See the approximate location serving this test, separately from your own network region.":"इस अनुरोध को संभालने वाले Cloudflare डेटा सेंटर और स्रोत नेटवर्क के अनुमानित देश व क्षेत्र को अलग-अलग देखें।","CURRENT TEZZ EDGE":"वर्तमान TEZZ एज","Identifying edge…":"एज की पहचान हो रही है…","Edge information not loaded":"एज की जानकारी लोड नहीं हुई","Cloudflare data centre (colo)":"Cloudflare डेटा सेंटर (colo)","Source country (IP geolocation)":"स्रोत देश (IP जियोलोकेशन)","Source region (IP geolocation)":"स्रोत क्षेत्र (IP जियोलोकेशन)","Source network ASN":"स्रोत नेटवर्क ASN","Source network operator (ASN name)":"स्रोत नेटवर्क ऑपरेटर (ASN नाम)","Refresh edge details":"एज विवरण रीफ़्रेश करें","WHAT THIS TELLS YOU":"इससे क्या पता चलता है","Your request reaches TEZZ through this edge.":"आपका अनुरोध इसी एज के ज़रिए TEZZ तक पहुँचता है।","Your browser":"आपका ब्राउज़र","Current device and network":"वर्तमान डिवाइस और नेटवर्क","Cloudflare data centre":"Cloudflare डेटा सेंटर","TEZZ service":"TEZZ सेवा","Speed-test endpoint":"स्पीड टेस्ट एंडपॉइंट","COMMUNITY NETWORK BENCHMARKS":"कम्युनिटी नेटवर्क बेंचमार्क","Regional performance overview":"क्षेत्रीय प्रदर्शन का अवलोकन","Refresh data":"डेटा रीफ़्रेश करें","Reporting window: last 7 days":"रिपोर्ट अवधि: पिछले 7 दिन","Publication threshold: 30 contributions per region":"प्रकाशन सीमा: प्रति क्षेत्र 30 योगदान","YOUR LOCAL TEST RECORDS":"आपके स्थानीय टेस्ट रिकॉर्ड","Internet speed test history.":"इंटरनेट स्पीड टेस्ट का इतिहास।","Review your recent download, upload, HTTP latency and response variation measurements saved in this browser.":"इस ब्राउज़र में सेव किए गए हाल के डाउनलोड, अपलोड, HTTP लेटेंसी और प्रतिक्रिया बदलाव के माप देखें।","Saved tests":"सेव किए गए टेस्ट","Storage":"स्टोरेज","This browser only":"केवल यह ब्राउज़र","Retention":"रिकॉर्ड अवधि","Up to 50 tests":"अधिकतम 50 टेस्ट","No saved tests yet. Run a speed test to build your history.":"अभी कोई टेस्ट सेव नहीं है। इतिहास बनाने के लिए स्पीड टेस्ट चलाएँ।","Date & time":"तारीख और समय","NETWORK RESPONSE RECORDS":"नेटवर्क प्रतिक्रिया रिकॉर्ड","Latency test history":"लेटेंसी टेस्ट इतिहास","Compare independent response-time tests saved on this device.":"इस डिवाइस पर सेव किए गए स्वतंत्र प्रतिक्रिया-समय टेस्ट की तुलना करें।","No latency tests saved yet. Run a test from Tools to start tracking response consistency.":"अभी कोई लेटेंसी टेस्ट सेव नहीं है। प्रतिक्रिया स्थिरता ट्रैक करने के लिए टूल्स से टेस्ट चलाएँ।","CONNECTION CONSISTENCY RECORDS":"कनेक्शन स्थिरता रिकॉर्ड","Stability monitor history":"स्थिरता मॉनिटर इतिहास","Review completed 30-sample monitoring sessions saved on this device.":"इस डिवाइस पर सेव किए गए 30-सैंपल मॉनिटरिंग सत्र देखें।","No stability sessions saved yet. Run the Connection Stability Monitor in Tools to start tracking.":"अभी कोई स्थिरता सत्र सेव नहीं है। ट्रैकिंग शुरू करने के लिए टूल्स में कनेक्शन स्थिरता मॉनिटर चलाएँ।","TEZZ CONNECT PERFORMANCE SUMMARY":"TEZZ CONNECT प्रदर्शन सारांश","Your internet performance report.":"आपके इंटरनेट प्रदर्शन की रिपोर्ट।","A combined view of your latest speed, latency and connection stability measurements saved in this browser.":"इस ब्राउज़र में सेव किए गए नवीनतम गति, लेटेंसी और कनेक्शन स्थिरता मापों का संयुक्त दृश्य।","Generated":"बनाया गया","Local browser data · Private":"स्थानीय ब्राउज़र डेटा · निजी","AT A GLANCE":"एक नज़र में","Speed":"गति","Latency":"लेटेंसी","Stability":"स्थिरता","Recent performance trend":"हाल के प्रदर्शन का रुझान","Latest saved measurements on this device. Compare sessions over time; different test types are shown separately.":"इस डिवाइस पर सेव किए गए नवीनतम माप। समय के साथ सत्रों की तुलना करें; अलग-अलग टेस्ट प्रकार अलग दिखाए गए हैं।","Copy full report":"पूरी रिपोर्ट कॉपी करें","Download PDF":"PDF डाउनलोड करें"},"mr":{"TEZZ GLOBAL NETWORK INTELLIGENCE":"TEZZ जागतिक नेटवर्क माहिती","See the network edge serving your test.":"तुमची चाचणी कोणत्या नेटवर्क एजद्वारे हाताळली जाते ते पाहा.","See the TEZZ connection point handling this test, with your internet provider and approximate area shown separately.":"ही विनंती हाताळणारे Cloudflare डेटा सेंटर आणि स्रोत नेटवर्कचा अंदाजे देश व प्रदेश स्वतंत्रपणे पाहा.","CURRENT TEZZ EDGE":"सध्याचा TEZZ एज","Identifying edge…":"एज ओळखत आहे…","Edge information not loaded":"एजची माहिती लोड झालेली नाही","Cloudflare data centre (colo)":"Cloudflare डेटा सेंटर (colo)","Source country (IP geolocation)":"स्रोत देश (IP स्थान)","Source region (IP geolocation)":"स्रोत प्रदेश (IP स्थान)","Source network ASN":"स्रोत नेटवर्क ASN","Source network operator (ASN name)":"स्रोत नेटवर्क ऑपरेटर (ASN नाव)","Refresh edge details":"एज तपशील रिफ्रेश करा","WHAT THIS TELLS YOU":"यातून काय समजते","Your request reaches TEZZ through this edge.":"तुमची विनंती या एजद्वारे TEZZ पर्यंत पोहोचते.","Your browser":"तुमचा ब्राउझर","Current device and network":"सध्याचे डिव्हाइस आणि नेटवर्क","Cloudflare data centre":"Cloudflare डेटा सेंटर","TEZZ service":"TEZZ सेवा","Speed-test endpoint":"स्पीड टेस्ट एंडपॉइंट","COMMUNITY NETWORK BENCHMARKS":"समुदाय नेटवर्क बेंचमार्क","Regional performance overview":"प्रादेशिक कामगिरीचा आढावा","Refresh data":"डेटा रिफ्रेश करा","Reporting window: last 7 days":"अहवाल कालावधी: मागील 7 दिवस","Publication threshold: 30 contributions per region":"प्रकाशन मर्यादा: प्रत्येक प्रदेशासाठी 30 योगदान","YOUR LOCAL TEST RECORDS":"तुमच्या स्थानिक चाचणी नोंदी","Internet speed test history.":"इंटरनेट स्पीड टेस्टचा इतिहास.","Review your recent download, upload, HTTP latency and response variation measurements saved in this browser.":"या ब्राउझरमध्ये जतन केलेली अलीकडील डाउनलोड, अपलोड, HTTP लेटन्सी आणि प्रतिसादातील बदलांची मोजमापे पाहा.","Saved tests":"जतन केलेल्या चाचण्या","Storage":"स्टोरेज","This browser only":"फक्त हा ब्राउझर","Retention":"नोंदींचा कालावधी","Up to 50 tests":"कमाल 50 चाचण्या","No saved tests yet. Run a speed test to build your history.":"अजून चाचण्या जतन केलेल्या नाहीत. इतिहास तयार करण्यासाठी स्पीड टेस्ट चालवा.","Date & time":"दिनांक आणि वेळ","NETWORK RESPONSE RECORDS":"नेटवर्क प्रतिसाद नोंदी","Latency test history":"लेटन्सी चाचणी इतिहास","Compare independent response-time tests saved on this device.":"या डिव्हाइसवर जतन केलेल्या स्वतंत्र प्रतिसाद-वेळ चाचण्यांची तुलना करा.","No latency tests saved yet. Run a test from Tools to start tracking response consistency.":"अजून लेटन्सी चाचण्या जतन केलेल्या नाहीत. प्रतिसादातील सातत्य नोंदवण्यासाठी Tools मधून चाचणी चालवा.","CONNECTION CONSISTENCY RECORDS":"कनेक्शन स्थिरता नोंदी","Stability monitor history":"स्थिरता मॉनिटर इतिहास","Review completed 30-sample monitoring sessions saved on this device.":"या डिव्हाइसवर जतन केलेली पूर्ण झालेली 30-सॅम्पल मॉनिटरिंग सत्रे पाहा.","No stability sessions saved yet. Run the Connection Stability Monitor in Tools to start tracking.":"अजून स्थिरता सत्रे जतन केलेली नाहीत. नोंद सुरू करण्यासाठी Tools मधील Connection Stability Monitor चालवा.","TEZZ CONNECT PERFORMANCE SUMMARY":"TEZZ CONNECT कामगिरी सारांश","Your internet performance report.":"तुमचा इंटरनेट कामगिरी अहवाल.","A combined view of your latest speed, latency and connection stability measurements saved in this browser.":"या ब्राउझरमध्ये जतन केलेल्या नवीनतम वेग, लेटन्सी आणि कनेक्शन स्थिरता मोजमापांचा एकत्रित आढावा.","Generated":"तयार केले","Local browser data · Private":"स्थानिक ब्राउझर डेटा · खाजगी","AT A GLANCE":"एका नजरेत","Speed":"वेग","Latency":"लेटन्सी","Stability":"स्थिरता","Recent performance trend":"अलीकडील कामगिरीचा कल","Latest saved measurements on this device. Compare sessions over time; different test types are shown separately.":"या डिव्हाइसवरील नवीनतम जतन केलेली मोजमापे. वेगवेगळ्या सत्रांची तुलना करा; चाचणीचे प्रकार स्वतंत्र दाखवले आहेत.","Copy full report":"संपूर्ण अहवाल कॉपी करा","Download PDF":"PDF डाउनलोड करा"},"bn":{"TEZZ GLOBAL NETWORK INTELLIGENCE":"TEZZ গ্লোবাল নেটওয়ার্ক তথ্য","See the network edge serving your test.":"আপনার পরীক্ষা কোন নেটওয়ার্ক এজের মাধ্যমে পরিচালিত হচ্ছে দেখুন।","See the TEZZ connection point handling this test, with your internet provider and approximate area shown separately.":"এই অনুরোধ পরিচালনাকারী Cloudflare ডেটা সেন্টার এবং উৎস নেটওয়ার্কের আনুমানিক দেশ ও অঞ্চল আলাদাভাবে দেখুন।","CURRENT TEZZ EDGE":"বর্তমান TEZZ এজ","Identifying edge…":"এজ শনাক্ত করা হচ্ছে…","Edge information not loaded":"এজের তথ্য লোড হয়নি","Cloudflare data centre (colo)":"Cloudflare ডেটা সেন্টার (colo)","Source country (IP geolocation)":"উৎস দেশ (IP অবস্থান)","Source region (IP geolocation)":"উৎস অঞ্চল (IP অবস্থান)","Source network ASN":"উৎস নেটওয়ার্ক ASN","Source network operator (ASN name)":"উৎস নেটওয়ার্ক অপারেটর (ASN নাম)","Refresh edge details":"এজের বিবরণ রিফ্রেশ করুন","WHAT THIS TELLS YOU":"এতে কী বোঝা যায়","Your request reaches TEZZ through this edge.":"আপনার অনুরোধ এই এজের মাধ্যমে TEZZ-এ পৌঁছায়।","Your browser":"আপনার ব্রাউজার","Current device and network":"বর্তমান ডিভাইস ও নেটওয়ার্ক","Cloudflare data centre":"Cloudflare ডেটা সেন্টার","TEZZ service":"TEZZ পরিষেবা","Speed-test endpoint":"স্পিড টেস্ট এন্ডপয়েন্ট","COMMUNITY NETWORK BENCHMARKS":"কমিউনিটি নেটওয়ার্ক বেঞ্চমার্ক","Regional performance overview":"আঞ্চলিক পারফরম্যান্সের সারাংশ","Refresh data":"ডেটা রিফ্রেশ করুন","Reporting window: last 7 days":"রিপোর্টের সময়সীমা: গত ৭ দিন","Publication threshold: 30 contributions per region":"প্রকাশের সীমা: প্রতি অঞ্চলে ৩০টি অবদান","YOUR LOCAL TEST RECORDS":"আপনার স্থানীয় পরীক্ষার রেকর্ড","Internet speed test history.":"ইন্টারনেট স্পিড টেস্টের ইতিহাস।","Review your recent download, upload, HTTP latency and response variation measurements saved in this browser.":"এই ব্রাউজারে সংরক্ষিত সাম্প্রতিক ডাউনলোড, আপলোড, HTTP ল্যাটেন্সি ও প্রতিক্রিয়ার পরিবর্তনের পরিমাপ দেখুন।","Saved tests":"সংরক্ষিত পরীক্ষা","Storage":"স্টোরেজ","This browser only":"শুধু এই ব্রাউজার","Retention":"সংরক্ষণের সীমা","Up to 50 tests":"সর্বোচ্চ ৫০টি পরীক্ষা","No saved tests yet. Run a speed test to build your history.":"এখনও কোনো পরীক্ষা সংরক্ষিত নেই। ইতিহাস তৈরি করতে স্পিড টেস্ট চালান।","Date & time":"তারিখ ও সময়","NETWORK RESPONSE RECORDS":"নেটওয়ার্ক প্রতিক্রিয়ার রেকর্ড","Latency test history":"ল্যাটেন্সি পরীক্ষার ইতিহাস","Compare independent response-time tests saved on this device.":"এই ডিভাইসে সংরক্ষিত স্বতন্ত্র প্রতিক্রিয়া-সময়ের পরীক্ষাগুলি তুলনা করুন।","No latency tests saved yet. Run a test from Tools to start tracking response consistency.":"এখনও কোনো ল্যাটেন্সি পরীক্ষা সংরক্ষিত নেই। প্রতিক্রিয়ার ধারাবাহিকতা ট্র্যাক করতে Tools থেকে পরীক্ষা চালান।","CONNECTION CONSISTENCY RECORDS":"সংযোগের স্থিতিশীলতার রেকর্ড","Stability monitor history":"স্থিতিশীলতা মনিটরের ইতিহাস","Review completed 30-sample monitoring sessions saved on this device.":"এই ডিভাইসে সংরক্ষিত সম্পূর্ণ ৩০-নমুনার মনিটরিং সেশন দেখুন।","No stability sessions saved yet. Run the Connection Stability Monitor in Tools to start tracking.":"এখনও কোনো স্থিতিশীলতা সেশন সংরক্ষিত নেই। ট্র্যাকিং শুরু করতে Tools-এ Connection Stability Monitor চালান।","TEZZ CONNECT PERFORMANCE SUMMARY":"TEZZ CONNECT পারফরম্যান্স সারাংশ","Your internet performance report.":"আপনার ইন্টারনেট পারফরম্যান্স রিপোর্ট।","A combined view of your latest speed, latency and connection stability measurements saved in this browser.":"এই ব্রাউজারে সংরক্ষিত সর্বশেষ গতি, ল্যাটেন্সি ও সংযোগের স্থিতিশীলতার পরিমাপের সম্মিলিত দৃশ্য।","Generated":"তৈরি হয়েছে","Local browser data · Private":"স্থানীয় ব্রাউজার ডেটা · ব্যক্তিগত","AT A GLANCE":"এক নজরে","Speed":"গতি","Latency":"ল্যাটেন্সি","Stability":"স্থিতিশীলতা","Recent performance trend":"সাম্প্রতিক পারফরম্যান্সের প্রবণতা","Latest saved measurements on this device. Compare sessions over time; different test types are shown separately.":"এই ডিভাইসে সংরক্ষিত সর্বশেষ পরিমাপ। সময়ের সঙ্গে সেশন তুলনা করুন; বিভিন্ন পরীক্ষার ধরন আলাদাভাবে দেখানো হয়েছে।","Copy full report":"সম্পূর্ণ রিপোর্ট কপি করুন","Download PDF":"PDF ডাউনলোড করুন"},"zh-CN":{},"pt-BR":{},"es":{},"fr":{},"ar":{}}

let activeLocaleBundle: Record<string, unknown> = {}
function speedText(language: UiLanguage, text: string): string { const bundled = activeLocaleBundle[text]; return (typeof bundled === 'string' ? bundled : undefined) ?? EXTRA_SPEED_COPY[language]?.[text] ?? SPEED_COPY[language]?.[text] ?? text }

const UI_COPY: Record<UiLanguage, string[]> = {"en":["Home","Free Speed Test","Internet Doctor","Network Tools","Global Network","Test History","Performance Report","About TEZZ CONNECT","Language"],"hi":["होम","मुफ़्त स्पीड टेस्ट","इंटरनेट डॉक्टर","नेटवर्क टूल","ग्लोबल नेटवर्क","टेस्ट इतिहास","प्रदर्शन रिपोर्ट","TEZZ CONNECT के बारे में","भाषा"],"mr":["मुख्यपृष्ठ","मोफत स्पीड टेस्ट","इंटरनेट डॉक्टर","नेटवर्क साधने","जागतिक नेटवर्क","चाचणी इतिहास","कामगिरी अहवाल","TEZZ CONNECT बद्दल","भाषा"],"bn":["হোম","বিনামূল্যে স্পিড টেস্ট","ইন্টারনেট ডাক্তার","নেটওয়ার্ক টুল","বিশ্ব নেটওয়ার্ক","পরীক্ষার ইতিহাস","পারফরম্যান্স রিপোর্ট","TEZZ CONNECT সম্পর্কে","ভাষা"],"zh-CN":["首页","免费网速测试","网络诊断助手","网络工具","全球网络","测试历史","性能报告","关于 TEZZ CONNECT","语言"],"pt-BR":["Início","Teste de velocidade grátis","Diagnóstico da internet","Ferramentas de rede","Rede global","Histórico de testes","Relatório de desempenho","Sobre a TEZZ CONNECT","Idioma"],"es":["Inicio","Prueba de velocidad gratis","Diagnóstico de internet","Herramientas de red","Red global","Historial de pruebas","Informe de rendimiento","Acerca de TEZZ CONNECT","Idioma"],"fr":["Accueil","Test de débit gratuit","Diagnostic Internet","Outils réseau","Réseau mondial","Historique des tests","Rapport de performances","À propos de TEZZ CONNECT","Langue"],"ar":["الرئيسية","اختبار سرعة مجاني","طبيب الإنترنت","أدوات الشبكة","الشبكة العالمية","سجل الاختبارات","تقرير الأداء","حول TEZZ CONNECT","اللغة"]}


const LOCALE_CODES: UiLanguage[] = ['en']
function localeFromPath(_pathname: string): UiLanguage | null { return null }
function stripLocalePrefix(pathname: string): string {
  return pathname.replace(/^\/(?:hi|mr|bn|zh-CN|pt-BR|es|fr|ar)(?=\/|$)/, '') || '/'
}
function localizedPath(_locale: UiLanguage, basePath: string): string { return basePath.startsWith('/') ? basePath : `/${basePath}` }
function countryLocale(_country: string): UiLanguage { return 'en' }
function browserLocale(): UiLanguage { return 'en' }
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
  const [language, setLanguage] = useState<UiLanguage>('en')
  const [localeBundle, setLocaleBundle] = useState<Record<string, unknown>>({})

  const copy = UI_COPY[language] ?? UI_COPY.en
  function changeLanguage(_next: UiLanguage) { return }

export default App
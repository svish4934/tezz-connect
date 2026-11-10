import { useRef, useState } from 'react'

type Ndt7Client = {
  test: (config: Record<string, unknown>, callbacks: Record<string, (event: any) => void>) => Promise<number> | number
}

function readMbps(event: any): number | null {
  const data = event?.Data ?? event?.data ?? event
  // NDT7's client-side measurements report MeanClientToServerMbps or
  // MeanServerToClientMbps depending on the direction of the test.
  const candidates = [
    data?.MeanClientMbps,
    data?.MeanClientToServerMbps,
    data?.MeanServerToClientMbps,
    data?.MeanThroughputMbps,
    data?.meanThroughputMbps,
    data?.ThroughputMbps,
    data?.throughputMbps
  ]
  for (const value of candidates) {
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }
  return null
}

export default function MlabIndependentTest() {
  const [accepted, setAccepted] = useState(false)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState('Ready when you are')
  const [server, setServer] = useState('')
  const [download, setDownload] = useState<number | null>(null)
  const [upload, setUpload] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [finished, setFinished] = useState(false)
  const downloadRef = useRef<number | null>(null)
  const uploadRef = useRef<number | null>(null)

  async function startTest() {
    if (!accepted || running) return
    setRunning(true)
    setFinished(false)
    setError('')
    setDownload(null)
    setUpload(null)
    downloadRef.current = null
    uploadRef.current = null
    setServer('')
    setPhase('Loading the official NDT7 client…')
    try {
      // @ts-expect-error The upstream package currently publishes no TypeScript declarations.
      const loaded = await import('@m-lab/ndt7')
      const client = (loaded.ndt7 ?? loaded.default?.ndt7 ?? loaded.default ?? loaded) as Ndt7Client
      if (!client || typeof client.test !== 'function') throw new Error('The M-Lab NDT7 client could not be loaded.')
      const code = await client.test({
        protocol: 'wss',
        userAcceptedDataPolicy: true,
        metadata: { client_name: 'TEZZ CONNECT', client_version: '1.0.0' }
      }, {
        serverDiscovery: () => setPhase('Finding an available M-Lab test server…'),
        serverChosen: (selected: any) => {
          const city = selected?.location?.city
          const country = selected?.location?.country
          setServer([city, country].filter(Boolean).join(', ') || selected?.machine || 'M-Lab server selected')
          setPhase('Connected to M-Lab. Measuring download…')
        },
        downloadStart: () => setPhase('Measuring download…'),
        downloadMeasurement: (event: any) => {
          const value = readMbps(event)
          if (value !== null) { downloadRef.current = value; setDownload(value) }
        },
        downloadComplete: () => setPhase('Download complete. Measuring upload…'),
        uploadStart: () => setPhase('Measuring upload…'),
        uploadMeasurement: (event: any) => {
          const value = readMbps(event)
          if (value !== null) { uploadRef.current = value; setUpload(value) }
        },
        uploadComplete: () => setPhase('Upload complete. Finalising results…'),
        error: (message: string) => setError(message || 'M-Lab could not complete the test.')
      })
      if (code !== 0) throw new Error(`M-Lab test ended with status ${code}.`)
      if (downloadRef.current === null || uploadRef.current === null) throw new Error('M-Lab completed without returning both throughput measurements. Please retry.')
      setPhase('Independent M-Lab test completed')
      setFinished(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The independent M-Lab test could not complete.')
      setPhase('Test could not complete')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="benchmark-consent-panel mlab-independent-panel" aria-label="Independent Measurement Lab speed test">
      <div className="section-kicker">INDEPENDENT MEASUREMENT</div>
      <h2>Verify with Measurement Lab</h2>
      <p>Run the open-source M-Lab NDT7 test against an independently selected measurement server. This is a separate test and its results are not mixed with TEZZ CONNECT measurements.</p>
      <div className="mlab-results" aria-live="polite">
        <div><span>Download</span><strong>{download === null ? '—' : `${download.toFixed(1)} Mbps`}</strong></div>
        <div><span>Upload</span><strong>{upload === null ? '—' : `${upload.toFixed(1)} Mbps`}</strong></div>
      </div>
      {server && <p className="mlab-server">Test server: {server}</p>}
      <p className="mlab-phase">{phase}</p>
      {error && <p className="error-note" role="alert">{error}</p>}
      {finished && <p className="mlab-policy-note">M-Lab test complete. Measurements are contributed to M-Lab’s public research dataset.</p>}
      <label className="mlab-consent">
        <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={running}/>
        <span>I understand and accept M-Lab’s <a href="https://www.measurementlab.net/privacy/" target="_blank" rel="noreferrer">data and privacy policy</a>. My test measurements, including my public IP address, may be published in its open research dataset.</span>
      </label>
      <button className="tezz-digital-start" type="button" onClick={() => void startTest()} disabled={!accepted || running}>
        {running ? 'M-LAB TEST RUNNING…' : 'START INDEPENDENT M-LAB TEST'}
      </button>
      <p className="mlab-attribution">Powered by the official <a href="https://github.com/m-lab/ndt7-js" target="_blank" rel="noreferrer">M-Lab NDT7 JavaScript client</a> (Apache License 2.0). TEZZ CONNECT is an independent integration and is not endorsed by M-Lab.</p>
    </section>
  )
}

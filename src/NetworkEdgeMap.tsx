type Props = { colo?: string; country?: string; region?: string; asn?: number | null; organization?: string; loading?: boolean; error?: string; updatedAt?: string; onRefresh: () => void }

const edgeLocations: Record<string, { x: number; y: number; label: string }> = {
  SIN: { x: 805, y: 260, label: 'Singapore' }, BOM: { x: 735, y: 270, label: 'Mumbai' },
  DEL: { x: 755, y: 245, label: 'Delhi' }, LHR: { x: 490, y: 155, label: 'London' },
  FRA: { x: 520, y: 165, label: 'Frankfurt' }, AMS: { x: 510, y: 155, label: 'Amsterdam' },
  SJC: { x: 175, y: 185, label: 'San Jose' }, LAX: { x: 165, y: 205, label: 'Los Angeles' },
  IAD: { x: 245, y: 180, label: 'Washington' }, MIA: { x: 255, y: 235, label: 'Miami' },
  SYD: { x: 900, y: 385, label: 'Sydney' }, NRT: { x: 895, y: 225, label: 'Tokyo' },
  HKG: { x: 850, y: 260, label: 'Hong Kong' }, GRU: { x: 345, y: 370, label: 'São Paulo' },
}
const hubs = [{x:175,y:185},{x:490,y:155},{x:805,y:260},{x:895,y:225},{x:345,y:370},{x:900,y:385},{x:255,y:235}]

export default function NetworkEdgeMap({ colo, country, region, asn, organization, loading, error, updatedAt, onRefresh }: Props) {
  const edge = colo ? edgeLocations[colo.toUpperCase()] : undefined
  return <section className="edge-map-card" aria-label="Network edge map">
    <div className="edge-map-heading"><div><span className="section-kicker">NETWORK EDGE MAP</span><h3>Where your test is being served</h3><p>Cloudflare edge location is highlighted separately from your source network.</p></div><span className="edge-map-live"><i/> EDGE DATA</span></div>
    <div className="edge-map-visual">
      <svg viewBox="0 0 1000 470" role="img" aria-label={edge ? `Illustrative global network map with Cloudflare edge at ${edge.label}` : 'Illustrative global network map'}>
        <defs>
          <linearGradient id="edgeMapOcean" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#07172c"/><stop offset="1" stopColor="#102b49"/></linearGradient>
          <linearGradient id="edgeMapRoute" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#18b6d2" stopOpacity=".15"/><stop offset=".55" stopColor="#55e5f5"/><stop offset="1" stopColor="#8b7bff"/></linearGradient>
          <filter id="edgeMapGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width="1000" height="470" rx="18" fill="url(#edgeMapOcean)"/>
        {Array.from({length:9},(_,i)=><path key={'lat'+i} d={`M0 ${55+i*45} H1000`} stroke="#8bb8d5" opacity=".09" strokeDasharray="3 8"/>)}
        {Array.from({length:13},(_,i)=><path key={'lon'+i} d={`M${35+i*77} 0 V470`} stroke="#8bb8d5" opacity=".07" strokeDasharray="3 8"/>)}
        <g fill="#174363" stroke="#2e6c8d" strokeWidth="1.4" opacity=".88">
          <path d="M75 95 L112 70 165 75 193 96 224 91 248 112 238 137 208 146 197 174 174 192 162 229 137 237 121 212 104 190 90 157 69 135Z"/>
          <path d="M215 245 L244 254 263 286 255 322 239 359 222 399 202 377 194 339 178 306 190 272Z"/>
          <path d="M420 91 L452 72 500 76 529 91 563 85 591 102 620 97 648 116 682 111 713 129 752 126 788 145 826 151 861 179 849 204 820 210 804 234 779 235 759 258 730 248 704 228 682 211 659 207 643 185 613 178 584 166 560 175 543 159 515 164 494 147 470 150 450 131 426 126Z"/>
          <path d="M510 190 L546 190 570 218 562 257 544 286 527 316 508 301 499 270 485 239 492 210Z"/>
          <path d="M740 270 L773 268 799 286 817 312 804 337 780 350 755 330 738 304Z"/>
          <path d="M835 350 L866 344 891 360 884 382 858 390 837 375Z"/>
        </g>
        <g fill="none" stroke="url(#edgeMapRoute)" strokeWidth="2" opacity=".75">
          {edge && hubs.filter(h=>h.x!==edge.x || h.y!==edge.y).map((h,i)=><path key={i} d={`M${h.x} ${h.y} Q${(h.x+edge.x)/2} ${Math.min(h.y,edge.y)-45} ${edge.x} ${edge.y}`} strokeDasharray="7 9" className="edge-map-route-line"/>)}
        </g>
        <g>{hubs.map((h,i)=><g key={i}><circle cx={h.x} cy={h.y} r="4" fill="#36cbe2"/><circle cx={h.x} cy={h.y} r="10" fill="#36cbe2" opacity=".15"/></g>)}</g>
        {edge && <g filter="url(#edgeMapGlow)"><circle cx={edge.x} cy={edge.y} r="22" fill="#22d3ee" opacity=".13"/><circle cx={edge.x} cy={edge.y} r="9" fill="#65f3ff"/><circle cx={edge.x} cy={edge.y} r="3" fill="#fff"/></g>}
        <g fill="#d6f6ff" fontSize="13" fontWeight="600"><text x="28" y="35">GLOBAL NETWORK VIEW</text>{edge && <text x={Math.min(edge.x+18,850)} y={edge.y-18}>{colo?.toUpperCase()} · {edge.label}</text>}</g>
      </svg>
      <div className="edge-map-legend"><span><i className="edge-map-dot real"/> Detected serving edge</span><span><i className="edge-map-dot animated"/> Illustrative network animation</span></div>
    </div>
    <div className="edge-map-details">
      <div><span className="section-kicker">CURRENT TEZZ EDGE</span><strong>{colo || (loading ? 'Identifying…' : 'Not available')}</strong><small>{edge?.label || 'Cloudflare point of presence'}</small></div>
      <div><span>Source network</span><strong>{organization || 'Not provided'}</strong></div>
      <div><span>Source region</span><strong>{[region,country].filter(Boolean).join(', ') || 'Not provided'}</strong></div>
      <div><span>ASN</span><strong>{asn ? `AS${asn}` : 'Not provided'}</strong></div>
    </div>
    <div className="edge-map-footer"><small>{updatedAt ? `Updated at ${updatedAt}.` : 'Edge metadata is provided by the network handling this request.'} Only the highlighted colo is detected data; other map markers and paths are illustrative. This is not a traceroute.</small><button className="doctor-run-test" onClick={onRefresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh edge details'} ↻</button></div>
    {error && <p className="latency-error" role="alert">{error}</p>}
  </section>
}

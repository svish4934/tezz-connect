# TEZZ CONNECT

A privacy-conscious internet speed and network diagnostics dashboard.

## Stack
- React + TypeScript + Vite
- Lucide icons
- Edge worker for first-party speed-test endpoints and static assets

## Local development
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
```

## Deployment
1. Install dependencies and build: `npm ci && npm run build`.
2. Deploy with Wrangler: `npx wrangler deploy`.
3. The Worker serves the built `dist/` assets and handles the `/api/speed/*` routes.

## Current status
The responsive dashboard, browser network snapshot, and first-party Worker endpoints are included. Speed-test values are estimates and vary with device, browser, routing, and network load.

## Privacy
No account is required. Test history is stored locally in the browser (up to 50 results) and is not sent to an account or server. With the current client test flow, download calibration performs three requests of up to 8,333,333 bytes each (up to 24,999,999 bytes total). Upload calibration sends a 1,000,000-byte request, followed by two or three measured uploads of 2 MB, 5 MB or 10 MB each, depending on the calibration result. The largest current upload sequence is therefore up to 21 MB. A complete successful test can transfer approximately 46 MB at the upper bounds; actual transfer may be lower if a request fails or ends early. Worker-side limits are 25,000,000 bytes per download request and 10,000,000 bytes per upload request.

# TEZZ CONNECT

A privacy-conscious internet speed and network diagnostics dashboard.

## Stack
- React + TypeScript + Vite
- Lucide icons
- Cloudflare Worker for first-party speed-test endpoints and static assets

## Local development
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
```

## Cloudflare deployment
1. Install dependencies and build: `npm ci && npm run build`.
2. Deploy with Wrangler: `npx wrangler deploy`.
3. The Worker serves the built `dist/` assets and handles the `/api/speed/*` routes.

## Current status
The responsive dashboard, browser network snapshot, and first-party Worker endpoints are included. Speed-test values are estimates and vary with device, browser, routing, and network load.

## Privacy
No account is required. Test history is stored locally in the browser (up to 50 results) and is not sent to an account or server. A full speed test transfers up to 50 MB for download and 50 MB for upload (approximately 100 MB total). The upload and download endpoints enforce a 50 MB maximum payload per request.

# TEZZ CONNECT Geolocation API

## First-party IP geolocation

**Endpoint:** `GET /api/v1/geolocation`

This endpoint returns the approximate location associated with the visitor's IP as provided to the TEZZ CONNECT Cloudflare Worker. It uses Cloudflare request geolocation metadata; it is not a standalone geolocation database or GPS service.

Example response:

```json
{
  "ok": true,
  "available": true,
  "source": "cloudflare-ip-geolocation",
  "method": "ip",
  "precision": "approximate",
  "location": {
    "city": "Mumbai",
    "region": "Maharashtra",
    "regionCode": "MH",
    "countryCode": "IN",
    "continentCode": "AS",
    "timezone": "Asia/Kolkata",
    "coordinates": {
      "latitude": 19.07,
      "longitude": 72.87
    }
  },
  "privacy": {
    "ipAddressReturned": false,
    "locationStored": false,
    "gpsPermissionRequired": false
  },
  "timestamp": "2026-11-20T00:00:00.000Z"
}
```

The example values are illustrative, not live data. Fields may be null. Coordinates, when present, are IP-derived estimates and must not be described as precise device coordinates. The endpoint deliberately does not return the visitor's IP address, ASN, or Cloudflare colo. Network-edge data remains a separate API concern.

## Device GPS / browser geolocation

Import `getDeviceGeolocation` from `src/lib/geolocation.ts`. Call it only from a clear user action, such as tapping **Use my device location**. The browser displays its own permission prompt. It requires HTTPS and a supported browser.

The returned coordinates and accuracy are supplied by the device/browser. They remain in the browser unless the feature explicitly transmits them after obtaining appropriate user consent. Do not call this automatically on page load.

## Reuse in future features

Import the shared helpers:

- `getNetworkGeolocation()` for automatic, approximate IP-based context.
- `getDeviceGeolocation()` for optional, permission-based device coordinates.

Use IP location for broad defaults such as country/region content and localised diagnostics. Use device location only when a feature genuinely needs more precise location, such as a user-requested nearby coverage or local network context. Do not use either source to infer the Cloudflare edge or the route taken by a speed test.

## Privacy and operational rules

- The Worker does not persist location results.
- The endpoint does not return the visitor's public IP.
- Existing API rate limiting applies.
- Responses are non-cacheable.
- Consumers must tolerate missing fields and unavailable geolocation.
- Do not use IP coordinates for address-level targeting, emergency decisions, or claims of GPS accuracy.
- Avoid storing precise device coordinates. If a future feature needs to send them to a server, explain why and request explicit consent first.

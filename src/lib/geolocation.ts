export type TezzIpGeolocation = {
  ok: true
  available: boolean
  source: 'cloudflare-ip-geolocation'
  method: 'ip'
  precision: 'approximate'
  location: {
    city: string | null
    region: string | null
    regionCode: string | null
    countryCode: string | null
    continentCode: string | null
    timezone: string | null
    coordinates: { latitude: number; longitude: number } | null
  }
  privacy: {
    ipAddressReturned: false
    locationStored: false
    gpsPermissionRequired: false
  }
  timestamp: string
}

export type TezzDeviceGeolocation = {
  latitude: number
  longitude: number
  accuracyMeters: number
  altitudeMeters: number | null
  headingDegrees: number | null
  speedMetersPerSecond: number | null
  timestamp: string
}

/**
 * Gets the visitor's approximate location from the TEZZ CONNECT Worker.
 * This is IP-derived, not GPS. The endpoint does not return or store the IP.
 */
export async function getNetworkGeolocation(signal?: AbortSignal): Promise<TezzIpGeolocation> {
  const response = await fetch('/api/v1/geolocation', {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: signal ?? AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`TEZZ geolocation request failed (HTTP ${response.status})`)
  const data = await response.json() as TezzIpGeolocation
  if (data.ok !== true || data.source !== 'cloudflare-ip-geolocation' || !data.location) {
    throw new Error('TEZZ geolocation returned an unsupported response')
  }
  return data
}

/**
 * Requests device GPS/location only when explicitly called by a user action.
 * Coordinates remain in the browser unless the calling feature separately
 * obtains informed consent before transmitting them.
 */
export function getDeviceGeolocation(options: PositionOptions = {}): Promise<TezzDeviceGeolocation> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('Device location is not available in this browser'))
  }
  if (!window.isSecureContext) {
    return Promise.reject(new Error('Device location requires a secure HTTPS connection'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        altitudeMeters: position.coords.altitude,
        headingDegrees: position.coords.heading,
        speedMetersPerSecond: position.coords.speed,
        timestamp: new Date(position.timestamp).toISOString(),
      }),
      error => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied',
          2: 'The device could not determine its location',
          3: 'The device location request timed out',
        }
        reject(new Error(messages[error.code] ?? 'Device location is unavailable'))
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 12000,
        maximumAge: options.maximumAge ?? 0,
      },
    )
  })
}

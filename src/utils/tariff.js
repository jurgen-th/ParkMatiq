import { loadZones } from './zones'

// Fallback rate when the parked point isn't inside any known tariff zone
// (e.g. location was off, or parked outside the mapped Rotterdam area).
export const DEFAULT_RATE = 3.0

// Ray-casting point-in-polygon. ring is an array of [lon, lat] pairs.
function pointInRing(lat, lon, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const hit = (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

function pointInFeature(lat, lon, geom) {
  if (!geom) return false
  if (geom.type === 'Polygon') return pointInRing(lat, lon, geom.coordinates[0])
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some(poly => pointInRing(lat, lon, poly[0]))
  }
  return false
}

// Returns { rate, desc } for the first zone containing the point, or null.
export function zoneForPoint(lat, lon, data) {
  if (lat == null || lon == null || !data?.features) return null
  for (const f of data.features) {
    if (pointInFeature(lat, lon, f.geometry)) {
      return { rate: f.properties.eurPerHour ?? DEFAULT_RATE, desc: f.properties.desc }
    }
  }
  return null
}

// Resolve the €/hour rate (and zone name) for a parked location. Always
// resolves — falls back to DEFAULT_RATE when no zone matches.
export async function rateForSession(lat, lon) {
  const data = await loadZones()
  const z = zoneForPoint(lat, lon, data)
  return z ? { rate: z.rate, zoneDesc: z.desc } : { rate: DEFAULT_RATE, zoneDesc: null }
}

export function costFor(durationSec, rate) {
  return (durationSec / 3600) * (rate ?? DEFAULT_RATE)
}

// Cost of a completed session, tolerant of older records without rate/cost.
export function sessionCost(s) {
  if (typeof s.cost === 'number') return s.cost
  return costFor(s.duration || 0, s.rate)
}

export function formatEuro(n) {
  return '€' + (n || 0).toFixed(2).replace('.', ',')
}

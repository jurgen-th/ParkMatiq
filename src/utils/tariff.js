import { loadZones, featureBBox } from './zones'

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

// A point is inside a polygon when it's inside the outer ring and outside every
// hole. RDW zones carry 200+ polygons with holes (courtyards, free side streets
// cut out of a paid zone) — ignoring them charges for free parking.
function pointInPolygon(lat, lon, rings) {
  if (!pointInRing(lat, lon, rings[0])) return false
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lat, lon, rings[i])) return false
  }
  return true
}

function pointInFeature(lat, lon, geom) {
  if (!geom) return false
  if (geom.type === 'Polygon') return pointInPolygon(lat, lon, geom.coordinates)
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some(poly => pointInPolygon(lat, lon, poly))
  }
  return false
}

// Returns the zone properties for the first zone containing the point, or null.
export function zoneForPoint(lat, lon, data) {
  if (lat == null || lon == null || !data?.features) return null
  for (const f of data.features) {
    const [minLon, minLat, maxLon, maxLat] = featureBBox(f)
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue
    if (pointInFeature(lat, lon, f.geometry)) {
      const p = f.properties
      return {
        rate: p.eurPerHour ?? 0,
        desc: p.desc,
        areaid: p.areaid,
        municipality: p.municipality || '',
      }
    }
  }
  return null
}

// True when a resolved zone is covered by one of the user's resident permits.
// Permits are issued per parking zone, and a single permit zone usually spans
// several RDW areas that share a name, so a name+municipality match counts too.
export function zoneHasPermit(zone, permitZones) {
  if (!zone || !permitZones?.length) return false
  return permitZones.some(p =>
    p.areaid === zone.areaid ||
    (!!p.desc && p.desc === zone.desc && (p.municipality || '') === (zone.municipality || ''))
  )
}

// Resolve the tariff for a parked location. `tariff` says why the rate is what
// it is, so the UI can be honest instead of inventing a price:
//   'paid'    — inside a mapped paid zone, charge session.rate
//   'permit'  — inside a zone the user holds a resident permit for, free
//   'free'    — location known, no paid zone here, free
//   'unknown' — no location fix, so no rate can be resolved (never charge)
export async function rateForSession(lat, lon, permitZones = []) {
  if (lat == null || lon == null) {
    return { rate: 0, zoneDesc: null, zoneId: null, municipality: '', tariff: 'unknown' }
  }
  const zone = zoneForPoint(lat, lon, await loadZones())
  if (!zone) {
    return { rate: 0, zoneDesc: null, zoneId: null, municipality: '', tariff: 'free' }
  }
  const permit = zoneHasPermit(zone, permitZones)
  return {
    rate: permit ? 0 : zone.rate,
    zoneDesc: zone.desc,
    zoneId: zone.areaid,
    municipality: zone.municipality,
    tariff: permit ? 'permit' : 'paid',
  }
}

export function costFor(durationSec, rate) {
  return (durationSec / 3600) * (rate ?? 0)
}

// Cost of a completed session, tolerant of older records without rate/cost.
export function sessionCost(s) {
  if (typeof s.cost === 'number') return s.cost
  return costFor(s.duration || 0, s.rate)
}

// What a traditional meter charges for the same stay: every started hour is
// billed in full at the zone rate. This is the honest baseline ParkMatiq beats
// by charging only the minutes actually used.
export function meterCost(s) {
  const hours = Math.ceil((s.duration || 0) / 3600)
  return hours * (s.rate ?? 0)
}

// Savings for one session vs. a per-hour meter (never negative).
export function savingsVsMeter(s) {
  return Math.max(0, meterCost(s) - sessionCost(s))
}

export function formatEuro(n) {
  return '€' + (n || 0).toFixed(2).replace('.', ',')
}

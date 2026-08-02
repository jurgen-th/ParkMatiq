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

// Returns the zone containing the point, or null. A point can fall in both a
// priced zone and one whose tariff we couldn't resolve (they overlap where a
// municipality files the same street twice); the priced one wins, because it
// tells the driver more.
export function zoneForPoint(lat, lon, data) {
  if (lat == null || lon == null || !data?.features) return null
  let fallback = null
  for (const f of data.features) {
    const [minLon, minLat, maxLon, maxLat] = featureBBox(f)
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue
    if (!pointInFeature(lat, lon, f.geometry)) continue
    const p = f.properties
    const zone = {
      windows: p.sched ? data.schedules?.[p.sched] ?? null : null,
      maxRate: p.maxEurPerHour ?? null,
      dayCap: p.dayCap ?? null,
      desc: p.desc,
      areaid: p.areaid,
      municipality: p.municipality || '',
    }
    if (zone.windows) return zone
    if (!fallback) fallback = zone
  }
  return fallback
}

// The tariff in force at `when`, from a zone's weekly windows. Outside every
// window parking is free — that is the normal case in the evening and on
// Sunday, and charging the daytime rate then is simply wrong.
export function rateAt(windows, when = new Date()) {
  if (!windows?.length) return 0
  const day = when.getDay()
  const minute = when.getHours() * 60 + when.getMinutes()
  for (const [d, start, end, rate] of windows) {
    if (d === day && minute >= start && minute < end) return rate
  }
  return 0
}

// Start of day `n` days after `from`, at `minute` past midnight. Built from
// local calendar fields so it stays correct across the DST switches.
function localMinute(from, dayOffset, minute) {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + dayOffset, 0, minute)
}

// End of the paid window running at `when`, or null when parking is free then.
// Consecutive windows that touch (23:00-24:00 followed by 00:00-01:00 the next
// day) are treated as one, so "meter loopt tot" shows the real end.
export function paidUntil(windows, when = new Date()) {
  if (!rateAt(windows, when)) return null
  let cursor = when
  for (let guard = 0; guard < 14; guard++) {
    const day = cursor.getDay()
    const minute = cursor.getHours() * 60 + cursor.getMinutes()
    const w = windows.find(([d, s, e]) => d === day && minute >= s && minute < e)
    if (!w) return cursor
    cursor = localMinute(cursor, 0, w[2])
    if (rateAt(windows, cursor) === 0) return cursor
  }
  return cursor
}

// When paid parking next starts, or null if not within a week.
export function nextPaidStart(windows, when = new Date()) {
  if (!windows?.length) return null
  for (let offset = 0; offset <= 7; offset++) {
    const day = (when.getDay() + offset) % 7
    const after = offset === 0 ? when.getHours() * 60 + when.getMinutes() : -1
    const starts = windows
      .filter(([d, s]) => d === day && s > after)
      .map(([, s]) => s)
      .sort((a, b) => a - b)
    if (starts.length) return localMinute(when, offset, starts[0])
  }
  return null
}

// What a stay actually costs: only the minutes that fall inside a paid window
// are billed. A session that runs past the end of paid hours stops accruing.
// `dayCap` (EUR) limits what a single calendar day can cost — the municipality's
// dagtarief, or the driver's own ceiling, whichever binds first.
export function costBetween(windows, startMs, endMs, dayCap = null) {
  if (!windows?.length || !(endMs > startMs)) return 0
  let total = 0
  const start = new Date(startMs)
  for (let offset = 0; offset < 400; offset++) {
    const dayStart = localMinute(start, offset, 0)
    if (dayStart.getTime() >= endMs) break
    const day = dayStart.getDay()
    let today = 0
    for (const [d, s, e, rate] of windows) {
      if (d !== day) continue
      const from = Math.max(localMinute(start, offset, s).getTime(), startMs)
      const to = Math.min(localMinute(start, offset, e).getTime(), endMs)
      if (to > from) today += ((to - from) / 3600000) * rate
    }
    total += dayCap != null ? Math.min(today, dayCap) : today
  }
  return total
}

// The ceiling for one day of this session: the zone's dagtarief and the
// driver's own limit, whichever is lower. Either may be absent.
export function effectiveDayCap(zoneCap, userCap) {
  const caps = [zoneCap, userCap].filter(c => typeof c === 'number' && c > 0)
  return caps.length ? Math.min(...caps) : null
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
//   'paid'     — inside a mapped paid zone during its paid hours
//   'permit'   — inside a zone the user holds a resident permit for, free
//   'free'     — location known, no paid zone here, free
//   'evening'  — inside a paid zone but outside its hours right now, free
//   'unknown'  — no location fix, no zone data, or a zone whose tariff RDW
//                doesn't let us resolve (never charge on a guess)
export async function rateForSession(lat, lon, permitZones = [], when = new Date()) {
  const none = { rate: 0, windows: null, zoneDesc: null, zoneId: null, municipality: '' }
  if (lat == null || lon == null) return { ...none, tariff: 'unknown' }

  const data = await loadZones()
  if (!data) return { ...none, tariff: 'unknown' }

  const zone = zoneForPoint(lat, lon, data)
  if (!zone) return { ...none, tariff: 'free' }

  const base = {
    zoneDesc: zone.desc,
    zoneId: zone.areaid,
    municipality: zone.municipality,
  }
  // A zone we know is paid but whose tariff we couldn't resolve from RDW.
  if (!zone.windows) return { ...base, rate: 0, windows: null, tariff: 'unknown' }
  if (zoneHasPermit(zone, permitZones)) {
    return { ...base, rate: 0, windows: zone.windows, tariff: 'permit' }
  }

  const rate = rateAt(zone.windows, when)
  return {
    ...base,
    rate,
    windows: zone.windows,
    zoneDayCap: zone.dayCap,
    tariff: rate > 0 ? 'paid' : 'evening',
    paidUntil: rate > 0 ? paidUntil(zone.windows, when)?.getTime() ?? null : null,
    nextPaid: rate > 0 ? null : nextPaidStart(zone.windows, when)?.getTime() ?? null,
  }
}

export function costFor(durationSec, rate) {
  return (durationSec / 3600) * (rate ?? 0)
}

// Cost of a stay that started at `startTime`, billed against the zone's weekly
// windows when the session carries them. Sessions recorded before the windows
// existed fall back to the flat rate they stored.
export function costOf(session, endMs = Date.now()) {
  const startMs = new Date(session.startTime).getTime()
  if (session.windows) return costBetween(session.windows, startMs, endMs, session.dayCap)
  return costFor(Math.max(0, (endMs - startMs) / 1000), session.rate)
}

// Cost of a completed session, tolerant of older records without rate/cost.
export function sessionCost(s) {
  if (typeof s.cost === 'number') return s.cost
  if (s.windows && s.startTime && s.endTime) {
    return costBetween(s.windows, new Date(s.startTime).getTime(),
                       new Date(s.endTime).getTime(), s.dayCap)
  }
  return costFor(s.duration || 0, s.rate)
}

// True once the day's cap is what's holding the price down — the point where
// the meter has effectively stopped for today.
export function dayCapReached(session, at = Date.now()) {
  if (!session?.dayCap || !session.windows) return false
  const inAnHour = costOf(session, at + 3600000)
  return inAnHour <= costOf(session, at) && rateAt(session.windows, new Date(at)) > 0
}

// What a traditional meter charges for the same stay: every started hour is
// billed in full at the zone rate. This is the honest baseline ParkMatiq beats
// by charging only the minutes actually used. Only billable time counts — a
// meter doesn't run outside paid hours either.
export function meterCost(s) {
  const rate = s.rate ?? 0
  if (!rate) return 0
  const paidHours = sessionCost(s) / rate
  return Math.ceil(paidHours) * rate
}

// Savings for one session vs. a per-hour meter (never negative).
export function savingsVsMeter(s) {
  return Math.max(0, meterCost(s) - sessionCost(s))
}

export function formatEuro(n) {
  return '€' + (n || 0).toFixed(2).replace('.', ',')
}

// An amount as typed into a settings field ("12,50"), or null when unusable.
export function parseAmount(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

// "23:00" for a moment later today, "ma 09:00" when it falls on another day —
// used to tell the driver when the meter stops or starts running.
export function formatWhen(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return time
  return `${d.toLocaleDateString('nl-NL', { weekday: 'short' })} ${time}`
}

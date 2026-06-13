// Pure movement-detection state machine. Kept free of React/geolocation so the
// logic can be tested deterministically by feeding it a sequence of samples.
//
// Prompts (matches the agreed table):
//   - 'start' : we'd been driving, then stationary >= 2 min, and NO active session
//   - 'stop'  : sustained driving movement while a session IS active
// Each prompt fires once per transition, never repeatedly.

export const THRESHOLDS = {
  drivingSpeed: 7,        // m/s (~25 km/h) — clearly in a vehicle, not walking/cycling
  stationarySpeed: 1.2,   // m/s — below this counts as "not moving" (allows GPS noise)
  stationaryMs: 120000,   // 2 minutes still before we treat it as "parked"
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function initialDetectorState(now) {
  return {
    lastMovingAt: now,   // last time we saw real movement (resets the "still" clock)
    lastPos: null,       // for deriving speed when the device doesn't report it
    wasDriving: false,   // have we seen driving speed since the last park? (anti-nag)
    parkedFired: false,  // already prompted "start?" for this park event
    driveFired: false,   // already prompted "stop?" for this drive event
  }
}

// sample: { speed: m/s|null, lat, lon, time: ms, active: bool }
// returns { state, prompt: 'start' | 'stop' | null }
export function step(state, sample, T = THRESHOLDS) {
  const s = { ...state }

  let speed = sample.speed
  if ((speed == null || Number.isNaN(speed)) && s.lastPos) {
    const d = haversine(s.lastPos.lat, s.lastPos.lon, sample.lat, sample.lon)
    const dt = (sample.time - s.lastPos.time) / 1000
    speed = dt > 0 ? d / dt : 0
  }
  speed = speed || 0
  s.lastPos = { lat: sample.lat, lon: sample.lon, time: sample.time }

  let prompt = null

  if (speed > T.stationarySpeed) s.lastMovingAt = sample.time

  if (speed >= T.drivingSpeed) {
    s.wasDriving = true
    s.parkedFired = false
    if (sample.active && !s.driveFired) {
      prompt = 'stop'
      s.driveFired = true
    }
  }

  if (s.wasDriving && speed <= T.stationarySpeed &&
      sample.time - s.lastMovingAt >= T.stationaryMs) {
    s.driveFired = false
    if (!sample.active && !s.parkedFired) {
      prompt = 'start'
      s.parkedFired = true
    }
  }

  return { state: s, prompt }
}

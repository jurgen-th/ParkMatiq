const PROFILE_KEY = 'pw_profile'
const SESSIONS_KEY = 'pw_sessions'
const ACTIVE_KEY = 'pw_active'
const SETTINGS_KEY = 'pw_settings'

const DEFAULT_SETTINGS = {
  location: true,
  theme: null,            // null = follow OS; 'light' | 'dark' = explicit
  onboardingDone: false,
  paymentConnected: false,
  bluetoothConnected: false,
  // Resident permits are issued per parking zone, not per postcode. Each entry
  // is { areaid, desc, municipality } as resolved from the RDW zone data.
  permitZones: [],
  showCharging: false,    // EV charge-point layer on the Home map
  monthlyBudget: '',      // empty = no budget set
  maxDailyCost: '',       // driver's own ceiling per day; empty = no ceiling
  endPreference: 'balanced',
}

// How many sessions we keep. Receipts are the reason: a driver claiming parking
// back needs last year's stay, not just last month's. localStorage holds a few
// MB and a session is well under a kilobyte, so this is comfortably within it.
export const MAX_SESSIONS = 500

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function getProfile() {
  return read(PROFILE_KEY, null)
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function getSessions() {
  return read(SESSIONS_KEY, [])
}

export function addSession(session) {
  const sessions = getSessions()
  sessions.unshift(session)
  if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

// Used by the server sync after merging local and remote history. Kept here so
// the storage key stays private to this module.
export function replaceSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
}

export function getActiveSession() {
  return read(ACTIVE_KEY, null)
}

export function setActiveSession(session) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(session))
}

export function clearActiveSession() {
  localStorage.removeItem(ACTIVE_KEY)
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}

export function clearAllData() {
  localStorage.removeItem(PROFILE_KEY)
  localStorage.removeItem(SESSIONS_KEY)
  localStorage.removeItem(ACTIVE_KEY)
  localStorage.removeItem(SETTINGS_KEY)
}

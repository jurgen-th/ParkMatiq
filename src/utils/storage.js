const PROFILE_KEY = 'pw_profile'
const SESSIONS_KEY = 'pw_sessions'
const ACTIVE_KEY = 'pw_active'
const SETTINGS_KEY = 'pw_settings'

const DEFAULT_SETTINGS = {
  location: true,
  theme: null,            // null = follow OS; 'light' | 'dark' = explicit
  dayBaseline: 18,        // € flat all-day rate to compare savings against
  onboardingDone: false,
  paymentConnected: false,
  bluetoothConnected: false,
  permitPostcode: '',     // empty = no resident permit
  monthlyBudget: '',      // empty = no budget set
  endPreference: 'balanced',
}

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
  if (sessions.length > 30) sessions.pop()
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
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

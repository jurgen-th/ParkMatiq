// Supabase sync layer. localStorage stays the synchronous source of truth;
// these helpers mirror changes to Supabase in the background. Every push is
// fire-and-forget and no-ops when the backend is off or nobody is signed in,
// so features never wait on (or break because of) the network.
import { supabase, backendEnabled } from './supabase'
import * as local from '../../utils/storage'

async function userId() {
  if (!backendEnabled) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

function warn(what, error) {
  if (error) console.warn(`[sync] ${what} mislukt:`, error.message)
}

export async function pushProfile(profile) {
  const id = await userId()
  if (!id || !profile) return
  const { error } = await supabase.from('profiles').upsert({
    id,
    name: profile.name,
    plate: profile.plate,
    email: profile.email ?? null,
    updated_at: new Date().toISOString(),
  })
  warn('profiel opslaan', error)
}

export async function pushSettings(settings) {
  const id = await userId()
  if (!id) return
  const { error } = await supabase
    .from('profiles')
    .upsert({ id, settings, updated_at: new Date().toISOString() })
  warn('instellingen opslaan', error)
}

export async function pushActive(session) {
  const id = await userId()
  if (!id) return
  const { error } = await supabase
    .from('profiles')
    .upsert({ id, active_session: session, updated_at: new Date().toISOString() })
  warn('actieve sessie opslaan', error)
}

export async function pushSession(session) {
  const id = await userId()
  if (!id || !session) return
  const { error } = await supabase
    .from('sessions')
    .upsert({ user_id: id, id: session.id, data: session })
  warn('sessie opslaan', error)
}

// After registration: seed the server with whatever this device already has
// (covers guest-mode history that predates the account).
export async function pushAll() {
  await pushProfile(local.getProfile())
  await pushSettings(local.getSettings())
  await pushActive(local.getActiveSession())
  for (const s of local.getSessions()) await pushSession(s)
}

// After login (and on app start while signed in): server wins, localStorage
// is overwritten. Writes via utils/storage directly so nothing echoes back up.
export async function pullAll() {
  const id = await userId()
  if (!id) return false

  const [{ data: prof, error: pErr }, { data: rows, error: sErr }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('sessions').select('data').eq('user_id', id)
      .order('id', { ascending: false }).limit(30),
  ])
  warn('profiel ophalen', pErr)
  warn('sessies ophalen', sErr)
  if (pErr || sErr) return false

  if (prof) {
    const profile = { name: prof.name, plate: prof.plate }
    if (prof.email) profile.email = prof.email
    local.saveProfile(profile)
    if (prof.settings) local.saveSettings(prof.settings)
    if (prof.active_session) local.setActiveSession(prof.active_session)
    else local.clearActiveSession()
  }
  if (rows) {
    localStorage.setItem('pw_sessions', JSON.stringify(rows.map(r => r.data)))
  }
  return !!prof
}

// GDPR erasure: the delete_user() RPC (security definer, see supabase/schema.sql)
// removes the auth user; profiles + sessions cascade. Local data is cleared by
// the caller. Throws on failure so the UI can tell the user erasure did NOT happen.
export async function deleteAccount() {
  const id = await userId()
  if (!id) return
  const { error } = await supabase.rpc('delete_user')
  if (error) throw error
  await supabase.auth.signOut()
}

export async function logout() {
  if (!backendEnabled) return
  const { error } = await supabase.auth.signOut()
  warn('uitloggen', error)
}

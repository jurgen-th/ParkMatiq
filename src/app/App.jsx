import { useEffect, useState } from 'react'
import Providers from './providers'
import AppRouter from './router'
import useDriveDetection from '../features/parking-session/hooks/useDriveDetection'
import { backendEnabled } from '../services/backend/supabase'
import { pullAll, onSyncError, onSyncOk } from '../services/backend/sync'

// Toont mislukte server-syncs zichtbaar in de app (console is onzichtbaar op
// een telefoon). Verdwijnt zodra een volgende sync slaagt, of via de ×.
function SyncBanner() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const offErr = onSyncError(setMsg)
    const offOk = onSyncOk(() => setMsg(''))
    return () => { offErr(); offOk() }
  }, [])
  if (!msg) return null
  return (
    <div className="sync-banner" role="alert">
      <span>⚠️ Sync: {msg}</span>
      <button onClick={() => setMsg('')} aria-label="Sluiten">×</button>
    </div>
  )
}

export default function App() {
  useDriveDetection()

  // Signed in from a previous visit? Refresh localStorage from the server in
  // the background (local-first: screens render local data immediately).
  useEffect(() => {
    if (backendEnabled) pullAll()
  }, [])
  return (
    <Providers>
      {backendEnabled && <SyncBanner />}
      <AppRouter />
    </Providers>
  )
}

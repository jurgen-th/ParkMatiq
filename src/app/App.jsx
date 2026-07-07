import { useEffect } from 'react'
import Providers from './providers'
import AppRouter from './router'
import useDriveDetection from '../features/parking-session/hooks/useDriveDetection'
import { backendEnabled } from '../services/backend/supabase'
import { pullAll } from '../services/backend/sync'

export default function App() {
  useDriveDetection()

  // Signed in from a previous visit? Refresh localStorage from the server in
  // the background (local-first: screens render local data immediately).
  useEffect(() => {
    if (backendEnabled) pullAll()
  }, [])
  return (
    <Providers>
      <AppRouter />
    </Providers>
  )
}

import { useEffect, useRef } from 'react'
import { getSettings, getActiveSession } from '../utils/storage'
import { requestPermission, notify } from '../utils/notifications'
import { initialDetectorState, step } from '../utils/driveDetect'

// Runs app-wide while the app is open (mounted once at the top level). Watches
// movement and fires a start/stop prompt notification at the right moment.
// Foreground-only by nature: the web can't track location once the app is
// closed — that needs a native wrapper later.
export default function useDriveDetection() {
  const stateRef = useRef(null)

  useEffect(() => {
    if (!getSettings().location || !navigator.geolocation) return

    stateRef.current = initialDetectorState(Date.now())
    requestPermission() // ensure we can show the prompts

    const id = navigator.geolocation.watchPosition(
      pos => {
        const { state, prompt } = step(stateRef.current, {
          speed: pos.coords.speed,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          time: Date.now(),
          active: !!getActiveSession(),
        })
        stateRef.current = state

        if (prompt === 'start') {
          notify('Sessie starten?', 'Je lijkt geparkeerd — open ParkMatiq om je parkeersessie te starten.')
        } else if (prompt === 'stop') {
          notify('Sessie stoppen?', 'Je rijdt weer — open ParkMatiq om je parkeersessie te stoppen.')
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [])
}

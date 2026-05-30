import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActiveSession, clearActiveSession, addSession } from '../utils/storage'
import { notify } from '../utils/notifications'
import { formatDuration } from '../utils/pdf'

export default function ActiveSession() {
  const navigate  = useNavigate()
  const [session, setSession]   = useState(null)
  const [elapsed, setElapsed]   = useState(0)
  const [stopping, setStopping] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    const active = getActiveSession()
    if (!active) { navigate('/', { replace: true }); return }
    setSession(active)

    const startMs = new Date(active.startTime).getTime()
    setElapsed(Math.floor((Date.now() - startMs) / 1000))
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000))
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [])

  function handleStop() {
    setStopping(true)
    clearInterval(intervalRef.current)

    const endTime = new Date().toISOString()
    const completed = {
      ...session,
      id: new Date(session.startTime).getTime(),
      endTime,
      duration: elapsed,
    }

    clearActiveSession()
    addSession(completed)
    notify('Parkeren gestopt', `Duur: ${formatDuration(elapsed)}`)
    navigate('/', { replace: true })
  }

  if (!session) return null

  const startStr = new Date(session.startTime).toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit',
  })

  // Format as HH:MM:SS for the big display
  const h   = Math.floor(elapsed / 3600)
  const m   = Math.floor((elapsed % 3600) / 60)
  const s   = elapsed % 60
  const pad = v => String(v).padStart(2, '0')
  const timerStr = `${pad(h)}:${pad(m)}:${pad(s)}`

  return (
    <div className="screen screen-session">
      <header className="header header-dark">
        <span className="header-logo">P</span>
        <span className="header-title">ParkWise</span>
      </header>

      <div className="session-body">

        <div className="session-status">
          <span className="pulse-dot" />
          <span>Actief parkeren</span>
        </div>

        <div className="session-card">
          <div className="session-plate">{session.plate}</div>
          <div className="session-timer">{timerStr}</div>
          <div className="session-since">Gestart om {startStr}</div>
        </div>

        <button
          className="btn-red btn-large"
          onClick={handleStop}
          disabled={stopping}
        >
          {stopping ? 'Stoppen…' : '■  Stop Parkeren'}
        </button>

      </div>
    </div>
  )
}

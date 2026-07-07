import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { getActiveSession, clearActiveSession, addSession } from '../../../services/storage'
import { notify } from '../../../services/notifications'
import { formatDuration } from '../../../services/receipts'
import { costFor, formatEuro } from '../../../services/tariffs'
import { TILE_URL, TILE_ATTRIBUTION, parkIcon } from '../../../utils/map'
import PlateBadge from '../../../components/common/PlateBadge'
import BottomNav from '../../../components/layout/BottomNav'
import { IconStop } from '../../../components/common/Icons'

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

    const startMs = new Date(session.startTime).getTime()
    const endMs = Date.now()
    const duration = Math.floor((endMs - startMs) / 1000)
    const completed = {
      ...session,
      id: startMs,
      endTime: new Date(endMs).toISOString(),
      duration,
      cost: costFor(duration, session.rate),
    }

    clearActiveSession()
    addSession(completed)
    notify('Parkeren gestopt', `Duur: ${formatDuration(duration)} · ${formatEuro(completed.cost)}`)
    navigate('/summary', { replace: true, state: { session: completed } })
  }

  if (!session) return null

  const startStr = new Date(session.startTime).toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit',
  })

  const h   = Math.floor(elapsed / 3600)
  const m   = Math.floor((elapsed % 3600) / 60)
  const s   = elapsed % 60
  const pad = v => String(v).padStart(2, '0')
  const timerStr = `${pad(h)}:${pad(m)}:${pad(s)}`

  const cost   = costFor(elapsed, session.rate)
  const parked = session.lat != null && session.lon != null

  return (
    <div className="screen">
      <div className="content session-dash">

        <div className="statuscard">
          <div className="sc-toprow">
            <span className="sc-label">Parkeren actief</span>
            <span className="sc-pill"><span className="sc-dot" />LIVE</span>
          </div>

          <div className="sc-title">{session.zoneDesc || 'Parkeersessie'}</div>
          <div className="sc-sub">Gestart om {startStr} · meter loopt</div>

          <div className="sc-tiles">
            <div className="sc-tile">
              <div className="sc-tile-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                Tijd
              </div>
              <div className="sc-tile-val">{timerStr}</div>
            </div>
            <div className="sc-tile">
              <div className="sc-tile-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                Kosten
              </div>
              <div className="sc-tile-val accent">{formatEuro(cost)}</div>
            </div>
          </div>

          <div className="sc-detail">
            <PlateBadge plate={session.plate} />
            <div className="sc-detail-txt">
              <div className="sc-detail-primary">{formatEuro(session.rate)}/uur</div>
              <div className="sc-detail-secondary">
                {session.zoneDesc ? 'Tarief uit zone · indicatief' : 'Standaardtarief · indicatief'}
              </div>
            </div>
          </div>
        </div>

        {parked && (
          <div className="minimap">
            <MapContainer
              center={[session.lat, session.lon]}
              zoom={16}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
              keyboard={false}
            >
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              <Marker position={[session.lat, session.lon]} icon={parkIcon} />
            </MapContainer>
            <span className="minimap-chip">Geparkeerd hier</span>
          </div>
        )}

        <div className="session-stop">
          <button
            className="btn btn-red"
            onClick={handleStop}
            disabled={stopping}
          >
            <IconStop size={16} />
            {stopping ? 'Stoppen…' : 'Stop parkeren'}
          </button>
        </div>

      </div>
      <BottomNav />
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { getProfile, getActiveSession, setActiveSession, getSettings } from '../utils/storage'
import { requestPermission, notify } from '../utils/notifications'
import { TILE_URL, TILE_ATTRIBUTION, userIcon } from '../utils/map'
import BottomNav from '../components/BottomNav'
import PlateBadge from '../components/PlateBadge'
import ParkingZones from '../components/ParkingZones'
import { IconPlay, IconLocate } from '../components/Icons'

const DEFAULT_CENTER = [51.9225, 4.47917] // Rotterdam
const GEO_OPTS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }

function getCurrentPosition() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve([coords.latitude, coords.longitude]),
      () => resolve(null),
      GEO_OPTS
    )
  })
}

function FlyToLocation({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 1.2 })
  }, [position])
  return null
}

// Exposes an imperative recenter handler so the button (rendered outside the
// map) can fly back to the user's location on demand.
function MapController({ recenterRef }) {
  const map = useMap()
  useEffect(() => {
    recenterRef.current = pos => map.flyTo(pos, 16, { duration: 1 })
  }, [map])
  return null
}

export default function Home() {
  const navigate = useNavigate()
  const [profile,  setProfile]  = useState(null)
  const [location, setLocation] = useState(null)
  const [starting, setStarting] = useState(false)
  const recenterRef = useRef(null)

  useEffect(() => {
    const p = getProfile()
    if (!p) { navigate('/login', { replace: true }); return }
    if (getActiveSession()) { navigate('/session', { replace: true }); return }
    setProfile(p)

    if (getSettings().location) {
      navigator.geolocation?.getCurrentPosition(
        ({ coords }) => setLocation([coords.latitude, coords.longitude]),
        () => {},
        GEO_OPTS
      )
    }
  }, [])

  async function handleStart() {
    setStarting(true)
    await requestPermission()
    // Capture a fix at tap time so the session map works even if the prefetch
    // hadn't resolved yet. Respects the location toggle in Settings.
    const pos = getSettings().location ? (location ?? await getCurrentPosition()) : null
    setActiveSession({
      plate: profile.plate,
      startTime: new Date().toISOString(),
      lat: pos?.[0] ?? null,
      lon: pos?.[1] ?? null,
    })
    navigate('/session')
    notify('Parkeren gestart', `Kenteken ${profile.plate}`)
  }

  async function handleRecenter() {
    if (location) recenterRef.current?.(location)
    const fresh = await getCurrentPosition()
    if (fresh) {
      setLocation(fresh)
      recenterRef.current?.(fresh)
    }
  }

  if (!profile) return null

  return (
    <div className="screen screen-home">
      <div className="map-full">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={13}
          zoomControl={false}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <ParkingZones />
          <FlyToLocation position={location} />
          <MapController recenterRef={recenterRef} />
          {location && <Marker position={location} icon={userIcon} />}
        </MapContainer>
        {location && (
          <button
            className="map-recenter"
            onClick={handleRecenter}
            aria-label="Naar mijn locatie"
          >
            <IconLocate size={20} />
          </button>
        )}
        <div className="zone-legend">
          <span><i style={{ background: '#4ADE80' }} />tot €1</span>
          <span><i style={{ background: '#FBBF24' }} />€1–2,50</span>
          <span><i style={{ background: '#FB923C' }} />€2,50–4</span>
          <span><i style={{ background: '#E5484D' }} />€4+</span>
          <em>Tarieven indicatief · demo</em>
        </div>
      </div>

      <div className="topbar">
        <div className="chip-logo"><span>P</span>ParkWise</div>
        <div className="avatar">{profile.name?.charAt(0).toUpperCase() || 'P'}</div>
      </div>

      <div className="sheet">
        <div className="sheet-handle" />
        <div className="vehicle-row">
          <div className="vehicle-id">
            <PlateBadge plate={profile.plate} />
            <div className="vehicle-meta">
              <span className="vehicle-label">Voertuig</span>
              <span className="vehicle-name">{profile.name}</span>
            </div>
          </div>
        </div>
        <button
          className="btn btn-yellow"
          onClick={handleStart}
          disabled={starting}
        >
          <IconPlay size={16} />
          {starting ? 'Bezig…' : 'Start parkeren'}
        </button>
        <BottomNav active="home" />
      </div>
    </div>
  )
}

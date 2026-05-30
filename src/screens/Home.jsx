import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { getProfile, getActiveSession, setActiveSession } from '../utils/storage'
import { requestPermission, notify } from '../utils/notifications'
import BottomNav from '../components/BottomNav'

const DEFAULT_CENTER = [51.9225, 4.47917] // Rotterdam

// Blue dot marker for user location
const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#1B45C8;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function FlyToLocation({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 1.2 })
  }, [position])
  return null
}

export default function Home() {
  const navigate = useNavigate()
  const [profile,  setProfile]  = useState(null)
  const [location, setLocation] = useState(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const p = getProfile()
    if (!p) { navigate('/onboarding', { replace: true }); return }
    if (getActiveSession()) { navigate('/session', { replace: true }); return }
    setProfile(p)
    requestPermission()

    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setLocation([coords.latitude, coords.longitude]),
      () => {}
    )
  }, [])

  function handleStart() {
    setStarting(true)
    setActiveSession({
      plate: profile.plate,
      startTime: new Date().toISOString(),
      lat: location?.[0] ?? null,
      lon: location?.[1] ?? null,
    })
    notify('Parkeren gestart', `Kenteken ${profile.plate}`)
    navigate('/session')
  }

  if (!profile) return null

  return (
    <div className="screen">
      <header className="header">
        <span className="header-logo">P</span>
        <span className="header-title">ParkWise</span>
      </header>

      <div className="map-wrap">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FlyToLocation position={location} />
          {location && <Marker position={location} icon={userIcon} />}
        </MapContainer>
      </div>

      <div className="home-bottom">
        <div className="vehicle-row">
          <div className="vehicle-info">
            <span className="vehicle-label">Voertuig</span>
            <span className="vehicle-plate">{profile.plate}</span>
          </div>
          <span className="vehicle-name">{profile.name}</span>
        </div>
        <button
          className="btn-yellow btn-large"
          onClick={handleStart}
          disabled={starting}
        >
          {starting ? 'Bezig…' : '▶  Start Parkeren'}
        </button>
      </div>

      <BottomNav active="home" />
    </div>
  )
}

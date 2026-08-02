import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { getProfile, getActiveSession, setActiveSession, getSettings, saveSettings } from '../../../services/storage'
import { rateForSession, formatEuro, formatWhen, effectiveDayCap, parseAmount } from '../../../services/tariffs'
import { chargePointsAvailable } from '../../../services/charging'
import { geocode } from '../../../services/geolocation'
import { requestPermission, notify } from '../../../services/notifications'
import { TILE_URL, TILE_ATTRIBUTION, userIcon } from '../../../utils/map'
import BottomNav from '../../../components/layout/BottomNav'
import PlateBadge from '../../../components/common/PlateBadge'
import ParkingZones from '../../parking-zones/components/ParkingZones'
import ChargePoints from '../../charging/components/ChargePoints'
import NavigateSheet from '../../../components/common/NavigateSheet'
import { IconPlay, IconLocate, IconSearch, IconBolt, IconNavigate } from '../../../components/common/Icons'

const DEFAULT_CENTER = [51.9225, 4.47917] // Rotterdam
const GEO_OPTS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }

// States in which starting a session costs nothing (shown in green).
const FREE_STATES = new Set(['permit', 'free', 'evening'])

// What parking here costs *right now*, said plainly. Paid hours end in the
// evening and on Sunday in most of the country, so a zone being paid at all is
// not the same as it being paid at this moment.
function tariffHint(t) {
  switch (t.tariff) {
    case 'paid':
      return `${formatEuro(t.rate)}/uur · ${t.zoneDesc}` +
        (t.paidUntil ? ` · gratis vanaf ${formatWhen(t.paidUntil)}` : '')
    case 'permit':
      return `Vergunning · gratis in ${t.zoneDesc}`
    case 'evening':
      return 'Gratis nu · betaalde zone' +
        (t.nextPaid ? `, tarief vanaf ${formatWhen(t.nextPaid)}` : '')
    case 'free':
      return 'Gratis parkeren hier · geen betaalde zone'
    default:
      return t.zoneDesc
        ? `Betaalde zone · tarief onbekend, we rekenen niets`
        : 'Tarief onbekend · we rekenen niets'
  }
}

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
  const [active,   setActive]   = useState(null)
  const [locEnabled, setLocEnabled] = useState(true)
  const [starting, setStarting] = useState(false)
  const [query,     setQuery]     = useState('')
  const [searchPos, setSearchPos] = useState(null)
  const [searchLabel, setSearchLabel] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const [tariffHere, setTariffHere] = useState(null)
  const [showCharging, setShowCharging] = useState(false)
  const [navDest, setNavDest] = useState(null)
  const recenterRef = useRef(null)

  // Show what parking costs here *before* the user starts, so a free spot is
  // never mistaken for a paid one.
  useEffect(() => {
    if (!location) { setTariffHere(null); return }
    let alive = true
    rateForSession(location[0], location[1], getSettings().permitZones)
      .then(t => { if (alive) setTariffHere(t) })
    return () => { alive = false }
  }, [location])

  useEffect(() => {
    const p = getProfile()
    if (!p) { navigate('/login', { replace: true }); return }
    if (!getSettings().onboardingDone) { navigate('/onboarding', { replace: true }); return }
    setProfile(p)
    setActive(getActiveSession())
    setLocEnabled(getSettings().location)
    setShowCharging(!!getSettings().showCharging)

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
    const settings = getSettings()
    const pos = settings.location ? (location ?? await getCurrentPosition()) : null
    // Resolve the tariff from the parked location. Outside every paid zone the
    // session is free (€0) — we never fall back to an invented rate. The zone's
    // weekly windows travel with the session so the cost stops accruing when
    // paid hours end, whatever the zone data says later.
    const t = await rateForSession(pos?.[0] ?? null, pos?.[1] ?? null, settings.permitZones)
    setActiveSession({
      plate: profile.plate,
      startTime: new Date().toISOString(),
      lat: pos?.[0] ?? null,
      lon: pos?.[1] ?? null,
      rate: t.rate,
      windows: t.tariff === 'permit' ? null : t.windows,
      // Ceiling for a day of this session, fixed at start: the zone's dagtarief
      // or the driver's own limit, whichever is lower.
      dayCap: effectiveDayCap(t.zoneDayCap, parseAmount(settings.maxDailyCost)),
      zoneDesc: t.zoneDesc,
      zoneId: t.zoneId,
      tariff: t.tariff,
    })
    navigate('/session')
    notify('Parkeren gestart', `Kenteken ${profile.plate}`)
  }

  async function handleSearch(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    setSearchErr('')
    const result = await geocode(q)
    setSearching(false)
    if (result) {
      setSearchPos(result.pos)
      setSearchLabel(result.label)
      recenterRef.current?.(result.pos)
    } else {
      setSearchErr('Geen locatie gevonden')
    }
  }

  function toggleCharging() {
    const next = !showCharging
    setShowCharging(next)
    saveSettings({ showCharging: next })
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
          {showCharging && <ChargePoints onNavigate={setNavDest} />}
          <FlyToLocation position={location} />
          <MapController recenterRef={recenterRef} />
          {location && <Marker position={location} icon={userIcon} />}
          {searchPos && <Marker position={searchPos} />}
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
        {chargePointsAvailable && (
          <button
            className={`map-charging${showCharging ? ' on' : ''}`}
            onClick={toggleCharging}
            aria-pressed={showCharging}
            aria-label="Laadpunten tonen"
          >
            <IconBolt size={20} />
          </button>
        )}
        <div className="zone-legend">
          <span><i style={{ background: '#4ADE80' }} />tot €1</span>
          <span><i style={{ background: '#FBBF24' }} />€1–2,50</span>
          <span><i style={{ background: '#FB923C' }} />€2,50–4</span>
          <span><i style={{ background: '#E5484D' }} />€4+</span>
          <span><i style={{ background: '#9AA3B8' }} />onbekend</span>
          <em>Tarieven indicatief · demo</em>
        </div>
      </div>

      <div className="topbar">
        <div className="chip-logo"><span>P</span>ParkMatiq</div>
        <div className="avatar">{profile.name?.charAt(0).toUpperCase() || 'P'}</div>
      </div>

      <form className="map-search" onSubmit={handleSearch}>
        <div className="map-search-field">
          <IconSearch size={18} />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchErr('') }}
            placeholder="Zoek een straat of plaats…"
            enterKeyHint="search"
            aria-label="Zoek locatie"
          />
          {query && (
            <button
              type="button"
              className="map-search-clear"
              onClick={() => { setQuery(''); setSearchPos(null); setSearchErr(''); setSearchLabel('') }}
              aria-label="Wissen"
            >✕</button>
          )}
        </div>
        {searching && <span className="map-search-status">Zoeken…</span>}
        {searchErr && <span className="map-search-status err">{searchErr}</span>}
        {!searching && !searchErr && searchLabel && (
          <span className="map-search-status found">
            <span className="search-found-label">{searchLabel}</span>
            <button
              type="button"
              className="search-nav-btn"
              onClick={() => setNavDest({ lat: searchPos[0], lon: searchPos[1], label: searchLabel })}
            >
              <IconNavigate size={13} /> Navigeer
            </button>
          </span>
        )}
      </form>

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
        {active ? (
          <button
            className="btn btn-yellow"
            onClick={() => navigate('/session')}
          >
            <span className="live-dot" /> Naar actieve sessie
          </button>
        ) : (
          <>
            {tariffHere && (
              <p className={`start-hint${FREE_STATES.has(tariffHere.tariff) ? ' free' : ''}`}>
                {tariffHint(tariffHere)}
              </p>
            )}
            <button
              className="btn btn-yellow"
              onClick={handleStart}
              disabled={starting}
            >
              <IconPlay size={16} />
              {starting ? 'Bezig…' : 'Start parkeren'}
            </button>
            {!locEnabled && (
              <p className="start-hint">Locatie staat uit — het tarief kan niet worden bepaald.</p>
            )}
          </>
        )}
        <BottomNav active="home" />
      </div>

      <NavigateSheet destination={navDest} onClose={() => setNavDest(null)} />
    </div>
  )
}

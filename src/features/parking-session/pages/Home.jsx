import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { getProfile, getActiveSession, getSettings, saveSettings } from '../../../services/storage'
import { rateForSession, rateForZone, nearbyZones, formatEuro, formatWhen } from '../../../services/tariffs'
import { chargePointsAvailable } from '../../../services/charging'
import { geocode } from '../../../services/geolocation'
import { requestPermission } from '../../../services/notifications'
import { TILE_URL, TILE_ATTRIBUTION, userIcon } from '../../../utils/map'
import BottomNav from '../../../components/layout/BottomNav'
import PlateBadge from '../../../components/common/PlateBadge'
import ParkingZones from '../../parking-zones/components/ParkingZones'
import ZonePicker from '../../parking-zones/components/ZonePicker'
import ChargePoints from '../../charging/components/ChargePoints'
import NavigateSheet from '../../../components/common/NavigateSheet'
import PurposeToggle from '../components/PurposeToggle'
import VehiclePicker from '../components/VehiclePicker'
import { vehicleList, defaultPlate } from '../../../utils/vehicles'
import { startSession } from '../startSession'
import { IconPlay, IconLocate, IconSearch, IconBolt, IconNavigate } from '../../../components/common/Icons'

const DEFAULT_CENTER = [51.9225, 4.47917] // Rotterdam
const GEO_OPTS = { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }

// How far to look for zones to offer in the picker. Wider than the slack that
// decides free vs unknown: someone correcting us knows where they parked, and
// the outline they belong to may sit further off than we would ever infer.
const PICKER_RADIUS_M = 150

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
      // Close enough to a paid zone that "gratis" would be a guess. Name the
      // zone and its rate: the driver is standing next to the sign that settles
      // it, and that is a better answer than anything we can infer from a fix.
      if (t.nearZone) {
        const rate = t.nearZone.maxRate
          ? ` (tot ${formatEuro(t.nearZone.maxRate)}/uur)`
          : ''
        return `${t.nearZone.desc}${rate} ligt ${t.nearZone.distance} m verderop · ` +
          'controleer het bord — we rekenen niets'
      }
      return t.zoneDesc
        ? `Betaalde zone · tarief onbekend, we rekenen niets`
        : 'Tarief onbekend · we rekenen niets'
  }
}

// Resolves to { pos, accuracy } — the error radius travels with the fix because
// the tariff lookup needs it to decide whether "no zone here" is trustworthy.
function getCurrentPosition() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        pos: [coords.latitude, coords.longitude],
        accuracy: coords.accuracy ?? null,
      }),
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
  const [accuracy, setAccuracy] = useState(null)
  const [active,   setActive]   = useState(null)
  const [locEnabled, setLocEnabled] = useState(true)
  const [starting, setStarting] = useState(false)
  const [query,     setQuery]     = useState('')
  const [searchPos, setSearchPos] = useState(null)
  const [searchLabel, setSearchLabel] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const [tariffHere, setTariffHere] = useState(null)
  // Zones near enough to be the real answer, and the one the driver picked when
  // our own verdict was wrong. A pick outranks the fix until the car moves.
  const [zoneOptions, setZoneOptions] = useState([])
  const [pickedZone, setPickedZone] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showCharging, setShowCharging] = useState(false)
  const [navDest, setNavDest] = useState(null)
  const [purpose, setPurpose] = useState(() => getSettings().sessionPurpose)
  const [vehicles, setVehicles] = useState([])
  const [plate, setPlate] = useState(null)
  const recenterRef = useRef(null)

  // Show what parking costs here *before* the user starts, so a free spot is
  // never mistaken for a paid one.
  useEffect(() => {
    if (!location) {
      setTariffHere(null)
      setZoneOptions([])
      setPickedZone(null)
      return
    }
    let alive = true
    // A new fix invalidates an earlier correction — it was made about a spot
    // the car is no longer at.
    setPickedZone(null)
    Promise.all([
      rateForSession(location[0], location[1], getSettings().permitZones, { accuracy }),
      nearbyZones(location[0], location[1], PICKER_RADIUS_M),
    ]).then(([t, opts]) => {
      if (!alive) return
      setTariffHere(t)
      setZoneOptions(opts)
    })
    return () => { alive = false }
  }, [location, accuracy])

  useEffect(() => {
    const p = getProfile()
    if (!p) { navigate('/login', { replace: true }); return }
    if (!getSettings().onboardingDone) { navigate('/onboarding', { replace: true }); return }
    setProfile(p)
    setVehicles(vehicleList(p, getSettings()))
    setPlate(defaultPlate(p, getSettings()))
    setActive(getActiveSession())
    setLocEnabled(getSettings().location)
    setShowCharging(!!getSettings().showCharging)

    if (getSettings().location) {
      navigator.geolocation?.getCurrentPosition(
        ({ coords }) => {
          setLocation([coords.latitude, coords.longitude])
          setAccuracy(coords.accuracy ?? null)
        },
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
    let pos = null, acc = null
    if (settings.location) {
      if (location) {
        pos = location
        acc = accuracy
      } else {
        const fix = await getCurrentPosition()
        if (fix) { pos = fix.pos; acc = fix.accuracy }
      }
    }
    // A zone the driver picked wins over the fix — they can read the sign and
    // we cannot. Otherwise resolve from the parked location, passing the fix's
    // error radius: clear of every paid zone the session is free (€0), but close
    // to one the answer is 'unknown' rather than a promise of free parking. We
    // never fall back to an invented rate either way. The zone's weekly windows
    // travel with the session so the cost stops accruing when paid hours end,
    // whatever the zone data says later.
    const t = pickedZone
      ? rateForZone(pickedZone, settings.permitZones)
      : await rateForSession(
          pos?.[0] ?? null, pos?.[1] ?? null, settings.permitZones, { accuracy: acc }
        )
    startSession({ plate, purpose, pos, t, zonePicked: !!pickedZone })
    navigate('/session')
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

  // The driver overriding our verdict. Price it immediately so the sheet shows
  // what the correction actually costs before they commit to it.
  function handlePickZone(zone) {
    setPickedZone(zone)
    setTariffHere(rateForZone(zone, getSettings().permitZones))
    setPickerOpen(false)
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
      setLocation(fresh.pos)
      setAccuracy(fresh.accuracy)
      recenterRef.current?.(fresh.pos)
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
          <ParkingZones onNavigate={setNavDest} />
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
        {!active && vehicles.length > 1 ? (
          <VehiclePicker vehicles={vehicles} value={plate} onChange={setPlate} />
        ) : (
          <div className="vehicle-row">
            <div className="vehicle-id">
              {/* A running session shows the car it was started for. */}
              <PlateBadge plate={active?.plate ?? plate} />
              <div className="vehicle-meta">
                <span className="vehicle-label">Voertuig</span>
                <span className="vehicle-name">
                  {vehicles.find(v => v.plate === (active?.plate ?? plate))?.label || profile.name}
                </span>
              </div>
            </div>
          </div>
        )}
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
                {pickedZone && <span className="zone-picked-tag">Zelf gekozen</span>}
                {tariffHint(tariffHere)}
              </p>
            )}
            {zoneOptions.length > 0 && (
              <button className="zone-pick-link" onClick={() => setPickerOpen(true)}>
                {pickedZone ? 'Andere zone kiezen' : 'Klopt de zone niet? Kies zelf'}
              </button>
            )}
            <PurposeToggle value={purpose} onChange={setPurpose} />
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

      <ZonePicker
        open={pickerOpen}
        zones={zoneOptions}
        selected={pickedZone}
        onPick={handlePickZone}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  )
}

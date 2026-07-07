import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, saveProfile, clearAllData, getSettings, saveSettings } from '../../../services/storage'
import { normalizePlate, isValidPlate } from '../../../utils/plate'
import { currentTheme, setTheme } from '../../../utils/theme'
import BottomNav from '../../../components/layout/BottomNav'
import { IconUser, IconMail } from '../../../components/common/Icons'

export default function Settings() {
  const navigate = useNavigate()
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [plate, setPlate] = useState('')
  const [saved, setSaved] = useState(false)
  const [plateErr, setPlateErr] = useState('')
  const [locationOn, setLocationOn] = useState(false)
  const [locBlocked, setLocBlocked] = useState(false)
  const [darkOn, setDarkOn] = useState(false)
  const [budget, setBudget] = useState('')
  const [permit, setPermit] = useState('')
  const [endPref, setEndPref] = useState('balanced')

  useEffect(() => {
    const p = getProfile()
    if (!p) { navigate('/login', { replace: true }); return }
    setName(p.name)
    setEmail(p.email || '')
    setPlate(p.plate)
    const s = getSettings()
    setLocationOn(s.location)
    setBudget(s.monthlyBudget || '')
    setPermit(s.permitPostcode || '')
    setEndPref(s.endPreference || 'balanced')
    setDarkOn(currentTheme() === 'dark')
  }, [])

  function toggleDark() {
    const next = darkOn ? 'light' : 'dark'
    setDarkOn(!darkOn)
    setTheme(next)
  }

  function handleBudget(v) {
    setBudget(v)
    saveSettings({ monthlyBudget: v.trim() })
  }

  function handlePermit(v) {
    const up = v.toUpperCase()
    setPermit(up)
    saveSettings({ permitPostcode: up.trim() })
  }

  function handleEndPref(v) {
    setEndPref(v)
    saveSettings({ endPreference: v })
  }

  async function toggleLocation() {
    if (locationOn) {
      saveSettings({ location: false })
      setLocationOn(false)
      return
    }
    // Turning on: trigger the browser's own location prompt. A web app can't
    // grant OS/browser permission itself — if the browser blocks it, say so.
    const granted = await new Promise(resolve => {
      if (!navigator.geolocation) return resolve(false)
      navigator.geolocation.getCurrentPosition(
        () => resolve(true), () => resolve(false), { timeout: 8000 }
      )
    })
    if (granted) {
      saveSettings({ location: true })
      setLocationOn(true)
      setLocBlocked(false)
    } else {
      setLocBlocked(true)
    }
  }

  function handleSave() {
    if (!name.trim() || !plate.trim()) return
    if (!isValidPlate(plate)) { setPlateErr('Dat lijkt geen geldig Nederlands kenteken'); return }
    const profile = { name: name.trim(), plate: normalizePlate(plate) }
    if (email.trim()) profile.email = email.trim()
    saveProfile(profile)
    setPlateErr('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleClear() {
    if (!window.confirm('Weet je zeker dat je alle data wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return
    clearAllData()
    navigate('/login', { replace: true })
  }

  return (
    <div className="screen">
      <header className="page-head">
        <h1>Instellingen</h1>
      </header>

      <div className="content">

        <div className="card">
          <h2 className="card-title">Profiel</h2>

          <div className="form-group">
            <label>Naam</label>
            <div className="input-row">
              <IconUser size={17} />
              <input
                value={name}
                onChange={e => { setName(e.target.value); setSaved(false) }}
                placeholder="Je naam"
                autoComplete="name"
              />
            </div>
          </div>

          <div className="form-group">
            <label>E-mailadres</label>
            <div className="input-row">
              <IconMail size={17} />
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setSaved(false) }}
                placeholder="E-mailadres (optioneel)"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Kenteken</label>
            <div className="input-row input-plate">
              <span className="plate-strip">NL</span>
              <input
                value={plate}
                onChange={e => { setPlate(e.target.value.toUpperCase()); setSaved(false); setPlateErr('') }}
                placeholder="AB-123-C"
                autoCapitalize="characters"
                autoComplete="off"
              />
            </div>
          </div>

          {plateErr && <p className="form-error">{plateErr}</p>}

          <button className="btn btn-yellow" onClick={handleSave}>
            {saved ? '✓  Opgeslagen' : 'Opslaan'}
          </button>
        </div>

        <div className="card">
          <h2 className="card-title">Toestemmingen</h2>
          <div className="toggle-row">
            <div className="toggle-info">
              <span className="toggle-label">Locatie</span>
              <span className="toggle-desc">
                Gebruik je locatie om je parkeerplek op de kaart te tonen.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={locationOn}
              aria-label="Locatie"
              className={`switch ${locationOn ? 'switch-on' : ''}`}
              onClick={toggleLocation}
            >
              <span className="switch-knob" />
            </button>
          </div>
          {locBlocked && (
            <p className="card-desc" style={{ marginTop: 12, marginBottom: 0 }}>
              Locatie is geblokkeerd in je browserinstellingen. Schakel het daar in
              om deze functie te gebruiken.
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Weergave</h2>
          <div className="toggle-row">
            <div className="toggle-info">
              <span className="toggle-label">Donkere modus</span>
              <span className="toggle-desc">Pas de app aan de nacht aan.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={darkOn}
              aria-label="Donkere modus"
              className={`switch ${darkOn ? 'switch-on' : ''}`}
              onClick={toggleDark}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Voorkeuren</h2>

          <div className="form-group">
            <label>Maandbudget (€)</label>
            <div className="input-row">
              <input
                type="text"
                inputMode="decimal"
                value={budget}
                onChange={e => handleBudget(e.target.value)}
                placeholder="bijv. 40"
              />
            </div>
            <span className="field-hint">Leeg = geen budget. Je voortgang staat bij Geschiedenis.</span>
          </div>

          <div className="form-group">
            <label>Bewonersvergunning (postcode)</label>
            <div className="input-row">
              <input
                value={permit}
                onChange={e => handlePermit(e.target.value)}
                placeholder="bijv. 3011 AB"
                autoCapitalize="characters"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Sessie stoppen</label>
            <div className="seg-control">
              {[
                ['balanced', 'Gebalanceerd'],
                ['eager',    'Elke cent'],
                ['manual',   'Handmatig'],
              ].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  className={`seg-opt${endPref === val ? ' seg-opt-active' : ''}`}
                  onClick={() => handleEndPref(val)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card card-danger">
          <h2 className="card-title">Gegevens</h2>
          <p className="card-desc">Verwijdert je profiel, kenteken en alle parkeergeschiedenis.</p>
          <button className="btn-red-outline" onClick={handleClear}>
            Verwijder alle data
          </button>
        </div>

      </div>

      <BottomNav active="settings" />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, saveProfile, clearAllData } from '../utils/storage'
import BottomNav from '../components/BottomNav'

export default function Settings() {
  const navigate = useNavigate()
  const [name,  setName]  = useState('')
  const [plate, setPlate] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = getProfile()
    if (!p) { navigate('/onboarding', { replace: true }); return }
    setName(p.name)
    setPlate(p.plate)
  }, [])

  function handleSave() {
    if (!name.trim() || !plate.trim()) return
    saveProfile({ name: name.trim(), plate: plate.trim().toUpperCase() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleClear() {
    if (!window.confirm('Weet je zeker dat je alle data wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return
    clearAllData()
    navigate('/onboarding', { replace: true })
  }

  return (
    <div className="screen">
      <header className="header">
        <span className="header-logo">P</span>
        <span className="header-title">Instellingen</span>
      </header>

      <div className="content">

        <div className="card">
          <h2 className="card-title">Profiel</h2>

          <div className="form-group">
            <label>Naam</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setSaved(false) }}
              placeholder="Je naam"
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label>Kenteken</label>
            <input
              value={plate}
              onChange={e => { setPlate(e.target.value.toUpperCase()); setSaved(false) }}
              placeholder="AB-123-C"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>

          <button className="btn-yellow" onClick={handleSave}>
            {saved ? '✓  Opgeslagen' : 'Opslaan'}
          </button>
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

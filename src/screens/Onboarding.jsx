import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProfile } from '../utils/storage'

export default function Onboarding() {
  const navigate = useNavigate()
  const [name, setName]   = useState('')
  const [plate, setPlate] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    if (!name.trim())  { setError('Vul je naam in'); return }
    if (!plate.trim()) { setError('Vul je kenteken in'); return }
    saveProfile({ name: name.trim(), plate: plate.trim().toUpperCase() })
    navigate('/', { replace: true })
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="screen screen-onboarding">
      <div className="onboarding-body">

        <div className="onboarding-logo">
          <div className="logo-icon">P</div>
          <span className="logo-name">ParkWise</span>
        </div>

        <div className="onboarding-text">
          <h1>Welkom</h1>
          <p>Stel je voertuig in om te beginnen.</p>
        </div>

        <div className="form-group">
          <label>Naam</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={handleKey}
            placeholder="Je naam"
            autoComplete="name"
          />
        </div>

        <div className="form-group">
          <label>Kenteken</label>
          <input
            value={plate}
            onChange={e => { setPlate(e.target.value.toUpperCase()); setError('') }}
            onKeyDown={handleKey}
            placeholder="AB-123-C"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="btn-yellow btn-large" onClick={handleSubmit}>
          Beginnen
        </button>

      </div>
    </div>
  )
}

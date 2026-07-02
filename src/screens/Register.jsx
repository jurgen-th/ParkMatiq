import { useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { saveProfile } from '../utils/storage'
import { normalizePlate, isValidPlate } from '../utils/plate'
import { IconMail, IconLock, IconUser, IconEye, IconEyeOff } from '../components/Icons'

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const guest = params.get('guest') === '1'

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [plate,    setPlate]    = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')

  function handleSubmit() {
    if (!name.trim()) { setError('Vul je naam in'); return }
    if (!guest) {
      if (!email.trim())    { setError('Vul je e-mailadres in'); return }
      if (!password.trim()) { setError('Vul een wachtwoord in'); return }
    }
    if (!plate.trim())      { setError('Vul je kenteken in'); return }
    if (!isValidPlate(plate)) { setError('Dat lijkt geen geldig Nederlands kenteken'); return }

    // Wachtwoord wordt bewust niet opgeslagen — echte auth volgt via Supabase.
    const profile = { name: name.trim(), plate: normalizePlate(plate) }
    if (!guest && email.trim()) profile.email = email.trim()
    saveProfile(profile)
    navigate('/', { replace: true })
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="screen screen-auth">
      <div className="auth-hero">
        <div className="logo-icon">P</div>
        <div>
          <div className="auth-hero-name">ParkWise</div>
          <div className="auth-hero-tag">Slim parkeren</div>
        </div>
      </div>

      <div className="auth-sheet">
        <h1>{guest ? 'Stel je voertuig in' : 'Account aanmaken'}</h1>

        {location.state?.notice && (
          <p className="form-hint">
            Geen account gevonden op dit apparaat. Maak hieronder je profiel aan.
          </p>
        )}

        <div className="form-group">
          <div className="input-row">
            <IconUser size={17} />
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={handleKey}
              placeholder="Je naam"
              autoComplete="name"
            />
          </div>
        </div>

        {!guest && (
          <>
            <div className="form-group">
              <div className="input-row">
                <IconMail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={handleKey}
                  placeholder="E-mailadres"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <div className="input-row">
                <IconLock size={17} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={handleKey}
                  placeholder="Wachtwoord"
                  autoComplete="new-password"
                />
                <button
                  className="icon-btn"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                >
                  {showPw ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="form-group">
          <label>Kenteken</label>
          <div className="input-row input-plate">
            <span className="plate-strip">NL</span>
            <input
              value={plate}
              onChange={e => { setPlate(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={handleKey}
              placeholder="AB-123-C"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-yellow" onClick={handleSubmit}>
          {guest ? 'Beginnen' : 'Account aanmaken'}
        </button>

        <div className="auth-foot">
          Al een account?{' '}
          <button className="auth-link" onClick={() => navigate('/login')}>
            Inloggen
          </button>
        </div>
      </div>
    </div>
  )
}

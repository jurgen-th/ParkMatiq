import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getProfile } from '../../../services/storage'
import { supabase, backendEnabled } from '../../../services/backend/supabase'
import { pullAll } from '../../../services/backend/sync'
import { IconMail, IconLock, IconEye, IconEyeOff } from '../../../components/common/Icons'

// NL-vriendelijke vertaling van de gangbare Supabase-auth fouten.
function authErrorNL(error) {
  const msg = error?.message || ''
  if (msg.includes('Invalid login credentials')) return 'Onjuist e-mailadres of wachtwoord'
  if (msg.includes('Email not confirmed')) return 'Bevestig eerst je e-mailadres via de link in je inbox'
  return `Inloggen mislukt: ${msg}`
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [hint,     setHint]     = useState(
    location.state?.confirmNotice
      ? 'Account aangemaakt. Bevestig je e-mailadres via de link in je inbox en log daarna in.'
      : ''
  )
  const [busy,     setBusy]     = useState(false)

  // Met backend: echte Supabase-login + data van de server halen.
  // Zonder backend (mock): inloggen slaagt als er lokaal een profiel bestaat.
  async function handleLogin() {
    if (!email.trim())    { setError('Vul je e-mailadres in'); return }
    if (!password.trim()) { setError('Vul je wachtwoord in'); return }

    if (backendEnabled) {
      setBusy(true)
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (err) {
        setBusy(false)
        setError(authErrorNL(err))
        return
      }
      await pullAll()
      setBusy(false)
      navigate('/', { replace: true })
      return
    }

    if (getProfile()) {
      navigate('/', { replace: true })
    } else {
      navigate('/register', { state: { email: email.trim(), notice: true } })
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="screen screen-auth">
      <div className="auth-hero">
        <img className="logo-icon" src="./icon-192.png" alt="" />
        <div>
          <div className="auth-hero-name">ParkMatiq</div>
          <div className="auth-hero-tag">Slim parkeren</div>
        </div>
      </div>

      <div className="auth-sheet">
        <h1>Welkom terug</h1>

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
              autoComplete="current-password"
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

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-yellow" onClick={handleLogin} disabled={busy}>
          {busy ? 'Inloggen…' : 'Inloggen'}
        </button>

        <div className="auth-divider">of</div>

        <button
          className="btn btn-ghost"
          onClick={() => setHint('Inloggen met Google komt binnenkort.')}
        >
          Doorgaan met Google
        </button>

        {hint && <p className="form-hint" style={{ marginTop: 10, textAlign: 'center' }}>{hint}</p>}

        <div className="auth-foot">
          Nog geen account?{' '}
          <button className="auth-link" onClick={() => navigate('/register')}>
            Registreren
          </button>
          <button className="auth-skip" onClick={() => navigate('/register?guest=1')}>
            Doorgaan zonder account
          </button>
        </div>
      </div>
    </div>
  )
}

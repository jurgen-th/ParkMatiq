import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile } from '../utils/storage'
import { IconMail, IconLock, IconEye, IconEyeOff } from '../components/Icons'

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [hint,     setHint]     = useState('')

  // Mock-auth: Supabase volgt later. Inloggen slaagt als er lokaal een
  // profiel bestaat; anders sturen we door naar registreren.
  function handleLogin() {
    if (!email.trim())    { setError('Vul je e-mailadres in'); return }
    if (!password.trim()) { setError('Vul je wachtwoord in'); return }
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
        <div className="logo-icon">P</div>
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

        <button className="btn btn-yellow" onClick={handleLogin}>
          Inloggen
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

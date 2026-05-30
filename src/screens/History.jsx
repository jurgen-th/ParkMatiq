import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions, getProfile } from '../utils/storage'
import { generateReceipt, formatDuration } from '../utils/pdf'
import BottomNav from '../components/BottomNav'

export default function History() {
  const navigate  = useNavigate()
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    if (!getProfile()) { navigate('/onboarding', { replace: true }); return }
    setSessions(getSessions())
  }, [])

  return (
    <div className="screen">
      <header className="header">
        <span className="header-logo">P</span>
        <span className="header-title">Geschiedenis</span>
      </header>

      <div className="content">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🅿️</div>
            <p>Nog geen parkeersessies</p>
            <span>Start je eerste sessie via Home.</span>
          </div>
        ) : (
          <div className="session-list">
            {sessions.map(s => {
              const d = new Date(s.startTime)
              const dateStr = d.toLocaleDateString('nl-NL', {
                day: 'numeric', month: 'short', year: 'numeric',
              })
              const timeStr = d.toLocaleTimeString('nl-NL', {
                hour: '2-digit', minute: '2-digit',
              })
              return (
                <div key={s.id} className="session-item">
                  <div className="session-item-info">
                    <span className="session-item-plate">{s.plate}</span>
                    <span className="session-item-date">{dateStr} · {timeStr}</span>
                    <span className="session-item-duration">{formatDuration(s.duration)}</span>
                  </div>
                  <button
                    className="btn-outline-sm"
                    onClick={() => generateReceipt(s)}
                  >
                    PDF
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav active="history" />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions, getProfile, getSettings } from '../utils/storage'
import { generateReceipt, formatDuration } from '../utils/pdf'
import { sessionCost, formatEuro } from '../utils/tariff'
import BottomNav from '../components/BottomNav'
import PlateBadge from '../components/PlateBadge'
import { IconDownload } from '../components/Icons'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export default function History() {
  const navigate  = useNavigate()
  const [sessions, setSessions] = useState([])
  const [filter, setFilter]     = useState('all')
  const [baseline, setBaseline] = useState(18)

  useEffect(() => {
    if (!getProfile()) { navigate('/login', { replace: true }); return }
    setSessions(getSessions())
    setBaseline(getSettings().dayBaseline)
  }, [])

  const visible = filter === 'week'
    ? sessions.filter(s => Date.now() - new Date(s.startTime).getTime() < WEEK_MS)
    : sessions

  // "Saved this month" = for each session, the flat day-rate you'd otherwise
  // have paid, minus what ParkWise actually charged (floored at 0).
  const now = new Date()
  const monthSessions = sessions.filter(s => {
    const d = new Date(s.startTime)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const saved = monthSessions.reduce(
    (sum, s) => sum + Math.max(0, baseline - sessionCost(s)), 0
  )

  return (
    <div className="screen">
      <header className="page-head">
        <h1>Geschiedenis</h1>
      </header>

      <div className="filters">
        <button
          className={`filter-chip${filter === 'all' ? ' filter-chip-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Alles
        </button>
        <button
          className={`filter-chip${filter === 'week' ? ' filter-chip-active' : ''}`}
          onClick={() => setFilter('week')}
        >
          Deze week
        </button>
      </div>

      <div className="content">
        {monthSessions.length > 0 && (
          <div className="savings-card">
            <div className="savings-info">
              <span className="savings-label">Bespaard deze maand</span>
              <span className="savings-amount">{formatEuro(saved)}</span>
              <span className="savings-sub">
                t.o.v. vast dagtarief · {monthSessions.length} sessie{monthSessions.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="savings-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M17 8h4v4"/></svg>
            </div>
          </div>
        )}
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">P</div>
            <p>Nog geen parkeersessies</p>
            <span>Start je eerste sessie via Home.</span>
          </div>
        ) : (
          <div className="session-list">
            {visible.map(s => {
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
                    <PlateBadge plate={s.plate} />
                    <span className="session-item-date">{dateStr} · {timeStr}</span>
                  </div>
                  <div className="session-item-end">
                    <span className="session-item-cost">{formatEuro(sessionCost(s))}</span>
                    <span className="duration-pill">{formatDuration(s.duration)}</span>
                    <button
                      className="icon-btn"
                      onClick={() => generateReceipt(s)}
                      aria-label="Download PDF"
                    >
                      <IconDownload size={17} />
                    </button>
                  </div>
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

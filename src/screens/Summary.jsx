import { useNavigate, useLocation } from 'react-router-dom'
import { formatDuration, generateReceipt } from '../utils/pdf'
import { sessionCost, formatEuro } from '../utils/tariff'
import PlateBadge from '../components/PlateBadge'
import { IconDownload } from '../components/Icons'

// Shown right after a session is stopped so the cost/duration land on screen
// (not only in a notification, which many users have blocked). Reachable only
// via navigation state; a direct refresh falls back to Home.
export default function Summary() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const session = state?.session

  if (!session) { navigate('/', { replace: true }); return null }

  const startStr = new Date(session.startTime).toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit',
  })
  const endStr = new Date(session.endTime).toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="screen">
      <div className="content summary-dash">
        <div className="summary-check">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h1 className="summary-title">Sessie gestopt</h1>
        <p className="summary-sub">{session.zoneDesc || 'Parkeersessie'}</p>

        <div className="summary-amount">{formatEuro(sessionCost(session))}</div>

        <div className="summary-rows">
          <div className="summary-row"><span>Duur</span><span>{formatDuration(session.duration)}</span></div>
          <div className="summary-row"><span>Van — tot</span><span>{startStr} – {endStr}</span></div>
          <div className="summary-row"><span>Tarief</span><span>{formatEuro(session.rate)}/uur</span></div>
          <div className="summary-row"><span>Kenteken</span><PlateBadge plate={session.plate} /></div>
        </div>

        <button className="btn btn-ghost" onClick={() => generateReceipt(session)}>
          <IconDownload size={16} /> Download bewijs (PDF)
        </button>
        <button className="btn btn-yellow" onClick={() => navigate('/', { replace: true })}>
          Klaar
        </button>
      </div>
    </div>
  )
}

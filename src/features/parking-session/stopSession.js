import { getActiveSession, clearActiveSession, addSession } from '../../services/storage'
import { costOf, formatEuro } from '../../services/tariffs'
import { formatDuration } from '../../services/receipts'
import { notify } from '../../services/notifications'

// Ends the running session and files it in the history. Shared by the stop
// button and the "Sessie stoppen?" prompt. Returns the completed session (for
// the summary screen), or null when nothing was running.
export function stopSession() {
  const session = getActiveSession()
  if (!session) return null
  const startMs = new Date(session.startTime).getTime()
  const endMs = Date.now()
  const duration = Math.floor((endMs - startMs) / 1000)
  const completed = {
    ...session,
    id: startMs,
    endTime: new Date(endMs).toISOString(),
    duration,
    cost: costOf(session, endMs),
  }
  clearActiveSession()
  addSession(completed)
  notify('Parkeren gestopt', `Duur: ${formatDuration(duration)} · ${formatEuro(completed.cost)}`)
  return completed
}

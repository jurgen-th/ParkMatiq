import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Onboarding    from './screens/Onboarding'
import Home          from './screens/Home'
import ActiveSession from './screens/ActiveSession'
import History       from './screens/History'
import Settings      from './screens/Settings'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/"           element={<Home />} />
        <Route path="/session"    element={<ActiveSession />} />
        <Route path="/history"    element={<History />} />
        <Route path="/settings"   element={<Settings />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

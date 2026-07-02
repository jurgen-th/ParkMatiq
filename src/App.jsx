import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login         from './screens/Login'
import Register      from './screens/Register'
import Onboarding    from './screens/Onboarding'
import Home          from './screens/Home'
import ActiveSession from './screens/ActiveSession'
import Summary       from './screens/Summary'
import History       from './screens/History'
import Settings      from './screens/Settings'
import useDriveDetection from './hooks/useDriveDetection'

export default function App() {
  useDriveDetection()
  return (
    <HashRouter>
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/"           element={<Home />} />
        <Route path="/session"    element={<ActiveSession />} />
        <Route path="/summary"    element={<Summary />} />
        <Route path="/history"    element={<History />} />
        <Route path="/settings"   element={<Settings />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

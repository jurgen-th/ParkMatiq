import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login         from './screens/Login'
import Register      from './screens/Register'
import Home          from './screens/Home'
import ActiveSession from './screens/ActiveSession'
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
        <Route path="/onboarding" element={<Navigate to="/login" replace />} />
        <Route path="/"           element={<Home />} />
        <Route path="/session"    element={<ActiveSession />} />
        <Route path="/history"    element={<History />} />
        <Route path="/settings"   element={<Settings />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

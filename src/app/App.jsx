import Providers from './providers'
import AppRouter from './router'
import useDriveDetection from '../features/parking-session/hooks/useDriveDetection'

export default function App() {
  useDriveDetection()
  return (
    <Providers>
      <AppRouter />
    </Providers>
  )
}

import { useNavigate } from 'react-router-dom'

function IconHome({ active }) {
  const c = active ? '#FFD600' : 'rgba(255,255,255,0.55)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 11.5L12 3L21 11.5V21H15.5V15H8.5V21H3V11.5Z" fill={c}/>
    </svg>
  )
}

function IconHistory({ active }) {
  const c = active ? '#FFD600' : 'rgba(255,255,255,0.55)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2"/>
      <path d="M12 7V12.5L15.5 15" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconSettings({ active }) {
  const c = active ? '#FFD600' : 'rgba(255,255,255,0.55)'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="2"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

const tabs = [
  { id: 'home',     label: 'Home',         path: '/',         Icon: IconHome },
  { id: 'history',  label: 'Geschiedenis', path: '/history',  Icon: IconHistory },
  { id: 'settings', label: 'Instellingen', path: '/settings', Icon: IconSettings },
]

export default function BottomNav({ active }) {
  const navigate = useNavigate()
  return (
    <nav className="bottom-nav">
      {tabs.map(({ id, label, path, Icon }) => (
        <button
          key={id}
          className={`nav-tab${active === id ? ' nav-tab-active' : ''}`}
          onClick={() => navigate(path)}
        >
          <Icon active={active === id} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

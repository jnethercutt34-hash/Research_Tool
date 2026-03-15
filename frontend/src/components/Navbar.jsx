import { NavLink } from 'react-router-dom'
import {
  Home,
  Database,
  FlaskConical,
  Cpu,
  Zap,
  BrainCircuit,
  MessageSquare,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/rad-explorer', label: 'Rad Data', icon: Database },
  { to: '/testbed', label: 'Test Bed', icon: FlaskConical },
  { to: '/duts', label: 'DUTs', icon: Cpu },
  { to: '/sim-lab', label: 'Sim Lab', icon: Zap },
  { to: '/ml', label: 'ML', icon: BrainCircuit },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/wiki', label: 'Wiki', icon: BookOpen },
]

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-surface-dark/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center px-4">
        {/* Logo */}
        <NavLink to="/" className="mr-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-maroon">
            <Zap className="h-4 w-4 text-gold" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">
            TID Prognostics
          </span>
        </NavLink>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-maroon/20 text-maroon-light'
                    : 'text-gray-400 hover:bg-surface-light hover:text-white'
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}

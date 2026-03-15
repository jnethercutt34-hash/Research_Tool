import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

export default function ModuleCard({ step, title, description, icon: Icon, to, features = [], accent = false }) {
  return (
    <Link to={to} className="group block">
      <Card className="h-full transition-all hover:border-maroon/40 hover:shadow-maroon/5 hover:shadow-lg">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors',
              accent
                ? 'bg-gold/15 text-gold group-hover:bg-gold/25'
                : 'bg-maroon/15 text-maroon-light group-hover:bg-maroon/25'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-surface-light px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                STEP {step}
              </span>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-gray-400">{description}</p>
            {features.length > 0 && (
              <ul className="space-y-1">
                {features.map((f, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span className="text-maroon-light">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

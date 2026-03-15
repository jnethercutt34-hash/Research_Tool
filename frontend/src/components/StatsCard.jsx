import { Card } from '@/components/ui/Card'
import { cn, formatNumber } from '@/lib/utils'

export default function StatsCard({ icon: Icon, label, value, accent = false }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          accent ? 'bg-gold/20 text-gold' : 'bg-maroon/20 text-maroon-light'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{formatNumber(value)}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </Card>
  )
}

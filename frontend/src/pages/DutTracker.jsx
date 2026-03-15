import { Cpu } from 'lucide-react'

export default function DutTracker() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Cpu className="h-6 w-6 text-gold" />
        <h1 className="text-2xl font-bold text-white">DUT Tracker</h1>
      </div>
      <p className="text-sm text-gray-400">15-Point Fingerprint data collection for 100 DUT units.</p>
      <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-gray-500">
        Coming in Phase 2 — DUT registry, fingerprint grid, auto-statistics, CSV export.
      </div>
    </div>
  )
}

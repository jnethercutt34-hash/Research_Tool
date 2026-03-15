import { Zap } from 'lucide-react'

export default function SimLab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-maroon-light" />
        <h1 className="text-2xl font-bold text-white">Simulation Lab</h1>
      </div>
      <p className="text-sm text-gray-400">Import LTSpice outputs, visualize waveforms, detect Bias Cliff.</p>
      <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-gray-500">
        Coming in Phase 2 — File upload, waveform chart, annotation, DUT linking.
      </div>
    </div>
  )
}

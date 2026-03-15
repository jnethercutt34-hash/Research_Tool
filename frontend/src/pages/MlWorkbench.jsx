import { BrainCircuit } from 'lucide-react'

export default function MlWorkbench() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BrainCircuit className="h-6 w-6 text-gold" />
        <h1 className="text-2xl font-bold text-white">ML Workbench</h1>
      </div>
      <p className="text-sm text-gray-400">Prepare fingerprint data for ML, visualize results and correlations.</p>
      <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-gray-500">
        Coming in Phase 3 — Data preview, correlation heatmap, feature importance, model comparison.
      </div>
    </div>
  )
}

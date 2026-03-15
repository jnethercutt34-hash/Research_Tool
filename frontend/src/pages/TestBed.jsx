import { FlaskConical } from 'lucide-react'

export default function TestBed() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-maroon-light" />
        <h1 className="text-2xl font-bold text-white">Test Bed Manager</h1>
      </div>
      <p className="text-sm text-gray-400">Equipment inventory, test runs, and AI-generated test plans.</p>
      <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-gray-500">
        Coming in Phase 2 — Equipment CRUD, test run builder, AI parameter generator.
      </div>
    </div>
  )
}

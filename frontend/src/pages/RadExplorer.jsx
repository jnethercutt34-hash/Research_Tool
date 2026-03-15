import { Database } from 'lucide-react'

export default function RadExplorer() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-maroon-light" />
        <h1 className="text-2xl font-bold text-white">Radiation Data Explorer</h1>
      </div>
      <p className="text-sm text-gray-400">Browse and search 1,267 NASA radiation test report PDFs.</p>
      <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-gray-500">
        Coming in Phase 2 — Repo browser, RAG search, filtering, and cross-references.
      </div>
    </div>
  )
}

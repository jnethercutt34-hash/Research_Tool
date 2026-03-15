import { BookOpen } from 'lucide-react'

export default function Wiki() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-maroon-light" />
        <h1 className="text-2xl font-bold text-white">Research Wiki</h1>
      </div>
      <p className="text-sm text-gray-400">Interconnected knowledge base for papers and dissertation chapters.</p>
      <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-gray-500">
        Coming in Phase 3 — Page editor, [[wiki links]], full-text search, tag-based export.
      </div>
    </div>
  )
}

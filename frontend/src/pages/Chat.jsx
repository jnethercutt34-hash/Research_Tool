import { MessageSquare } from 'lucide-react'

export default function Chat() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-maroon-light" />
        <h1 className="text-2xl font-bold text-white">Research Chat</h1>
      </div>
      <p className="text-sm text-gray-400">Dual-provider AI chat — Claude and Gemini for LDO radiation physics.</p>
      <div className="rounded-xl border border-white/10 bg-surface p-8 text-center text-gray-500">
        Coming in Phase 3 — Provider selection, streaming responses, conversation management, save to wiki.
      </div>
    </div>
  )
}

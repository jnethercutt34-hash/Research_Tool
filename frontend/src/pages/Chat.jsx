import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Plus, Trash2, Send, Bot, User, Zap, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

// ── API helpers ──────────────────────────────────────────────────────
const chatApi = {
  listConversations: () => api('/api/chat/conversations'),
  createConversation: (title) => api('/api/chat/conversations', {
    method: 'POST', body: JSON.stringify({ title }),
    headers: { 'Content-Type': 'application/json' },
  }),
  deleteConversation: (id) => api(`/api/chat/conversations/${id}`, { method: 'DELETE' }),
  getMessages: (id) => api(`/api/chat/conversations/${id}/messages`),
}

// ── Provider badge ───────────────────────────────────────────────────
function ProviderBadge({ provider }) {
  const isGemini = provider === 'gemini'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
      isGemini ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'
    }`}>
      <Zap className="h-2.5 w-2.5" />
      {isGemini ? 'Gemini' : 'Claude'}
    </span>
  )
}

// ── Message bubble ───────────────────────────────────────────────────
function MessageBubble({ role, content, provider, isStreaming }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon/30">
            <Bot className="h-4 w-4 text-maroon-light" />
          </div>
        </div>
      )}
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-maroon text-white rounded-br-md'
          : 'bg-surface-light text-gray-200 rounded-bl-md'
      }`}>
        <div className="whitespace-pre-wrap">{content}{isStreaming && <span className="animate-pulse">▊</span>}</div>
        {provider && !isUser && (
          <div className="mt-1.5 flex justify-end"><ProviderBadge provider={provider} /></div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/20">
            <User className="h-4 w-4 text-gold" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────
export default function Chat() {
  const qc = useQueryClient()
  const [activeConv, setActiveConv] = useState(null)
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState('gemini')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [localMessages, setLocalMessages] = useState([])
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Queries
  const { data: conversations = [] } = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: chatApi.listConversations,
  })

  const { data: serverMessages = [] } = useQuery({
    queryKey: ['chat', 'conversations', activeConv, 'messages'],
    queryFn: () => chatApi.getMessages(activeConv),
    enabled: !!activeConv,
  })

  // Sync server messages to local state
  useEffect(() => {
    if (serverMessages.length > 0 && !streaming) {
      setLocalMessages(serverMessages)
    }
  }, [serverMessages, streaming])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages, streamText])

  // Mutations
  const createConvMut = useMutation({
    mutationFn: (title) => chatApi.createConversation(title),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      setActiveConv(res.id)
      setLocalMessages([])
    },
  })

  const deleteConvMut = useMutation({
    mutationFn: (id) => chatApi.deleteConversation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      if (activeConv) { setActiveConv(null); setLocalMessages([]) }
    },
  })

  // SSE send
  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return
    if (!activeConv) return

    const userMsg = input.trim()
    setInput('')
    setStreaming(true)
    setStreamText('')

    // Optimistic update
    const newUserMsg = { role: 'user', content: userMsg, provider }
    setLocalMessages(prev => [...prev, newUserMsg])

    try {
      const token = localStorage.getItem('auth_token')
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch(`/api/chat/conversations/${activeConv}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: userMsg, provider }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'chunk') {
              assistantText += data.content
              setStreamText(assistantText)
            } else if (data.type === 'error') {
              assistantText = `⚠️ Error: ${data.content}`
              setStreamText(assistantText)
            }
          } catch {}
        }
      }

      // Add final assistant message to local state
      if (assistantText) {
        setLocalMessages(prev => [...prev, { role: 'assistant', content: assistantText, provider }])
      }
    } catch (e) {
      setLocalMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Connection error: ${e.message}`, provider }])
    } finally {
      setStreaming(false)
      setStreamText('')
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      inputRef.current?.focus()
    }
  }, [input, activeConv, provider, streaming, qc])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const newConversation = () => {
    createConvMut.mutate('New Conversation')
  }

  const allMessages = [...localMessages]

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 space-y-2 overflow-y-auto">
        <Button onClick={newConversation} className="w-full gap-1.5" disabled={createConvMut.isPending}>
          <Plus className="h-4 w-4" />New Chat
        </Button>
        <div className="space-y-1 mt-3">
          {conversations.map(c => (
            <div key={c.id}
              className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition ${
                activeConv === c.id ? 'bg-maroon/20 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
              onClick={() => { setActiveConv(c.id); setLocalMessages([]) }}
            >
              <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="flex-1 truncate">{c.title}</span>
              <span className="text-[10px] text-gray-600">{c.message_count || 0}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConvMut.mutate(c.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-600 text-center">No conversations yet</p>
          )}
        </div>
      </div>

      {/* ── Chat area ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col rounded-xl border border-white/10 bg-surface overflow-hidden">
        {!activeConv ? (
          /* Empty state */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-maroon/20">
                <Bot className="h-8 w-8 text-maroon-light" />
              </div>
              <h2 className="text-lg font-semibold text-white">TID Research Assistant</h2>
              <p className="text-sm text-gray-500 max-w-sm">
                Ask about radiation effects, TID testing, LDO screening data, or bias cliff analysis.
              </p>
              <Button onClick={newConversation} variant="gold" className="gap-1.5">
                <Plus className="h-4 w-4" />Start a Conversation
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {allMessages.length === 0 && !streaming && (
                <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                  Send a message to get started
                </div>
              )}
              {allMessages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content} provider={m.provider} />
              ))}
              {streaming && streamText && (
                <MessageBubble role="assistant" content={streamText} provider={provider} isStreaming />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2">
                {/* Provider selector */}
                <div className="relative">
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="appearance-none rounded-lg border border-white/10 bg-surface-light px-3 py-2 pr-7 text-xs text-gray-300 focus:border-maroon focus:outline-none"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="claude">Claude</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>

                {/* Text input */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Ask about TID testing, radiation effects…"
                  disabled={streaming}
                  className="flex-1 resize-none rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-maroon focus:outline-none disabled:opacity-50"
                  style={{ maxHeight: '120px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                />

                <Button onClick={sendMessage} disabled={!input.trim() || streaming}
                  className="h-9 w-9 p-0 flex-shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

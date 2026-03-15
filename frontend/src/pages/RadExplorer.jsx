import { useState } from 'react'
import { Database, Search, FolderTree, ChevronRight, ChevronDown, FileText, Loader2 } from 'lucide-react'
import { useRepoTree } from '@/lib/queries'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

function TreeNode({ label, children, level = 0, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const isLeaf = !children || (Array.isArray(children) && typeof children[0] === 'string')

  if (isLeaf && Array.isArray(children)) {
    return (
      <div style={{ paddingLeft: `${(level) * 16}px` }}>
        {children.map((fname, i) => (
          <div key={i} className="flex items-center gap-1.5 py-0.5 text-xs text-gray-400 hover:text-white cursor-pointer">
            <FileText className="h-3 w-3 shrink-0 text-gray-600" />
            <span className="truncate">{fname}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-1 text-xs font-medium text-gray-300 hover:text-white"
        style={{ paddingLeft: `${level * 16}px` }}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <FolderTree className="h-3 w-3 text-gold" />
        <span>{label}</span>
        {children && typeof children === 'object' && !Array.isArray(children) && (
          <span className="ml-1 text-[10px] text-gray-600">({Object.keys(children).length})</span>
        )}
      </button>
      {open && children && typeof children === 'object' && !Array.isArray(children) && (
        <div>
          {Object.entries(children).map(([key, val]) => (
            <TreeNode key={key} label={key} children={val} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function RagSearch() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)

  const searchMutation = useMutation({
    mutationFn: (q) => api.post('/api/query', { query: q }),
    onSuccess: (data) => setResult(data),
  })

  function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    searchMutation.mutate(query)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search radiation test data... e.g. 'What TID levels do NMOS regulators fail at?'"
            className="w-full rounded-lg border border-white/10 bg-surface-light py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-maroon/50 focus:outline-none"
          />
        </div>
        <Button type="submit" disabled={searchMutation.isPending}>
          {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      {result && (
        <div className="space-y-3">
          {/* AI Answer */}
          <Card>
            <CardContent>
              <h3 className="mb-2 text-sm font-semibold text-maroon-light">AI Answer</h3>
              <div className="prose prose-invert prose-sm max-w-none text-sm text-gray-300 whitespace-pre-wrap">
                {result.answer}
              </div>
            </CardContent>
          </Card>

          {/* Sources */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400">Sources ({result.sources?.length ?? 0})</h3>
            {result.sources?.map((s, i) => (
              <Card key={i} className="p-3">
                <div className="mb-1 flex items-center gap-2">
                  <FileText className="h-3 w-3 text-gray-500" />
                  <span className="text-xs font-medium text-white">{s.filename}</span>
                  <span className="text-[10px] text-gray-500">p.{s.page_number}</span>
                  <span className="ml-auto text-[10px] text-gray-600">score: {s.score}</span>
                </div>
                <p className="text-xs leading-relaxed text-gray-400 line-clamp-3">{s.text}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RepoBrowser({ tree }) {
  if (!tree || Object.keys(tree).length === 0) {
    return <div className="p-4 text-sm text-gray-500">No PDFs indexed yet. Click "Build Index" to start.</div>
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto p-2">
      {Object.entries(tree).map(([cat, subtree]) => (
        <TreeNode key={cat} label={cat} children={subtree} level={0} defaultOpen />
      ))}
    </div>
  )
}

export default function RadExplorer() {
  const { data: repo, isLoading } = useRepoTree()
  const qc = useQueryClient()
  const [tab, setTab] = useState('search')

  const buildStatus = useQuery({
    queryKey: ['repo', 'build', 'status'],
    queryFn: () => api.get('/api/repo/build/status'),
    refetchInterval: (query) => query.state.data?.running ? 2000 : false,
  })

  const buildMutation = useMutation({
    mutationFn: (force) => api.post(`/api/repo/build?force=${force}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repo', 'build', 'status'] }),
  })

  const isBuilding = buildStatus.data?.running
  const buildProgress = buildStatus.data
    ? `${buildStatus.data.done}/${buildStatus.data.total} (${buildStatus.data.errors} errors)`
    : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-maroon-light" />
          <h1 className="text-2xl font-bold text-white">Radiation Data Explorer</h1>
          <span className="rounded bg-surface-light px-2 py-0.5 text-xs text-gray-400">
            {repo?.count ?? 0} PDFs indexed
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isBuilding && (
            <span className="flex items-center gap-1.5 text-xs text-gold">
              <Loader2 className="h-3 w-3 animate-spin" />
              Indexing: {buildProgress}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => buildMutation.mutate(false)} disabled={isBuilding}>
            Build Index
          </Button>
          <Button size="sm" variant="ghost" onClick={() => buildMutation.mutate(true)} disabled={isBuilding}>
            Rebuild All
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-px">
        {[
          { id: 'search', label: 'RAG Search' },
          { id: 'browse', label: 'Browse Repository' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-b-2 border-maroon text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'search' ? (
        <RagSearch />
      ) : (
        <Card className="p-0">
          <RepoBrowser tree={repo?.tree} />
        </Card>
      )}
    </div>
  )
}

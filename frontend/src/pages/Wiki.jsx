import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Search, Tag, ArrowLeft, Link2, Trash2, Download, Edit3, Save, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

// ── API helpers ──────────────────────────────────────────────────────
const wikiApi = {
  listPages: (tag) => api(tag ? `/api/wiki/pages?tag=${encodeURIComponent(tag)}` : '/api/wiki/pages'),
  getPage: (slug) => api(`/api/wiki/pages/${slug}`),
  createPage: (data) => api('/api/wiki/pages', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
  updatePage: (slug, data) => api(`/api/wiki/pages/${slug}`, { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
  deletePage: (slug) => api(`/api/wiki/pages/${slug}`, { method: 'DELETE' }),
  listTags: () => api('/api/wiki/tags'),
  search: (q) => api(`/api/wiki/search?q=${encodeURIComponent(q)}`),
}

// ── Wiki link renderer ───────────────────────────────────────────────
function renderContent(content, onNavigate) {
  if (!content) return null
  const parts = content.split(/(\[\[[^\]]+\]\])/)
  return parts.map((part, i) => {
    const m = part.match(/^\[\[([^\]]+)\]\]$/)
    if (m) {
      const title = m[1].trim()
      const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/^-|-$/g, '')
      return (
        <button key={i} onClick={() => onNavigate(slug)}
          className="text-gold hover:text-gold/80 underline underline-offset-2 font-medium">
          {title}
        </button>
      )
    }
    // Render paragraphs for newlines
    return part.split('\n').map((line, j) => (
      <span key={`${i}-${j}`}>{line}{j < part.split('\n').length - 1 && <br />}</span>
    ))
  })
}

// ── Tag pill ─────────────────────────────────────────────────────────
function TagPill({ tag, onClick, active }) {
  return (
    <button
      onClick={() => onClick(tag)}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition
        ${active ? 'bg-gold text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
    >
      <Tag className="h-3 w-3" />{tag}
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────
export default function Wiki() {
  const qc = useQueryClient()
  const [view, setView] = useState('list')        // list | detail | edit | new
  const [activeSlug, setActiveSlug] = useState(null)
  const [filterTag, setFilterTag] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formTags, setFormTags] = useState('')

  // Queries
  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ['wiki-pages', filterTag],
    queryFn: () => wikiApi.listPages(filterTag),
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['wiki-tags'],
    queryFn: wikiApi.listTags,
  })

  const { data: activePage, isLoading: pageLoading } = useQuery({
    queryKey: ['wiki-page', activeSlug],
    queryFn: () => wikiApi.getPage(activeSlug),
    enabled: !!activeSlug && (view === 'detail' || view === 'edit'),
  })

  // Mutations
  const createMut = useMutation({
    mutationFn: (data) => wikiApi.createPage(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['wiki-pages'] })
      qc.invalidateQueries({ queryKey: ['wiki-tags'] })
      setActiveSlug(res.slug)
      setView('detail')
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ slug, data }) => wikiApi.updatePage(slug, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wiki-pages'] })
      qc.invalidateQueries({ queryKey: ['wiki-page', activeSlug] })
      qc.invalidateQueries({ queryKey: ['wiki-tags'] })
      setView('detail')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (slug) => wikiApi.deletePage(slug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wiki-pages'] })
      qc.invalidateQueries({ queryKey: ['wiki-tags'] })
      setActiveSlug(null)
      setView('list')
    },
  })

  // Search
  const doSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const res = await wikiApi.search(searchQuery)
    setSearchResults(res)
  }, [searchQuery])

  useEffect(() => {
    const t = setTimeout(doSearch, 300)
    return () => clearTimeout(t)
  }, [searchQuery, doSearch])

  // Navigation
  const navigate = (slug) => { setActiveSlug(slug); setView('detail') }
  const goList = () => { setActiveSlug(null); setView('list'); setSearchResults(null); setSearchQuery('') }
  const startNew = () => { setFormTitle(''); setFormContent(''); setFormTags(''); setView('new') }
  const startEdit = () => {
    if (activePage) {
      setFormTitle(activePage.title)
      setFormContent(activePage.content)
      setFormTags((activePage.tags || []).join(', '))
    }
    setView('edit')
  }

  const handleSave = () => {
    const tagList = formTags.split(',').map(t => t.trim()).filter(Boolean)
    if (view === 'new') {
      createMut.mutate({ title: formTitle, content: formContent, tags: tagList })
    } else {
      updateMut.mutate({ slug: activeSlug, data: { title: formTitle, content: formContent, tags: tagList } })
    }
  }

  // ── LIST VIEW ────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-maroon-light" />
            <h1 className="text-2xl font-bold text-white">Research Wiki</h1>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-400">{pages.length} pages</span>
          </div>
          <Button onClick={startNew} className="gap-1.5"><Plus className="h-4 w-4" />New Page</Button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search wiki pages…"
            className="w-full rounded-lg border border-white/10 bg-surface-light pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-maroon focus:outline-none"
          />
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <TagPill tag="all" onClick={() => setFilterTag(null)} active={!filterTag} />
            {tags.map(t => (
              <TagPill key={t.tag} tag={t.tag} onClick={(tag) => setFilterTag(tag)} active={filterTag === t.tag} />
            ))}
          </div>
        )}

        {/* Search results overlay */}
        {searchResults !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Search Results ({searchResults.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {searchResults.length === 0 && <p className="text-sm text-gray-500">No results found.</p>}
              {searchResults.map(r => (
                <button key={r.slug} onClick={() => navigate(r.slug)}
                  className="block w-full rounded-lg border border-white/5 bg-surface-dark p-3 text-left hover:border-maroon/50 transition">
                  <p className="font-medium text-white">{r.title}</p>
                  {r.snippet && <p className="mt-1 text-xs text-gray-500 line-clamp-2">…{r.snippet}…</p>}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Page list */}
        {pagesLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
          </div>
        ) : pages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-gray-600 mb-3" />
              <p className="text-gray-400">No wiki pages yet.</p>
              <Button onClick={startNew} variant="ghost" className="mt-3 gap-1.5">
                <Plus className="h-4 w-4" />Create your first page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map(p => (
              <button key={p.slug} onClick={() => navigate(p.slug)}
                className="group rounded-xl border border-white/10 bg-surface p-4 text-left hover:border-maroon/50 transition">
                <h3 className="font-semibold text-white group-hover:text-gold transition">{p.title}</h3>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{p.content?.slice(0, 120)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(p.tags || []).map(t => (
                    <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">{t}</span>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-gray-600">
                  {new Date(p.updated_at || p.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────────
  if (view === 'detail') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goList} className="gap-1">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={startEdit} className="gap-1">
            <Edit3 className="h-4 w-4" />Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => {
            if (confirm('Delete this page?')) deleteMut.mutate(activeSlug)
          }} className="gap-1 text-red-400 hover:text-red-300">
            <Trash2 className="h-4 w-4" />Delete
          </Button>
          <a href={`/api/wiki/export?tag=${(activePage?.tags || [])[0] || ''}`}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
            download>
            <Download className="h-3.5 w-3.5" />Export
          </a>
        </div>

        {pageLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
          </div>
        ) : activePage ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{activePage.title}</CardTitle>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(activePage.tags || []).map(t => (
                  <TagPill key={t} tag={t} onClick={(tag) => { setFilterTag(tag); goList() }} />
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {renderContent(activePage.content, navigate)}
              </div>

              {/* Backlinks */}
              {activePage.backlinks?.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    <Link2 className="h-3.5 w-3.5" />Backlinks
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activePage.backlinks.map(b => (
                      <button key={b.slug} onClick={() => navigate(b.slug)}
                        className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gold hover:bg-white/10 transition">
                        {b.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-4 text-[10px] text-gray-600">
                Updated {new Date(activePage.updated_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="py-8 text-center text-gray-500">Page not found.</CardContent></Card>
        )}
      </div>
    )
  }

  // ── EDIT / NEW VIEW ──────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => activeSlug ? setView('detail') : goList()} className="gap-1">
          <X className="h-4 w-4" />Cancel
        </Button>
        <h1 className="text-lg font-bold text-white">{view === 'new' ? 'New Page' : 'Edit Page'}</h1>
        <div className="flex-1" />
        <Button onClick={handleSave} disabled={!formTitle.trim() || createMut.isPending || updateMut.isPending}
          className="gap-1.5">
          <Save className="h-4 w-4" />{createMut.isPending || updateMut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Page title"
              className="w-full rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-white placeholder-gray-500 focus:border-maroon focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Content <span className="text-gray-600">— Use [[Page Name]] for wiki links</span>
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={16}
              placeholder="Write your content here…&#10;&#10;Link to other pages with [[Page Name]] syntax."
              className="w-full rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-maroon focus:outline-none font-mono leading-relaxed resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Tags (comma-separated)</label>
            <input
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="tid, ldo, dissertation-ch3"
              className="w-full rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-maroon focus:outline-none"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

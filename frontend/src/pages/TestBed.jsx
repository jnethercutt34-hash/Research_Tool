import { useState } from 'react'
import { FlaskConical, Plus, Trash2, Wand2, Download, ChevronRight, Package } from 'lucide-react'
import { useComponents, useTestRuns, useTestRun } from '@/lib/queries'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { keys } from '@/lib/queries'
import { cn } from '@/lib/utils'

function ComponentForm({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ part_name: '', manufacturer: '', part_number: '', serial_number: '', calibration_date: '', specs: '' })
  const mutation = useMutation({
    mutationFn: (data) => api.post('/api/components', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.components }); onClose() },
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Card className="mb-4 border-maroon/30">
      <CardContent>
        <h3 className="mb-3 text-sm font-semibold text-white">Add Equipment</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {['part_name', 'manufacturer', 'part_number', 'serial_number', 'calibration_date', 'specs'].map(k => (
            <input key={k} placeholder={k.replace(/_/g, ' ')} value={form[k]} onChange={e => set(k, e.target.value)}
              className="rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-xs text-white placeholder-gray-500 capitalize" />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => mutation.mutate(form)} disabled={!form.part_name || mutation.isPending}>Add</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TestRunDetail({ runId }) {
  const qc = useQueryClient()
  const { data: run, isLoading } = useTestRun(runId)
  const { data: allComponents } = useComponents()

  const addCompMutation = useMutation({
    mutationFn: (cid) => api.post(`/api/test-runs/${runId}/components`, { component_id: cid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.testRun(runId) }),
  })
  const removeCompMutation = useMutation({
    mutationFn: (cid) => api.del(`/api/test-runs/${runId}/components/${cid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.testRun(runId) }),
  })
  const generateMutation = useMutation({
    mutationFn: () => api.post(`/api/test-runs/${runId}/generate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.testRun(runId) }),
  })

  if (isLoading || !run) return <div className="p-4 text-gray-500">Loading...</div>

  const attachedIds = new Set(run.components?.map(c => c.id) || [])
  const available = allComponents?.filter(c => !attachedIds.has(c.id)) || []

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{run.name}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/test-runs/${runId}/export/md`, '_blank')}>
            <Download className="h-3.5 w-3.5" /> MD
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/test-runs/${runId}/export/pdf`, '_blank')}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>
      {run.notes && <p className="text-xs text-gray-400">{run.notes}</p>}

      {/* Attached components */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-gray-400">Components Under Test</h4>
        {run.components?.length === 0 ? (
          <p className="text-xs text-gray-500">No components attached. Add equipment from the list below.</p>
        ) : (
          <div className="space-y-1">
            {run.components?.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-surface-light px-3 py-2">
                <div>
                  <span className="text-xs font-medium text-white">{c.part_name}</span>
                  <span className="ml-2 text-[10px] text-gray-500">{c.manufacturer} · {c.part_number}</span>
                </div>
                <button onClick={() => removeCompMutation.mutate(c.id)} className="text-gray-600 hover:text-red-400">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {available.length > 0 && (
          <div className="mt-2">
            <select
              onChange={e => { if (e.target.value) { addCompMutation.mutate(parseInt(e.target.value)); e.target.value = '' } }}
              className="rounded-lg border border-white/10 bg-surface-light px-3 py-1.5 text-xs text-gray-400"
            >
              <option value="">+ Add component...</option>
              {available.map(c => <option key={c.id} value={c.id}>{c.part_name} ({c.part_number})</option>)}
            </select>
          </div>
        )}
      </div>

      {/* AI Plan */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h4 className="text-xs font-semibold text-gray-400">AI-Generated Test Plan</h4>
          <Button size="sm" variant="gold" onClick={() => generateMutation.mutate()}
            disabled={!run.components?.length || generateMutation.isPending}>
            <Wand2 className="h-3.5 w-3.5" />
            {generateMutation.isPending ? 'Generating...' : 'Generate'}
          </Button>
        </div>
        {run.ai_plan ? (
          <div className="rounded-lg bg-surface-dark p-4 text-xs leading-relaxed text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {run.ai_plan}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No plan generated yet. Add components and click Generate.</p>
        )}
      </div>
    </div>
  )
}

export default function TestBed() {
  const { data: components } = useComponents()
  const { data: testRuns } = useTestRuns()
  const qc = useQueryClient()
  const [showAddComp, setShowAddComp] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [tab, setTab] = useState('runs') // 'inventory' | 'runs'

  const deleteCompMutation = useMutation({
    mutationFn: (id) => api.del(`/api/components/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.components }),
  })
  const createRunMutation = useMutation({
    mutationFn: () => {
      const name = prompt('Test run name:')
      if (!name) throw new Error('cancelled')
      return api.post('/api/test-runs', { name })
    },
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: keys.testRuns }); setSelectedRunId(data.id) },
  })
  const deleteRunMutation = useMutation({
    mutationFn: (id) => api.del(`/api/test-runs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.testRuns }); setSelectedRunId(null) },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-maroon-light" />
          <h1 className="text-2xl font-bold text-white">Test Bed Manager</h1>
        </div>
        <div className="flex gap-2">
          {tab === 'inventory' && (
            <Button size="sm" onClick={() => setShowAddComp(true)}><Plus className="h-3.5 w-3.5" /> Add Equipment</Button>
          )}
          {tab === 'runs' && (
            <Button size="sm" onClick={() => createRunMutation.mutate()}><Plus className="h-3.5 w-3.5" /> New Test Run</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-px">
        {[{ id: 'runs', label: 'Test Runs' }, { id: 'inventory', label: 'Equipment Inventory' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 text-sm font-medium', tab === t.id ? 'border-b-2 border-maroon text-white' : 'text-gray-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <>
          {showAddComp && <ComponentForm onClose={() => setShowAddComp(false)} />}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {components?.map(c => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-maroon-light" />
                      <span className="text-sm font-semibold text-white">{c.part_name}</span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-gray-400">
                      <div>MFR: {c.manufacturer || '—'} · P/N: {c.part_number || '—'}</div>
                      <div>S/N: {c.serial_number || '—'} · Cal: {c.calibration_date || '—'}</div>
                      {c.specs && <div className="text-gray-500">{c.specs}</div>}
                    </div>
                  </div>
                  <button onClick={() => { if(confirm('Delete?')) deleteCompMutation.mutate(c.id) }}
                    className="text-gray-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </Card>
            ))}
            {!components?.length && <p className="col-span-full text-sm text-gray-500">No equipment registered.</p>}
          </div>
        </>
      )}

      {tab === 'runs' && (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* Run list */}
          <Card className="max-h-[calc(100vh-220px)] overflow-y-auto p-0">
            <div className="divide-y divide-white/5">
              {testRuns?.map(r => (
                <div key={r.id} onClick={() => setSelectedRunId(r.id)}
                  className={cn('flex cursor-pointer items-center justify-between px-3 py-2.5',
                    selectedRunId === r.id ? 'bg-maroon/15' : 'hover:bg-surface-light')}>
                  <div>
                    <div className="text-xs font-semibold text-white">{r.name}</div>
                    <div className="text-[10px] text-gray-500">{r.component_count} components · {r.created_at?.slice(0, 10)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); if(confirm('Delete run?')) deleteRunMutation.mutate(r.id) }}
                      className="text-gray-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                </div>
              ))}
              {!testRuns?.length && <p className="p-4 text-xs text-gray-500">No test runs yet.</p>}
            </div>
          </Card>

          {/* Run detail */}
          <Card className="max-h-[calc(100vh-220px)] overflow-y-auto p-0">
            {selectedRunId ? <TestRunDetail runId={selectedRunId} /> : (
              <div className="flex h-48 items-center justify-center text-sm text-gray-500">Select a test run</div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

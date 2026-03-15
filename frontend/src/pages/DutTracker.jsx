import { useState } from 'react'
import { Cpu, Plus, Trash2, Download, ChevronRight } from 'lucide-react'
import { useDuts, useDutRuns } from '@/lib/queries'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { keys } from '@/lib/queries'
import { cn } from '@/lib/utils'

const GROUPS = {
  'TPS7A53-Q1': { label: 'A — Primary', color: 'text-maroon-light' },
  'LT3071':     { label: 'B — Rival',   color: 'text-blue-400' },
  'TPS7A54-Q1': { label: 'C — Binning', color: 'text-green-400' },
  'TPS7B7701-Q1': { label: 'D — Control', color: 'text-yellow-400' },
}

const FP_COLS = [
  { key: 'bias_cliff_v',   label: 'Bias Cliff (V)',    cat: 'A', min: 0, max: 6 },
  { key: 'rise_time_ms',   label: 'Rise Time (ms)',    cat: 'A', min: 0, max: 100 },
  { key: 'gnd_curr_slope', label: 'Gnd I Slope',       cat: 'A', min: -1, max: 1 },
  { key: 'overshoot_v',    label: 'Overshoot (V)',     cat: 'A', min: 0, max: 10 },
  { key: 'thermal_drift',  label: 'Thermal Drift',     cat: 'A', min: -0.1, max: 0.1 },
  { key: 'vout_accuracy',  label: 'Vout Acc (V)',      cat: 'B', min: 0, max: 6 },
  { key: 'dropout_v',      label: 'Dropout (V)',       cat: 'B', min: 0, max: 2 },
  { key: 'line_reg',       label: 'Line Reg',          cat: 'B', min: -0.01, max: 0.01 },
  { key: 'load_reg',       label: 'Load Reg',          cat: 'B', min: -0.1, max: 0.1 },
  { key: 'gnd_curr_nom',   label: 'Gnd I Nom (mA)',   cat: 'B', min: 0, max: 100 },
  { key: 'shutdown_leak',  label: 'SD Leak (µA)',      cat: 'B', min: 0, max: 1000 },
  { key: 'en_thresh_v',    label: 'EN Thresh (V)',     cat: 'B', min: 0, max: 6 },
  { key: 'en_hyst_v',      label: 'EN Hyst (V)',       cat: 'B', min: 0, max: 2 },
  { key: 'psrr_db',        label: 'PSRR (dB)',         cat: 'B', min: 0, max: 100 },
  { key: 'noise_vrms',     label: 'Noise (µVrms)',     cat: 'B', min: 0, max: 10000 },
]

function AddDutForm({ onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ part_number: 'TPS7A53-Q1', serial_number: '', silicon_rev: '', board_id: '', notes: '' })
  const mutation = useMutation({
    mutationFn: (data) => api.post('/api/duts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.duts }); onClose() },
  })
  return (
    <Card className="mb-4 border-maroon/30">
      <CardContent>
        <h3 className="mb-3 text-sm font-semibold text-white">Add New DUT</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <select value={form.part_number} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))}
            className="rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-xs text-white">
            {Object.keys(GROUPS).map(pn => <option key={pn} value={pn}>{pn}</option>)}
          </select>
          <input placeholder="Serial #" value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
            className="rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-xs text-white placeholder-gray-500" />
          <input placeholder="Silicon Rev" value={form.silicon_rev} onChange={e => setForm(f => ({ ...f, silicon_rev: e.target.value }))}
            className="rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-xs text-white placeholder-gray-500" />
          <input placeholder="Board ID" value={form.board_id} onChange={e => setForm(f => ({ ...f, board_id: e.target.value }))}
            className="rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-xs text-white placeholder-gray-500" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
              {mutation.isPending ? '...' : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
        {mutation.isError && <p className="mt-2 text-xs text-red-400">{mutation.error.message}</p>}
      </CardContent>
    </Card>
  )
}

function FingerprintGrid({ dutId }) {
  const qc = useQueryClient()
  const { data, isLoading } = useDutRuns(dutId)
  const [editing, setEditing] = useState({}) // { `${run}-${col}`: value }

  const saveMutation = useMutation({
    mutationFn: ({ runNumber, payload }) => api.post(`/api/duts/${dutId}/runs/${runNumber}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.dutRuns(dutId) }),
  })

  if (isLoading) return <div className="p-4 text-sm text-gray-500">Loading fingerprint data...</div>
  if (!data) return null

  const { runs, summary } = data
  const runMap = {}
  runs.forEach(r => { runMap[r.run_number] = r })

  function getValue(runNum, col) {
    const editKey = `${runNum}-${col}`
    if (editKey in editing) return editing[editKey]
    const run = runMap[runNum]
    if (!run || run[col] == null) return ''
    return run[col]
  }

  function handleChange(runNum, col, val) {
    setEditing(e => ({ ...e, [`${runNum}-${col}`]: val }))
  }

  function handleBlur(runNum, col) {
    const editKey = `${runNum}-${col}`
    const val = editing[editKey]
    if (val === undefined) return

    const parsed = val === '' ? null : parseFloat(val)
    if (val !== '' && isNaN(parsed)) {
      setEditing(e => { const n = { ...e }; delete n[editKey]; return n })
      return
    }

    // Physics bounds validation
    const spec = FP_COLS.find(c => c.key === col)
    if (spec && parsed !== null && (parsed < spec.min || parsed > spec.max)) {
      if (!confirm(`${spec.label}: ${parsed} is outside expected range [${spec.min}, ${spec.max}]. Save anyway?`)) {
        setEditing(e => { const n = { ...e }; delete n[editKey]; return n })
        return
      }
    }

    // Build full payload for this run
    const payload = {}
    FP_COLS.forEach(c => {
      const ek = `${runNum}-${c.key}`
      if (ek === editKey) {
        payload[c.key] = parsed
      } else if (ek in editing) {
        const v = editing[ek]
        payload[c.key] = v === '' ? null : parseFloat(v)
      } else {
        const run = runMap[runNum]
        payload[c.key] = run ? run[c.key] : null
      }
    })

    saveMutation.mutate({ runNumber: runNum, payload })
    setEditing(e => { const n = { ...e }; delete n[editKey]; return n })
  }

  function fmt(v) {
    if (v == null) return '—'
    return typeof v === 'number' ? v.toPrecision(4) : v
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-2 py-1.5 text-left text-gray-500">Run</th>
            {FP_COLS.map(c => (
              <th key={c.key} className={cn('px-2 py-1.5 text-center whitespace-nowrap', c.cat === 'A' ? 'text-gold' : 'text-gray-400')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map(runNum => (
            <tr key={runNum} className={cn('border-b border-white/5', runNum === 1 && 'opacity-50')}>
              <td className="px-2 py-1 text-gray-500">
                {runNum === 1 ? '1 (warm-up)' : `Run ${runNum}`}
              </td>
              {FP_COLS.map(c => (
                <td key={c.key} className="px-1 py-0.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={getValue(runNum, c.key)}
                    onChange={e => handleChange(runNum, c.key, e.target.value)}
                    onBlur={() => handleBlur(runNum, c.key)}
                    className="w-full rounded border border-white/5 bg-transparent px-1.5 py-1 text-center text-xs text-white focus:border-maroon/50 focus:outline-none"
                    placeholder="—"
                  />
                </td>
              ))}
            </tr>
          ))}
          {/* Mean row */}
          <tr className="border-t border-white/20 bg-surface-light/50 font-medium">
            <td className="px-2 py-1.5 text-green-400">Mean</td>
            {FP_COLS.map(c => (
              <td key={c.key} className="px-2 py-1.5 text-center text-green-400">
                {fmt(summary?.mean?.[c.key])}
              </td>
            ))}
          </tr>
          {/* Sigma row */}
          <tr className="bg-surface-light/50 font-medium">
            <td className="px-2 py-1.5 text-blue-400">σ</td>
            {FP_COLS.map(c => (
              <td key={c.key} className="px-2 py-1.5 text-center text-blue-400">
                {fmt(summary?.sigma?.[c.key])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {saveMutation.isError && <p className="mt-1 text-xs text-red-400">Save error: {saveMutation.error.message}</p>}
    </div>
  )
}

export default function DutTracker() {
  const { data: duts, isLoading } = useDuts()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/api/duts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.duts }); if (selectedId) setSelectedId(null) },
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="h-6 w-6 text-gold" />
          <h1 className="text-2xl font-bold text-white">DUT Tracker</h1>
          <span className="rounded bg-surface-light px-2 py-0.5 text-xs text-gray-400">
            {duts?.length ?? 0} units
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.open('/api/duts/export/csv', '_blank')}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Add DUT
          </Button>
        </div>
      </div>

      {showAdd && <AddDutForm onClose={() => setShowAdd(false)} />}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* DUT List */}
        <Card className="max-h-[calc(100vh-180px)] overflow-y-auto p-0">
          <div className="p-3 text-xs font-semibold text-gray-400 border-b border-white/10">DUT Registry</div>
          {isLoading ? (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          ) : !duts?.length ? (
            <div className="p-4 text-sm text-gray-500">No DUTs registered yet.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {duts.map(d => {
                const group = GROUPS[d.part_number] || { label: '?', color: 'text-gray-400' }
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors',
                      selectedId === d.id ? 'bg-maroon/15' : 'hover:bg-surface-light'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{d.serial_number || `DUT #${d.id}`}</span>
                        <span className={cn('text-[10px] font-medium', group.color)}>{group.label}</span>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {d.part_number} · Board {d.board_id || '—'} · {d.run_count}/5 runs
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Health indicator */}
                      <div className={cn(
                        'h-2 w-2 rounded-full',
                        d.run_count >= 5 ? 'bg-green-400' : d.run_count > 0 ? 'bg-yellow-400' : 'bg-gray-600'
                      )} />
                      <button
                        onClick={(e) => { e.stopPropagation(); if(confirm('Delete this DUT?')) deleteMutation.mutate(d.id) }}
                        className="rounded p-1 text-gray-600 hover:bg-red-900/30 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Fingerprint Grid */}
        <Card className="max-h-[calc(100vh-180px)] overflow-auto p-0">
          <div className="border-b border-white/10 px-3 py-3 text-xs font-semibold text-gray-400">
            15-Point Fingerprint · Rule of 5 <span className="text-gray-600">(Run 1 discarded, Runs 2-5 averaged)</span>
          </div>
          {selectedId ? (
            <FingerprintGrid dutId={selectedId} />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-gray-500">
              Select a DUT to view fingerprint data
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

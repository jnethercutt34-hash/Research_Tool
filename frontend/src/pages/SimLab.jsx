import { useState, useCallback } from 'react'
import { Zap, Upload, Save, Trash2, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useSimResults } from '@/lib/queries'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import { keys } from '@/lib/queries'
import { cn } from '@/lib/utils'

function detectBiasCliff(rows, xIdx, yIdx) {
  if (!rows.length) return null
  const nominal = Math.max(...rows.map(r => r[yIdx]))
  const threshold = nominal * 0.98
  for (const row of rows) {
    if (row[yIdx] < threshold) return row[xIdx]
  }
  return null
}

export default function SimLab() {
  const { data: savedResults } = useSimResults()
  const qc = useQueryClient()
  const [parsed, setParsed] = useState(null) // { filename, headers, rows }
  const [xCol, setXCol] = useState(0)
  const [yCol, setYCol] = useState(1)
  const [notes, setNotes] = useState('')
  const [selectedSaved, setSelectedSaved] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: (file) => api.upload('/api/sim/parse', file),
    onSuccess: (data) => {
      setParsed(data)
      setXCol(0)
      setYCol(data.headers.length > 1 ? 1 : 0)
      setSelectedSaved(null)
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const biasCliff = parsed ? detectBiasCliff(parsed.rows, xCol, yCol) : null
      return api.post('/api/sim/results', {
        filename: parsed.filename,
        x_col: parsed.headers[xCol],
        y_col: parsed.headers[yCol],
        bias_cliff_v: biasCliff,
        notes,
        raw_data: JSON.stringify({ headers: parsed.headers, rows: parsed.rows }),
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.simResults }); alert('Saved!') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/api/sim/results/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.simResults }); setSelectedSaved(null) },
  })

  const loadSaved = useCallback(async (id) => {
    const result = await api.get(`/api/sim/results/${id}`)
    setSelectedSaved(result)
    try {
      const raw = JSON.parse(result.raw_data)
      setParsed({ filename: result.filename, headers: raw.headers, rows: raw.rows })
      const xi = raw.headers.indexOf(result.x_col)
      const yi = raw.headers.indexOf(result.y_col)
      setXCol(xi >= 0 ? xi : 0)
      setYCol(yi >= 0 ? yi : 1)
      setNotes(result.notes || '')
    } catch { /* ignore parse errors */ }
  }, [])

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadMutation.mutate(file)
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (file) uploadMutation.mutate(file)
  }

  // Chart data
  const chartData = parsed?.rows?.map(row => {
    const obj = {}
    parsed.headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  }) || []
  const biasCliff = parsed ? detectBiasCliff(parsed.rows, xCol, yCol) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-maroon-light" />
        <h1 className="text-2xl font-bold text-white">Simulation Lab</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: saved results */}
        <Card className="max-h-[calc(100vh-200px)] overflow-y-auto p-0">
          <div className="border-b border-white/10 p-3 text-xs font-semibold text-gray-400">Saved Results</div>
          <div className="divide-y divide-white/5">
            {savedResults?.map(r => (
              <div key={r.id} onClick={() => loadSaved(r.id)}
                className={cn('flex cursor-pointer items-center justify-between px-3 py-2',
                  selectedSaved?.id === r.id ? 'bg-maroon/15' : 'hover:bg-surface-light')}>
                <div>
                  <div className="text-xs font-medium text-white truncate">{r.filename || 'Untitled'}</div>
                  <div className="text-[10px] text-gray-500">
                    {r.x_col} vs {r.y_col}
                    {r.bias_cliff_v != null && <span className="ml-1 text-gold">BC: {r.bias_cliff_v.toFixed(2)}V</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={e => { e.stopPropagation(); if(confirm('Delete?')) deleteMutation.mutate(r.id) }}
                    className="text-gray-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
                </div>
              </div>
            ))}
            {!savedResults?.length && <p className="p-3 text-xs text-gray-500">No saved results.</p>}
          </div>
        </Card>

        {/* Main area */}
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors',
              dragOver ? 'border-maroon bg-maroon/10' : 'border-white/10 bg-surface'
            )}
          >
            <Upload className="mb-2 h-8 w-8 text-gray-500" />
            <p className="text-sm text-gray-400">Drop an LTSpice CSV/TXT file here</p>
            <label className="mt-2 cursor-pointer text-xs text-maroon-light hover:underline">
              or click to browse
              <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileSelect} className="hidden" />
            </label>
            {uploadMutation.isPending && <p className="mt-2 text-xs text-gold">Parsing...</p>}
            {uploadMutation.isError && <p className="mt-2 text-xs text-red-400">{uploadMutation.error.message}</p>}
          </div>

          {/* Chart */}
          {parsed && chartData.length > 0 && (
            <Card>
              <CardContent>
                <div className="mb-3 flex items-center gap-4">
                  <span className="text-xs text-gray-400">X:</span>
                  <select value={xCol} onChange={e => setXCol(parseInt(e.target.value))}
                    className="rounded border border-white/10 bg-surface-light px-2 py-1 text-xs text-white">
                    {parsed.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                  <span className="text-xs text-gray-400">Y:</span>
                  <select value={yCol} onChange={e => setYCol(parseInt(e.target.value))}
                    className="rounded border border-white/10 bg-surface-light px-2 py-1 text-xs text-white">
                    {parsed.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                  {biasCliff != null && (
                    <span className="ml-auto rounded bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold">
                      Bias Cliff: {biasCliff.toFixed(3)}V
                    </span>
                  )}
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey={parsed.headers[xCol]} stroke="#666" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#666" tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #333', fontSize: 11 }} />
                      <Line type="monotone" dataKey={parsed.headers[yCol]} stroke="#8C1D40" dot={false} strokeWidth={2} />
                      {biasCliff != null && (
                        <ReferenceLine x={biasCliff} stroke="#FFC627" strokeDasharray="5 5" label={{ value: 'Bias Cliff', fill: '#FFC627', fontSize: 10 }} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save controls */}
          {parsed && (
            <div className="flex items-center gap-3">
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..."
                className="flex-1 rounded-lg border border-white/10 bg-surface-light px-3 py-2 text-xs text-white placeholder-gray-500" />
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-3.5 w-3.5" /> Save Result
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

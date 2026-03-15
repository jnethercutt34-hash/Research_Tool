import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, BarChart3, Table2, Download, Trash2, Plus, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

// ── API helpers ──────────────────────────────────────────────────────
const mlApi = {
  listResults: () => api('/api/ml/results'),
  saveResult: (data) => api('/api/ml/results', {
    method: 'POST', body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  }),
  deleteResult: (id) => api(`/api/ml/results/${id}`, { method: 'DELETE' }),
  getCorrelation: () => api('/api/ml/correlation'),
  getDataset: () => api('/api/ml/dataset'),
  getDashboardStats: () => api('/api/dashboard/stats'),
}

// ── Correlation heatmap cell ─────────────────────────────────────────
function CorrCell({ value }) {
  if (value === null || value === undefined) {
    return <td className="h-8 w-8 bg-surface-dark" title="N/A" />
  }
  const abs = Math.abs(value)
  const hue = value >= 0 ? 142 : 0  // green for positive, red for negative
  const sat = Math.round(abs * 80)
  const lum = Math.round(50 - abs * 25)
  return (
    <td
      className="h-8 w-8 text-[9px] text-center font-mono cursor-default"
      style={{ backgroundColor: `hsl(${hue}, ${sat}%, ${lum}%)` }}
      title={value.toFixed(4)}
    >
      {abs >= 0.3 ? value.toFixed(2) : ''}
    </td>
  )
}

// ── Main component ───────────────────────────────────────────────────
export default function MlWorkbench() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('correlation')

  // Queries
  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['ml', 'results'],
    queryFn: mlApi.listResults,
  })

  const { data: corr, isLoading: corrLoading } = useQuery({
    queryKey: ['ml', 'correlation'],
    queryFn: mlApi.getCorrelation,
    enabled: tab === 'correlation',
  })

  const { data: dataset, isLoading: datasetLoading } = useQuery({
    queryKey: ['ml', 'dataset'],
    queryFn: mlApi.getDataset,
    enabled: tab === 'dataset',
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: mlApi.getDashboardStats,
  })

  const deleteMut = useMutation({
    mutationFn: (id) => mlApi.deleteResult(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ml', 'results'] }),
  })

  // Dataset CSV download
  const downloadCsv = () => {
    if (!dataset?.records?.length) return
    const cols = dataset.columns
    const header = ['dut_id', 'part_number', 'manufacturer', 'group', ...cols]
    const rows = dataset.records.map(r => [
      r.dut_id, r.part_number, r.manufacturer, r.group,
      ...cols.map(c => r.fingerprint[c] ?? '')
    ])
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'fingerprint_dataset.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'correlation', label: 'Correlation Matrix', icon: BarChart3 },
    { id: 'dataset', label: 'Dataset', icon: Table2 },
    { id: 'results', label: 'Saved Results', icon: Brain },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-maroon-light" />
          <h1 className="text-2xl font-bold text-white">ML Workbench</h1>
        </div>
        {stats && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{stats.dut_count} DUTs</span>
            <span>{stats.run_count} runs</span>
            <span>{stats.ml_result_count} saved models</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-dark p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id ? 'bg-maroon text-white' : 'text-gray-400 hover:text-white'
            }`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Correlation Matrix Tab ──────────────────────── */}
      {tab === 'correlation' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />Fingerprint Correlation Matrix
            </CardTitle>
            <CardDescription>
              Pearson correlation between 15-Point Fingerprint parameters across all DUTs.
              {corr && ` (${corr.n_duts} DUTs analyzed)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {corrLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
              </div>
            ) : !corr?.matrix?.length ? (
              <div className="py-12 text-center text-gray-500">
                <Activity className="mx-auto h-8 w-8 mb-2" />
                <p>No fingerprint data available. Add DUTs and record measurements first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="border-collapse">
                  <thead>
                    <tr>
                      <th className="h-8 w-20" />
                      {corr.columns.map(c => (
                        <th key={c} className="h-8 w-8 text-[8px] text-gray-400 font-normal"
                          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {corr.columns.map((rowLabel, i) => (
                      <tr key={rowLabel}>
                        <td className="pr-2 text-right text-[9px] text-gray-400 font-mono">{rowLabel}</td>
                        {corr.matrix[i].map((val, j) => (
                          <CorrCell key={j} value={val} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded" style={{ background: 'hsl(142,80%,25%)' }} />
                    Strong positive
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded" style={{ background: 'hsl(0,80%,25%)' }} />
                    Strong negative
                  </span>
                  <span>Values shown when |r| ≥ 0.3</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Dataset Tab ─────────────────────────────────── */}
      {tab === 'dataset' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Table2 className="h-5 w-5" />ML Dataset
                </CardTitle>
                <CardDescription>
                  Averaged fingerprint data per DUT, ready for ML pipelines.
                  {dataset && ` ${dataset.n_records} records × ${dataset.columns?.length || 0} features`}
                </CardDescription>
              </div>
              <Button onClick={downloadCsv} variant="secondary" size="sm" className="gap-1.5"
                disabled={!dataset?.records?.length}>
                <Download className="h-3.5 w-3.5" />Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {datasetLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
              </div>
            ) : !dataset?.records?.length ? (
              <div className="py-12 text-center text-gray-500">
                <Table2 className="mx-auto h-8 w-8 mb-2" />
                <p>No fingerprint data to export. Record DUT measurements first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-2 py-1.5 text-left text-gray-400 font-medium">DUT</th>
                      <th className="px-2 py-1.5 text-left text-gray-400 font-medium">Part</th>
                      <th className="px-2 py-1.5 text-left text-gray-400 font-medium">Group</th>
                      <th className="px-2 py-1.5 text-right text-gray-400 font-medium">Runs</th>
                      {dataset.columns.map(c => (
                        <th key={c} className="px-2 py-1.5 text-right text-gray-400 font-medium font-mono">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.records.map(r => (
                      <tr key={r.dut_id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-2 py-1.5 text-gray-300">#{r.dut_id}</td>
                        <td className="px-2 py-1.5 text-white font-medium">{r.part_number}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.group}</td>
                        <td className="px-2 py-1.5 text-right text-gray-400">{r.n_runs}</td>
                        {dataset.columns.map(c => (
                          <td key={c} className="px-2 py-1.5 text-right font-mono text-gray-300">
                            {r.fingerprint[c] != null ? r.fingerprint[c].toFixed(4) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Saved Results Tab ───────────────────────────── */}
      {tab === 'results' && (
        <div className="space-y-3">
          {resultsLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
            </div>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="mx-auto h-10 w-10 text-gray-600 mb-3" />
                <p className="text-gray-400">No saved ML results yet.</p>
                <p className="text-xs text-gray-600 mt-1">
                  Results are saved when you run ML experiments from the correlation analysis.
                </p>
              </CardContent>
            </Card>
          ) : (
            results.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{r.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.model_type && <span className="text-maroon-light">{r.model_type}</span>}
                        {r.model_type && ' · '}
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button onClick={() => { if (confirm('Delete this result?')) deleteMut.mutate(r.id) }}
                      className="text-gray-500 hover:text-red-400 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Metrics */}
                  {r.metrics && typeof r.metrics === 'object' && Object.keys(r.metrics).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {Object.entries(r.metrics).map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-surface-dark px-3 py-1.5">
                          <p className="text-[10px] text-gray-500 uppercase">{k}</p>
                          <p className="text-sm font-mono text-white">{typeof v === 'number' ? v.toFixed(4) : v}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Feature importance */}
                  {r.feature_importance && typeof r.feature_importance === 'object' && Object.keys(r.feature_importance).length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] text-gray-500 uppercase mb-1.5">Feature Importance</p>
                      <div className="space-y-1">
                        {Object.entries(r.feature_importance)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 8)
                          .map(([feat, imp]) => (
                            <div key={feat} className="flex items-center gap-2">
                              <span className="w-16 text-[10px] text-gray-400 font-mono truncate">{feat}</span>
                              <div className="flex-1 h-2 rounded-full bg-surface-dark overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-maroon to-gold"
                                  style={{ width: `${Math.min(imp * 100, 100)}%` }} />
                              </div>
                              <span className="w-10 text-right text-[10px] text-gray-500 font-mono">{(imp * 100).toFixed(1)}%</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  {r.notes && <p className="mt-2 text-xs text-gray-500">{r.notes}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}

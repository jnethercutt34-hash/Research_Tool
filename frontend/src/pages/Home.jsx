import {
  Cpu,
  Database,
  FlaskConical,
  Zap,
  BrainCircuit,
  MessageSquare,
  BookOpen,
  FileText,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useStatus, useDuts, useRepoTree } from '@/lib/queries'
import { api } from '@/lib/api'
import StatsCard from '@/components/StatsCard'
import ModuleCard from '@/components/ModuleCard'

const modules = [
  {
    step: 1,
    title: 'Radiation Data Explorer',
    description: 'Browse 1,267 NASA radiation test report PDFs with AI-powered semantic search.',
    icon: Database,
    to: '/rad-explorer',
    features: ['Repo browser by category', 'RAG semantic search', 'Cross-reference panel'],
  },
  {
    step: 2,
    title: 'Test Bed Manager',
    description: 'Manage test equipment inventory, create test runs, and generate AI test plans.',
    icon: FlaskConical,
    to: '/testbed',
    features: ['Equipment CRUD', 'AI parameter generator', 'Export MD / PDF'],
  },
  {
    step: 3,
    title: 'DUT Tracker',
    description: '15-Point Fingerprint data collection for 100 DUT units across 4 test groups.',
    icon: Cpu,
    to: '/duts',
    features: ['Rule of 5 protocol', 'Auto mean/σ stats', 'CSV export for ML'],
    accent: true,
  },
  {
    step: 4,
    title: 'Simulation Lab',
    description: 'Import LTSpice simulation outputs, visualize waveforms, detect Bias Cliff.',
    icon: Zap,
    to: '/sim-lab',
    features: ['Drag-drop CSV import', 'Interactive charts', 'Bias Cliff detection'],
  },
  {
    step: 5,
    title: 'ML Workbench',
    description: 'Prepare fingerprint data for XGBoost, visualize feature importance and correlations.',
    icon: BrainCircuit,
    to: '/ml',
    features: ['Correlation heatmap', 'Feature importance chart', 'Model comparison'],
    accent: true,
  },
  {
    step: 6,
    title: 'Research Chat',
    description: 'Dual-provider AI chat for deep-diving into LDO radiation physics.',
    icon: MessageSquare,
    to: '/chat',
    features: ['Claude + Gemini', 'Streaming responses', 'Save to Wiki'],
  },
  {
    step: 7,
    title: 'Research Wiki',
    description: 'Interconnected knowledge base for building papers and dissertation chapters.',
    icon: BookOpen,
    to: '/wiki',
    features: ['[[Wiki links]]', 'Full-text search', 'Tag-based export'],
  },
]

const pipeline = [
  { label: '1. Study\nLiterature', active: true },
  { label: '2. Setup\nTest Bed', active: false },
  { label: '3. Collect\nData', active: false },
  { label: '4. Analyze\nML', active: false },
  { label: '5. Publish\nPapers', active: false },
]

export default function Home() {
  const { data: status } = useStatus()
  const { data: duts } = useDuts()
  const { data: repo } = useRepoTree()
  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api('/api/dashboard/stats'),
  })

  const dutCount = stats?.dut_count ?? duts?.length ?? 0
  const pdfCount = repo?.count ?? 0
  const chunksReady = status?.ready ? 'Ready' : 'Not indexed'
  const runCount = stats?.run_count ?? 0

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          TID Prognostics Platform
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-400">
          Machine Learning Prognostics for COTS Power Management in Space —
          predicting LDO radiation performance through non-destructive electrical screening.
        </p>
      </div>

      {/* Research Pipeline */}
      <div className="flex items-center justify-center gap-2">
        {pipeline.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex h-16 w-28 items-center justify-center rounded-lg border text-center text-[11px] font-medium leading-tight ${
                step.active
                  ? 'border-maroon bg-maroon/15 text-maroon-light'
                  : 'border-white/10 bg-surface text-gray-500'
              }`}
            >
              <span className="whitespace-pre-line">{step.label}</span>
            </div>
            {i < pipeline.length - 1 && (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            )}
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard icon={Cpu} label="DUT Units" value={dutCount} />
        <StatsCard icon={FileText} label="PDFs Indexed" value={pdfCount} accent />
        <StatsCard icon={Activity} label="Vector DB" value={chunksReady} />
        <StatsCard icon={Database} label="Fingerprint Runs" value={runCount} accent />
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Research Modules</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((mod) => (
            <ModuleCard key={mod.to} {...mod} />
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <div className="rounded-xl border border-white/10 bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Getting Started</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Index PDFs', desc: 'Run the PDF pipeline to populate the vector store for RAG search.' },
            { title: 'Add Equipment', desc: 'Register your Keithley 4200-SCS and other test equipment.' },
            { title: 'Register DUTs', desc: 'Add your 100 DUT units and begin 15-point fingerprint data collection.' },
            { title: 'Start Writing', desc: 'Use the Wiki to organize literature reviews and paper drafts.' },
          ].map((tip, i) => (
            <div key={i} className="rounded-lg bg-surface-light p-4">
              <h3 className="mb-1 text-sm font-semibold text-white">{tip.title}</h3>
              <p className="text-xs text-gray-400">{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Navbar from '@/components/Navbar'
import Home from '@/pages/Home'

// Lazy-load chart-heavy pages to cut initial bundle by ~400KB
const RadExplorer = React.lazy(() => import('@/pages/RadExplorer'))
const SimLab = React.lazy(() => import('@/pages/SimLab'))
const MlWorkbench = React.lazy(() => import('@/pages/MlWorkbench'))

// These are lightweight — load eagerly
import TestBed from '@/pages/TestBed'
import DutTracker from '@/pages/DutTracker'
import Chat from '@/pages/Chat'
import Wiki from '@/pages/Wiki'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // Data stays fresh for 30 seconds
      retry: 1,                // Retry failed requests once
      refetchOnWindowFocus: false,
    },
  },
})

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-maroon border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-surface-dark">
          <Navbar />
          <main className="mx-auto max-w-screen-2xl px-4 pb-12 pt-20">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/rad-explorer" element={<RadExplorer />} />
                <Route path="/testbed" element={<TestBed />} />
                <Route path="/duts" element={<DutTracker />} />
                <Route path="/sim-lab" element={<SimLab />} />
                <Route path="/ml" element={<MlWorkbench />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/wiki" element={<Wiki />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

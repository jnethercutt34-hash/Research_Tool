/**
 * React Query hooks for all API resources.
 * Central place for cache keys, fetch functions, and mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api'

// ─── Keys ──────────────────────────────────────────────
export const keys = {
  status: ['status'],
  dashboardStats: ['dashboard', 'stats'],
  // Rad Explorer
  repoTree: ['repo', 'tree'],
  repoParts: (filters) => ['repo', 'parts', filters],
  repoDetail: (filename) => ['repo', 'part', filename],
  // Components / Test Bed
  components: ['components'],
  testRuns: ['test-runs'],
  testRun: (id) => ['test-runs', id],
  // DUTs
  duts: ['duts'],
  dutRuns: (id) => ['duts', id, 'runs'],
  // Sim
  simResults: ['sim', 'results'],
  simResult: (id) => ['sim', 'results', id],
  // Chat
  conversations: ['chat', 'conversations'],
  messages: (id) => ['chat', 'conversations', id, 'messages'],
  // Wiki
  wikiPages: ['wiki', 'pages'],
  wikiPage: (slug) => ['wiki', 'pages', slug],
  wikiTags: ['wiki', 'tags'],
  // ML
  mlResults: ['ml', 'results'],
}

// ─── Dashboard ─────────────────────────────────────────
export function useStatus() {
  return useQuery({ queryKey: keys.status, queryFn: () => api.get('/api/status') })
}

// ─── Components ────────────────────────────────────────
export function useComponents() {
  return useQuery({ queryKey: keys.components, queryFn: () => api.get('/api/components') })
}

// ─── Test Runs ─────────────────────────────────────────
export function useTestRuns() {
  return useQuery({ queryKey: keys.testRuns, queryFn: () => api.get('/api/test-runs') })
}

export function useTestRun(id) {
  return useQuery({
    queryKey: keys.testRun(id),
    queryFn: () => api.get(`/api/test-runs/${id}`),
    enabled: !!id,
  })
}

// ─── DUTs ──────────────────────────────────────────────
export function useDuts() {
  return useQuery({ queryKey: keys.duts, queryFn: () => api.get('/api/duts') })
}

export function useDutRuns(id) {
  return useQuery({
    queryKey: keys.dutRuns(id),
    queryFn: () => api.get(`/api/duts/${id}/runs`),
    enabled: !!id,
  })
}

// ─── Repo / Rad Explorer ───────────────────────────────
export function useRepoTree() {
  return useQuery({ queryKey: keys.repoTree, queryFn: () => api.get('/api/repo/tree') })
}

// ─── Sim Results ───────────────────────────────────────
export function useSimResults() {
  return useQuery({ queryKey: keys.simResults, queryFn: () => api.get('/api/sim/results') })
}

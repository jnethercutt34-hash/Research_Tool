/**
 * API client — fetch wrapper for all backend calls.
 * Adds Bearer token from localStorage if present.
 */

const BASE = '' // Same-origin in dev (Vite proxy) and prod (FastAPI serves SPA)

async function request(path, options = {}) {
  const token = localStorage.getItem('api_token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || body.error || detail
    } catch { /* not JSON */ }
    throw new Error(detail)
  }

  // Handle 204 No Content
  if (res.status === 204) return null
  return res.json()
}

// Convenience methods
export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),

  // File upload (no JSON content-type)
  upload: async (path, file) => {
    const token = localStorage.getItem('api_token')
    const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: form })
    if (!res.ok) {
      let detail = res.statusText
      try { const b = await res.json(); detail = b.detail || b.error || detail } catch {}
      throw new Error(detail)
    }
    return res.json()
  },
}

export default api

// ---------------------------------------------------------------------------
// API client — thin fetch wrappers over the FastAPI backend. Every function
// matches the response shapes the hooks already consume; the frontend must
// only ever display the scores this module returns, never compute its own.
// ---------------------------------------------------------------------------

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const payload = await response.json()
      if (typeof payload.detail === 'string') detail = payload.detail
      else if (Array.isArray(payload.detail)) {
        detail = payload.detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
      }
    } catch {
      // keep the status-based fallback
    }
    throw new Error(detail)
  }

  if (response.status === 204) return null
  return response.json()
}

export function getRoster() {
  return request('/roster')
}

export function addPlayer(player) {
  return request('/roster', { method: 'POST', body: JSON.stringify(player) })
}

export function updatePlayer(id, ratings) {
  return request(`/roster/${id}`, { method: 'PATCH', body: JSON.stringify(ratings) })
}

export function removePlayer(id) {
  return request(`/roster/${id}`, { method: 'DELETE' })
}

export function getBattingOrder() {
  return request('/batting-order')
}

/** @param {Array<{slot: number, playerId: string}>} locked
 *  @param {{ weights?: Record<string, number>, preset?: string }} [strategy] */
export function generateBattingOrder(locked, strategy = {}) {
  const body = { locked }
  if (strategy.weights) body.weights = strategy.weights
  else if (strategy.preset) body.preset = strategy.preset
  return request('/batting-order', { method: 'POST', body: JSON.stringify(body) })
}

export function getPresets() {
  return request('/presets')
}

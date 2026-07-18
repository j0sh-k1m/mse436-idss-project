import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/mockApi'

export function useRoster() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .getRoster()
      .then(setPlayers)
      .catch((err) => setError(err.message || 'Failed to load roster'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addPlayer = useCallback(
    (player) => api.addPlayer(player).then(() => refresh()),
    [refresh],
  )

  const updatePlayer = useCallback(
    (id, ratings) => api.updatePlayer(id, ratings).then(() => refresh()),
    [refresh],
  )

  const removePlayer = useCallback(
    (id) => api.removePlayer(id).then(() => refresh()),
    [refresh],
  )

  return { players, loading, error, refresh, addPlayer, updatePlayer, removePlayer }
}

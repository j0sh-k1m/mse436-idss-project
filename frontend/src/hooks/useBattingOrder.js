import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/mockApi'

function diffOrder(prev, next) {
  const changes = []
  const len = Math.max(prev.length, next.length)
  for (let slot = 0; slot < len; slot++) {
    const from = prev[slot] ?? null
    const to = next[slot] ?? null
    if (from !== to) changes.push({ slot, from, to })
  }
  return changes
}

export function useBattingOrder() {
  const [order, setOrder] = useState([])
  const [locked, setLocked] = useState([])
  const [scoresByPlayerId, setScoresByPlayerId] = useState({})
  const [overallScore, setOverallScore] = useState(0)
  const [changes, setChanges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const applyResult = useCallback((result) => {
    setOrder(result.order)
    setLocked(result.locked)
    setOverallScore(result.overallScore)
    // Batting score is a property of the player, not the slot, so index it by
    // playerId — that way it stays correct even after a local drag-reorder
    // that hasn't been sent back through generateBattingOrder yet.
    const map = {}
    result.order.forEach((playerId, i) => {
      map[playerId] = result.scores[i]
    })
    setScoresByPlayerId(map)
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    return api
      .getBattingOrder()
      .then(applyResult)
      .catch((err) => setError(err.message || 'Failed to load batting order'))
      .finally(() => setLoading(false))
  }, [applyResult])

  useEffect(() => {
    refresh()
  }, [refresh])

  const generate = useCallback(() => {
    setLoading(true)
    setError(null)
    const previous = order
    return api
      .generateBattingOrder(locked)
      .then((result) => {
        applyResult(result)
        setChanges(diffOrder(previous, result.order))
      })
      .catch((err) => setError(err.message || 'Failed to generate batting order'))
      .finally(() => setLoading(false))
  }, [locked, order, applyResult])

  const reorder = useCallback((fromIndex, toIndex) => {
    setOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  // Locked entries pin a *player*, not a raw index — after a drag reorders
  // the array, resync each lock's slot number to wherever that player ended up.
  useEffect(() => {
    setLocked((prev) => {
      let changed = false
      const next = prev
        .map((entry) => {
          const slot = order.indexOf(entry.playerId)
          if (slot === entry.slot) return entry
          changed = true
          return { ...entry, slot }
        })
        .filter((entry) => entry.slot !== -1)
      return changed || next.length !== prev.length ? next : prev
    })
  }, [order])

  const toggleLock = useCallback(
    (slot) => {
      setLocked((prev) => {
        const isLocked = prev.some((l) => l.slot === slot)
        if (isLocked) return prev.filter((l) => l.slot !== slot)
        const playerId = order[slot]
        if (!playerId) return prev
        return [...prev, { slot, playerId }]
      })
    },
    [order],
  )

  const dismissChanges = useCallback(() => setChanges([]), [])

  return {
    order,
    locked,
    scoresByPlayerId,
    overallScore,
    changes,
    loading,
    error,
    refresh,
    generate,
    reorder,
    toggleLock,
    dismissChanges,
  }
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../api/mockApi'
import { playerMoves, slotLabel } from '../utils/decisionViz'

const DEFAULT_WEIGHTS = { trad: 1.0, power: 0.0, speed: 0.0, offense: 0.3 }

const STALE_LINEUP =
  'Lineup updated. Regenerate options to refresh strategy comparisons and decision chips.'
const STALE_ROSTER =
  'Roster updated. Regenerate options to refresh strategy comparisons and decision chips.'

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

function scoresMapFromResult(result) {
  const map = {}
  result.order.forEach((playerId, i) => {
    map[playerId] = result.scores[i]
  })
  return map
}

function explanationsMapFromResult(result) {
  const map = {}
  const explanations = result.explanations ?? []
  result.order.forEach((playerId, i) => {
    if (explanations[i]) map[playerId] = explanations[i]
  })
  return map
}

export function useBattingOrder() {
  const [order, setOrder] = useState([])
  const [locked, setLocked] = useState([])
  const [scoresByPlayerId, setScoresByPlayerId] = useState({})
  const [explanationsByPlayerId, setExplanationsByPlayerId] = useState({})
  const [overallScore, setOverallScore] = useState(0)
  const [changes, setChanges] = useState([])
  const [previousOrder, setPreviousOrder] = useState([])
  const [alternatives, setAlternatives] = useState([])
  const [selectedAlternativeId, setSelectedAlternativeId] = useState(null)
  const [staleNotice, setStaleNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [customWeights, setCustomWeights] = useState(DEFAULT_WEIGHTS)

  const applyResult = useCallback((result) => {
    setOrder(result.order)
    setLocked(result.locked)
    setOverallScore(result.overallScore)
    setScoresByPlayerId(scoresMapFromResult(result))
    setExplanationsByPlayerId(explanationsMapFromResult(result))
  }, [])

  const clearGenerated = useCallback((notice) => {
    setAlternatives([])
    setSelectedAlternativeId(null)
    setChanges([])
    setPreviousOrder([])
    setExplanationsByPlayerId({})
    setScoresByPlayerId({})
    setStaleNotice(notice)
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

  useEffect(() => {
    api
      .getPresets()
      .then((loaded) => {
        const balanced = loaded.Balanced
        if (balanced) setCustomWeights({ ...balanced })
      })
      .catch(() => {
        // Presets are only used to seed custom sliders; ignore load failures.
      })
  }, [])

  const setCustomWeight = useCallback((key, value) => {
    setCustomWeights((prev) => ({ ...prev, [key]: value }))
  }, [])

  const runGenerate = useCallback(
    (preferCustom) => {
      setLoading(true)
      setError(null)
      const options = preferCustom ? { customWeights } : {}
      return api
        .generateBattingOrder(locked, options)
        .then((result) => {
          // Show compare cards only — do not auto-select or overwrite the working lineup.
          setAlternatives(result.alternatives ?? [])
          setSelectedAlternativeId(null)
          setChanges([])
          setPreviousOrder([])
          setStaleNotice(null)
        })
        .catch((err) => setError(err.message || 'Failed to generate batting order'))
        .finally(() => setLoading(false))
    },
    [locked, customWeights],
  )

  const generate = useCallback(() => runGenerate(false), [runGenerate])
  const generateWithCustom = useCallback(() => runGenerate(true), [runGenerate])

  const selectAlternative = useCallback(
    (alternative) => {
      if (!alternative || alternative.id === selectedAlternativeId) return
      setLoading(true)
      setError(null)
      const previous = order
      return api
        .selectBattingOrder(alternative)
        .then((result) => {
          setPreviousOrder(previous)
          applyResult(result)
          setChanges(diffOrder(previous, result.order))
          setSelectedAlternativeId(alternative.id)
          if (alternative.label === 'Custom' && alternative.weights) {
            setCustomWeights({ ...alternative.weights })
          }
        })
        .catch((err) => setError(err.message || 'Failed to select lineup'))
        .finally(() => setLoading(false))
    },
    [selectedAlternativeId, order, applyResult],
  )

  const reorder = useCallback(
    (fromIndex, toIndex) => {
      if (fromIndex === toIndex) return
      setOrder((prev) => {
        const next = [...prev]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        return next
      })
      clearGenerated(STALE_LINEUP)
    },
    [clearGenerated],
  )

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

  /** Swap a bench player into the weakest unlocked slot and lock them there. */
  const promoteFromBench = useCallback(
    (playerId) => {
      if (!playerId || order.includes(playerId) || order.length === 0) return false

      const lockedSlots = new Set(locked.map((l) => l.slot))
      let target = -1
      let bestScore = Infinity
      for (let i = 0; i < order.length; i++) {
        if (lockedSlots.has(i)) continue
        const score = scoresByPlayerId[order[i]] ?? 0
        if (score < bestScore) {
          bestScore = score
          target = i
        }
      }
      if (target === -1) {
        setError('Unlock a lineup slot before promoting a bench player.')
        return false
      }

      setOrder((prev) => {
        const next = [...prev]
        next[target] = playerId
        return next
      })
      setLocked((prev) => {
        const cleared = prev.filter((l) => l.slot !== target && l.playerId !== playerId)
        return [...cleared, { slot: target, playerId }]
      })
      setError(null)
      clearGenerated(STALE_LINEUP)
      return true
    },
    [order, locked, scoresByPlayerId, clearGenerated],
  )

  const dismissChanges = useCallback(() => {
    setChanges([])
    setPreviousOrder([])
  }, [])

  const dismissStaleNotice = useCallback(() => setStaleNotice(null), [])

  const invalidateForRosterChange = useCallback(() => {
    clearGenerated(STALE_ROSTER)
  }, [clearGenerated])

  const movesByPlayerId = useMemo(
    () => (changes.length > 0 ? playerMoves(previousOrder, order) : new Map()),
    [changes, previousOrder, order],
  )

  const changeSummary = useMemo(() => {
    if (!changes.length) return []
    const moves = playerMoves(previousOrder, order)
    return [...moves.values()].map((m) => m.label)
  }, [changes, previousOrder, order])

  return {
    order,
    locked,
    scoresByPlayerId,
    explanationsByPlayerId,
    overallScore,
    changes,
    changeSummary,
    movesByPlayerId,
    alternatives,
    selectedAlternativeId,
    staleNotice,
    loading,
    error,
    customWeights,
    setCustomWeight,
    refresh,
    generate,
    generateWithCustom,
    selectAlternative,
    reorder,
    toggleLock,
    promoteFromBench,
    dismissChanges,
    dismissStaleNotice,
    invalidateForRosterChange,
    slotLabel,
  }
}

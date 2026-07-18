import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/mockApi'

function diffAssignments(prev, next) {
  const positions = new Set([...Object.keys(prev), ...Object.keys(next)])
  const changes = []
  for (const position of positions) {
    const from = prev[position] ?? null
    const to = next[position] ?? null
    if (from !== to) changes.push({ position, from, to })
  }
  return changes
}

// Compares the dragged-in player's fit score against the best remaining
// bench option for the same slot. This is a lookup/comparison over scores
// the API already computed (via getFitMatrix) — it does not invent a score.
function computeOverrideWarning(position, playerId, assignments, fitMatrix) {
  const assignedIds = new Set(Object.values(assignments))
  const candidates = Object.keys(fitMatrix).filter((id) => id !== playerId && !assignedIds.has(id))

  let best = null
  for (const candidateId of candidates) {
    const score = fitMatrix[candidateId]?.[position]
    if (score == null) continue
    if (!best || score > best.score) best = { playerId: candidateId, score }
  }
  if (!best) return null

  const draggedScore = fitMatrix[playerId]?.[position]
  if (draggedScore == null || best.score - draggedScore < api.MEANINGFUL_FIT_MARGIN) return null

  return {
    position,
    playerId,
    score: draggedScore,
    alternativePlayerId: best.playerId,
    alternativeScore: best.score,
  }
}

export function usePositionAssignment() {
  const [assignments, setAssignments] = useState({})
  const [locked, setLocked] = useState([])
  const [scores, setScores] = useState({})
  const [overallScore, setOverallScore] = useState(0)
  const [bestAlternative, setBestAlternative] = useState({})
  const [fitMatrix, setFitMatrix] = useState({})
  const [changes, setChanges] = useState([])
  const [warning, setWarning] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const applyResult = useCallback((result) => {
    setAssignments(result.assignments)
    setLocked(result.locked)
    setScores(result.scores)
    setOverallScore(result.overallScore)
    setBestAlternative(result.bestAlternative)
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    return Promise.all([api.getPositionAssignments(), api.getFitMatrix()])
      .then(([result, matrix]) => {
        applyResult(result)
        setFitMatrix(matrix)
      })
      .catch((err) => setError(err.message || 'Failed to load position assignments'))
      .finally(() => setLoading(false))
  }, [applyResult])

  useEffect(() => {
    refresh()
  }, [refresh])

  const optimize = useCallback(() => {
    setLoading(true)
    setError(null)
    const previous = assignments
    return api
      .assignPositions(locked)
      .then((result) => {
        applyResult(result)
        setChanges(diffAssignments(previous, result.assignments))
      })
      .catch((err) => setError(err.message || 'Failed to optimize positions'))
      .finally(() => setLoading(false))
  }, [locked, assignments, applyResult])

  // Dragging a player onto a slot both assigns and locks that position,
  // clears any other slot that player previously held, and immediately
  // re-solves the remaining unlocked positions around the new lock.
  const assignPlayer = useCallback(
    (position, playerId) => {
      setWarning(computeOverrideWarning(position, playerId, assignments, fitMatrix))

      const nextAssignments = {}
      for (const [pos, id] of Object.entries(assignments)) {
        if (id !== playerId) nextAssignments[pos] = id
      }
      nextAssignments[position] = playerId
      setAssignments(nextAssignments)

      const nextLocked = [
        ...locked.filter((l) => l.position !== position && l.playerId !== playerId),
        { position, playerId },
      ]
      setLocked(nextLocked)

      setLoading(true)
      setError(null)
      return api
        .assignPositions(nextLocked)
        .then((result) => {
          applyResult(result)
          setChanges(diffAssignments(nextAssignments, result.assignments))
        })
        .catch((err) => setError(err.message || 'Failed to update positions'))
        .finally(() => setLoading(false))
    },
    [assignments, locked, fitMatrix, applyResult],
  )

  const toggleLock = useCallback(
    (position) => {
      setLocked((prev) => {
        const isLocked = prev.some((l) => l.position === position)
        if (isLocked) return prev.filter((l) => l.position !== position)
        const playerId = assignments[position]
        if (!playerId) return prev
        return [...prev, { position, playerId }]
      })
    },
    [assignments],
  )

  const dismissWarning = useCallback(() => setWarning(null), [])
  const dismissChanges = useCallback(() => setChanges([]), [])

  return {
    assignments,
    locked,
    scores,
    overallScore,
    bestAlternative,
    changes,
    warning,
    loading,
    error,
    refresh,
    optimize,
    assignPlayer,
    toggleLock,
    dismissWarning,
    dismissChanges,
  }
}

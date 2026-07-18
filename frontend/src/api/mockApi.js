// ---------------------------------------------------------------------------
// Mock API client — the ONLY file in this frontend allowed to fake model
// behavior. Swap this module for real `fetch` calls once the backend exists;
// every function here matches the shape the real endpoints will return.
//
// IMPORTANT: the real Hungarian-algorithm position optimizer and the real
// batting-order scoring model live entirely in the backend. The fit-score
// weights, fill heuristics, and "best alternative" threshold below are
// placeholders that exist only so the UI has something to render before the
// backend is built — they are not the optimization the product actually
// ships with. The frontend must only ever display the scores this file
// returns, never compute its own.
// ---------------------------------------------------------------------------

import { POSITIONS } from '../constants/positions'

const LATENCY_MS = 200

// How many fit-score points a bench alternative must beat the current
// assignment by before it's worth surfacing as "you could do better here".
export const MEANINGFUL_FIT_MARGIN = 8

const INFIELD_POSITION_IDS = new Set(['P', 'C', '1B', '2B', '3B', 'SS'])

const POSITION_FIT_WEIGHTS = {
  infield: { hitting: 0.15, fielding: 0.35, throwing: 0.35, speed: 0.15 },
  outfield: { hitting: 0.15, fielding: 0.35, throwing: 0.15, speed: 0.35 },
}

const BATTING_WEIGHTS = { hitting: 0.6, speed: 0.4 }

function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(clone(value)), LATENCY_MS))
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function mkPlayer(id, name, ratings) {
  return { id, name, ratings }
}

let players = [
  mkPlayer('p1', 'Jordan Ruiz', { hitting: 4, fielding: 3, throwing: 4, speed: 5 }),
  mkPlayer('p2', 'Sam Ito', { hitting: 3, fielding: 5, throwing: 4, speed: 3 }),
  mkPlayer('p3', 'Casey Boone', { hitting: 5, fielding: 2, throwing: 3, speed: 4 }),
  mkPlayer('p4', 'Riley Marsh', { hitting: 2, fielding: 4, throwing: 5, speed: 2 }),
  mkPlayer('p5', 'Avery Quinn', { hitting: 4, fielding: 4, throwing: 3, speed: 4 }),
  mkPlayer('p6', 'Morgan Diaz', { hitting: 3, fielding: 3, throwing: 3, speed: 3 }),
  mkPlayer('p7', 'Taylor Nguyen', { hitting: 5, fielding: 4, throwing: 4, speed: 5 }),
  mkPlayer('p8', 'Drew Falk', { hitting: 2, fielding: 5, throwing: 5, speed: 2 }),
  mkPlayer('p9', 'Emerson Cole', { hitting: 3, fielding: 2, throwing: 2, speed: 5 }),
  mkPlayer('p10', 'Parker Voss', { hitting: 4, fielding: 3, throwing: 4, speed: 3 }),
]

let nextPlayerNumber = 11

// Placeholder heuristic: a weighted combination of 1-5 ratings scaled to a
// 0-100 "fit" score, weighted differently for infield vs. outfield/short
// fielder. Real per-position scoring is a backend concern.
function fitScore(player, positionId) {
  const weights = INFIELD_POSITION_IDS.has(positionId)
    ? POSITION_FIT_WEIGHTS.infield
    : POSITION_FIT_WEIGHTS.outfield
  const weighted =
    player.ratings.hitting * weights.hitting +
    player.ratings.fielding * weights.fielding +
    player.ratings.throwing * weights.throwing +
    player.ratings.speed * weights.speed
  return Math.round((weighted / 5) * 100)
}

function battingScore(player) {
  const weighted =
    player.ratings.hitting * BATTING_WEIGHTS.hitting + player.ratings.speed * BATTING_WEIGHTS.speed
  return Math.round((weighted / 5) * 100)
}

function buildFitMatrix() {
  const matrix = {}
  for (const player of players) {
    matrix[player.id] = {}
    for (const pos of POSITIONS) {
      matrix[player.id][pos.id] = fitScore(player, pos.id)
    }
  }
  return matrix
}

// Placeholder heuristic: greedily fills each open position with whichever
// remaining player has the best fit score for that specific slot. Honors
// locked pairs as fixed points. Real assignment logic (Hungarian algorithm
// over a cost matrix) belongs in the backend.
function placeholderAssignPositions(lockedPairs, fitMatrix) {
  const lockedMap = new Map(lockedPairs.map((l) => [l.position, l.playerId]))
  const takenPlayerIds = new Set(lockedMap.values())
  const openPositions = POSITIONS.map((p) => p.id).filter((id) => !lockedMap.has(id))
  let availablePlayers = players.filter((p) => !takenPlayerIds.has(p.id))

  const result = Object.fromEntries(lockedMap)
  for (const posId of openPositions) {
    if (availablePlayers.length === 0) break
    let best = availablePlayers[0]
    for (const candidate of availablePlayers) {
      if (fitMatrix[candidate.id][posId] > fitMatrix[best.id][posId]) best = candidate
    }
    result[posId] = best.id
    availablePlayers = availablePlayers.filter((p) => p.id !== best.id)
  }
  return result
}

// For each filled position, find the best-fitting bench player (someone not
// assigned anywhere) and surface them only if they'd meaningfully outscore
// the current assignment — the "what would I gain by overriding this" hint.
function computeBestAlternatives(assignments, fitMatrix) {
  const assignedIds = new Set(Object.values(assignments))
  const bench = players.filter((p) => !assignedIds.has(p.id))
  const result = {}

  for (const pos of POSITIONS) {
    const currentId = assignments[pos.id]
    if (!currentId) {
      result[pos.id] = null
      continue
    }
    const currentScore = fitMatrix[currentId][pos.id]
    let best = null
    for (const candidate of bench) {
      const score = fitMatrix[candidate.id][pos.id]
      if (!best || score > best.score) best = { playerId: candidate.id, score }
    }
    result[pos.id] = best && best.score - currentScore >= MEANINGFUL_FIT_MARGIN ? best : null
  }
  return result
}

function buildPositionState(lockedPairs) {
  const fitMatrix = buildFitMatrix()
  const assignments = placeholderAssignPositions(lockedPairs, fitMatrix)

  const scores = {}
  for (const pos of POSITIONS) {
    const playerId = assignments[pos.id]
    if (playerId) scores[pos.id] = fitMatrix[playerId][pos.id]
  }
  const scoreValues = Object.values(scores)
  const overallScore = scoreValues.length
    ? Math.round(scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length)
    : 0

  return {
    assignments,
    locked: clone(lockedPairs),
    scores,
    overallScore,
    bestAlternative: computeBestAlternatives(assignments, fitMatrix),
  }
}

// Placeholder heuristic: fills open batting slots ranked by the same
// hitting/speed-weighted score reported to the UI. Real scoring (lineup-wide
// expected-runs model) belongs in the backend.
function placeholderBattingOrder(lockedPairs) {
  const lockedMap = new Map(lockedPairs.map((l) => [l.slot, l.playerId]))
  const takenPlayerIds = new Set(lockedMap.values())
  const openSlots = players.map((_, i) => i).filter((slot) => !lockedMap.has(slot))
  const availablePlayers = players
    .filter((p) => !takenPlayerIds.has(p.id))
    .slice()
    .sort((a, b) => battingScore(b) - battingScore(a))

  const order = new Array(players.length).fill(null)
  lockedMap.forEach((playerId, slot) => {
    order[slot] = playerId
  })
  openSlots.forEach((slot, index) => {
    const player = availablePlayers[index]
    if (player) order[slot] = player.id
  })
  return order.filter(Boolean)
}

function buildBattingOrderState(lockedPairs) {
  const order = placeholderBattingOrder(lockedPairs)
  const scores = order.map((playerId) => {
    const player = players.find((p) => p.id === playerId)
    return player ? battingScore(player) : 0
  })
  const overallScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 0

  return { order, locked: clone(lockedPairs), scores, overallScore }
}

let positionState = buildPositionState([])
let battingOrderState = buildBattingOrderState([])

function pruneReferencesToPlayer(playerId) {
  positionState = buildPositionState(positionState.locked.filter((l) => l.playerId !== playerId))
  battingOrderState = buildBattingOrderState(
    battingOrderState.locked.filter((l) => l.playerId !== playerId),
  )
}

export function getRoster() {
  return delay(players)
}

export function addPlayer(player) {
  const created = mkPlayer(`p${nextPlayerNumber++}`, player.name, { ...player.ratings })
  players.push(created)
  return delay(created)
}

export function updatePlayer(id, ratings) {
  const player = players.find((p) => p.id === id)
  if (!player) return Promise.reject(new Error(`Player ${id} not found`))
  player.ratings = { ...player.ratings, ...ratings }
  return delay(player)
}

export function removePlayer(id) {
  players = players.filter((p) => p.id !== id)
  pruneReferencesToPlayer(id)
  return delay(true)
}

export function getFitMatrix() {
  return delay(buildFitMatrix())
}

export function getPositionAssignments() {
  return delay(positionState)
}

export function assignPositions(locked) {
  positionState = buildPositionState(locked)
  return delay(positionState)
}

export function getBattingOrder() {
  return delay(battingOrderState)
}

export function generateBattingOrder(locked) {
  battingOrderState = buildBattingOrderState(locked)
  return delay(battingOrderState)
}

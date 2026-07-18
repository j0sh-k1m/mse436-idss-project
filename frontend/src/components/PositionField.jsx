import { useState } from 'react'
import { POSITIONS } from '../constants/positions'
import { initials } from '../utils/initials'
import { scoreTier } from '../utils/scoreTier'
import LockToggle from './LockToggle'

function DiamondBackground() {
  return (
    <svg
      className="diamond-svg"
      viewBox="0 0 500 500"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="500" height="500" className="diamond-grass" />
      <line x1="250" y1="460" x2="500" y2="195" className="diamond-foul-line" />
      <line x1="250" y1="460" x2="0" y2="195" className="diamond-foul-line" />
      <polygon points="250,480 390,345 250,195 110,345" className="diamond-dirt" />
      <polyline points="250,460 355,345 250,230 145,345 250,460" className="diamond-basepath" />
      <circle cx="250" cy="320" r="28" className="diamond-mound" />
      <rect x="243" y="313" width="14" height="10" className="diamond-rubber" />
      <rect x="347" y="337" width="16" height="16" className="diamond-base" transform="rotate(45 355 345)" />
      <rect x="242" y="222" width="16" height="16" className="diamond-base" transform="rotate(45 250 230)" />
      <rect x="137" y="337" width="16" height="16" className="diamond-base" transform="rotate(45 145 345)" />
      <path d="M238,452 h24 v12 l-12,10 -12,-10 Z" className="diamond-home" />
    </svg>
  )
}

export default function PositionField({
  players,
  assignments,
  locked,
  scores,
  bestAlternative,
  onAssign,
  onToggleLock,
}) {
  const [dragPlayerId, setDragPlayerId] = useState(null)
  const [dragOverPosition, setDragOverPosition] = useState(null)

  const playersById = new Map(players.map((p) => [p.id, p]))
  const assignedIds = new Set(Object.values(assignments))
  const bench = players.filter((p) => !assignedIds.has(p.id))
  const lockedPositions = new Set(locked.map((l) => l.position))

  function handleDrop(positionId) {
    if (dragPlayerId) onAssign(positionId, dragPlayerId)
    setDragPlayerId(null)
    setDragOverPosition(null)
  }

  return (
    <div className="position-field">
      <div className="diamond-wrap">
        <DiamondBackground />
        {POSITIONS.map((pos) => {
          const playerId = assignments[pos.id]
          const player = playerId ? playersById.get(playerId) : null
          const isLocked = lockedPositions.has(pos.id)
          const score = scores?.[pos.id]
          const alternative = bestAlternative?.[pos.id]
          const alternativePlayer = alternative ? playersById.get(alternative.playerId) : null

          return (
            <div
              key={pos.id}
              className={`position-slot${dragOverPosition === pos.id ? ' drag-over' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverPosition(pos.id)
              }}
              onDragLeave={() => setDragOverPosition((cur) => (cur === pos.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(pos.id)
              }}
            >
              <span className="position-label">{pos.label}</span>
              {player ? (
                <div
                  className="position-chip"
                  draggable
                  onDragStart={() => setDragPlayerId(player.id)}
                >
                  <span className="chip-avatar">{initials(player.name)}</span>
                  <span className="chip-name">{player.name}</span>
                  {typeof score === 'number' && (
                    <span className={`score-badge ${scoreTier(score)}`}>{score}</span>
                  )}
                  <LockToggle locked={isLocked} label={pos.label} onToggle={() => onToggleLock(pos.id)} />
                </div>
              ) : (
                <div className="position-empty">Drop player</div>
              )}
              {alternativePlayer && (
                <p className="alternative-note">
                  {alternativePlayer.name.split(' ')[0]} ({alternative.score}) fits better here
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="bench">
        <h3>Bench</h3>
        {bench.length === 0 ? (
          <p className="bench-empty">Every player is on the field.</p>
        ) : (
          <ul className="bench-list">
            {bench.map((player) => (
              <li
                key={player.id}
                className="bench-chip"
                draggable
                onDragStart={() => setDragPlayerId(player.id)}
              >
                <span className="chip-avatar">{initials(player.name)}</span>
                <span className="chip-name">{player.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

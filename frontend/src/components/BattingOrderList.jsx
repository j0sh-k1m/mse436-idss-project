import { useState } from 'react'
import { initials } from '../utils/initials'
import { scoreTier } from '../utils/scoreTier'
import LockToggle from './LockToggle'

export default function BattingOrderList({
  players,
  order,
  locked,
  scoresByPlayerId,
  onReorder,
  onToggleLock,
}) {
  const [dragIndex, setDragIndex] = useState(null)
  const playersById = new Map(players.map((p) => [p.id, p]))
  const lockedSlots = new Set(locked.map((l) => l.slot))

  function handleDrop(index) {
    if (dragIndex !== null && !lockedSlots.has(index) && !lockedSlots.has(dragIndex)) {
      onReorder(dragIndex, index)
    }
    setDragIndex(null)
  }

  return (
    <ol className="batting-order-list">
      {order.map((playerId, index) => {
        const player = playersById.get(playerId)
        if (!player) return null
        const isLocked = lockedSlots.has(index)
        const score = scoresByPlayerId?.[playerId]

        return (
          <li
            key={playerId}
            className={`batting-row${isLocked ? ' locked' : ''}${dragIndex === index ? ' dragging' : ''}`}
            draggable={!isLocked}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => {
              if (!isLocked) e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(index)
            }}
          >
            <span className="batting-slot-number">{index + 1}</span>
            <span className="chip-avatar">{initials(player.name)}</span>
            <span className="batting-name">{player.name}</span>
            <span className="stat-chip">C {player.ratings.contact}</span>
            <span className="stat-chip">P {player.ratings.power}</span>
            {typeof score === 'number' && (
              <span className={`score-badge ${scoreTier(score)}`}>{score}</span>
            )}
            <LockToggle locked={isLocked} label={`batting slot ${index + 1}`} onToggle={() => onToggleLock(index)} />
          </li>
        )
      })}
    </ol>
  )
}

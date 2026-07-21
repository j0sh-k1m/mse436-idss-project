import { useState } from 'react'
import { initials } from '../utils/initials'
import { explanationSummary, slotLabel } from '../utils/decisionViz'
import LockToggle from './LockToggle'

export default function BattingOrderList({
  players,
  order,
  locked,
  explanationsByPlayerId,
  movesByPlayerId,
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
        const explanation = explanationsByPlayerId?.[playerId]
        const move = movesByPlayerId?.get(playerId)
        const why = explanationSummary(explanation)

        return (
          <li
            key={playerId}
            className={`batting-row${isLocked ? ' locked' : ''}${dragIndex === index ? ' dragging' : ''}${move ? ' moved' : ''}`}
            draggable={!isLocked}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => {
              if (!isLocked) e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(index)
            }}
            title={why || undefined}
          >
            <span className="batting-slot-number" title={slotLabel(index)}>
              {index + 1}
            </span>
            <span className="chip-avatar">{initials(player.name)}</span>
            <div className="batting-identity">
              <span className="batting-name">{player.name}</span>
              <div className="batting-decision-meta">
                {move && (
                  <span className={`move-badge move-${move.kind}`} title={move.label}>
                    {move.label}
                  </span>
                )}
                {explanation?.topLabel && (
                  <span className="driver-badge" title={why}>
                    Why: {explanation.topLabel}
                  </span>
                )}
              </div>
            </div>
            <span className="stat-chips">
              <span className="stat-chip">C {player.ratings.contact}</span>
              <span className="stat-chip">P {player.ratings.power}</span>
              <span className="stat-chip">D {player.ratings.discipline}</span>
              <span className="stat-chip">S {player.ratings.speed}</span>
            </span>
            <LockToggle locked={isLocked} label={`batting slot ${index + 1}`} onToggle={() => onToggleLock(index)} />
          </li>
        )
      })}
    </ol>
  )
}

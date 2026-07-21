import { initials } from '../utils/initials'

/**
 * Compact roster reference for the batting-order refine step.
 * Shows who is starting vs benched for the selected lineup.
 */
export default function RosterStatusPanel({ players, order, locked, onPromoteFromBench, busy }) {
  const inLineup = new Set(order)
  const lockedPlayers = new Set(locked.map((l) => l.playerId))
  const lockedSlots = new Set(locked.map((l) => l.slot))
  const canPromote = order.length > 0 && lockedSlots.size < order.length
  const starters = order
    .map((id, slot) => {
      const player = players.find((p) => p.id === id)
      return player ? { player, slot } : null
    })
    .filter(Boolean)
  const bench = players.filter((p) => !inLineup.has(p.id))

  return (
    <aside className="roster-status-panel" aria-label="Roster status">
      <header className="roster-status-header">
        <h3>Roster</h3>
        <p className="roster-status-hint">
          Lock players in the lineup on the left. Use Start on the bench to force someone into the
          nine, then regenerate. Manage ratings on the Roster tab.
        </p>
      </header>

      <div className="roster-status-section">
        <h4 className="roster-status-label">
          In the order <span className="roster-status-count">{starters.length}</span>
        </h4>
        <ul className="roster-status-list">
          {starters.map(({ player, slot }) => (
            <li
              key={player.id}
              className={`roster-status-row${lockedPlayers.has(player.id) ? ' is-locked' : ''}`}
            >
              <span className="roster-status-slot">{slot + 1}</span>
              <span className="chip-avatar">{initials(player.name)}</span>
              <span className="roster-status-identity">
                <span className="roster-status-name">{player.name}</span>
                {lockedPlayers.has(player.id) && (
                  <span className="roster-status-lock" title="Locked in this slot">
                    Locked
                  </span>
                )}
              </span>
              <span className="stat-chip">
                C{player.ratings.contact} P{player.ratings.power} D{player.ratings.discipline} S
                {player.ratings.speed}
              </span>
            </li>
          ))}
          {starters.length === 0 && (
            <li className="roster-status-empty">Generate options to fill a batting order.</li>
          )}
        </ul>
      </div>

      {bench.length > 0 && (
        <div className="roster-status-section">
          <h4 className="roster-status-label">
            Bench <span className="roster-status-count">{bench.length}</span>
          </h4>
          <ul className="roster-status-list">
            {bench.map((player) => (
              <li key={player.id} className="roster-status-row is-bench">
                <span className="roster-status-slot">—</span>
                <span className="chip-avatar">{initials(player.name)}</span>
                <span className="roster-status-identity">
                  <span className="roster-status-name">{player.name}</span>
                </span>
                <span className="stat-chip">
                  C{player.ratings.contact} P{player.ratings.power} D{player.ratings.discipline} S
                  {player.ratings.speed}
                </span>
                {onPromoteFromBench && (
                  <button
                    type="button"
                    className="roster-status-promote"
                    disabled={busy || !canPromote}
                    title={
                      canPromote
                        ? 'Swap into the weakest unlocked slot and lock them there'
                        : 'Unlock a lineup slot to promote from the bench'
                    }
                    onClick={() => onPromoteFromBench(player.id)}
                  >
                    Start
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}

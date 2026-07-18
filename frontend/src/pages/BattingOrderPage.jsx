import { useRoster } from '../hooks/useRoster'
import { useBattingOrder } from '../hooks/useBattingOrder'
import BattingOrderList from '../components/BattingOrderList'

function playerName(playersById, id) {
  return playersById.get(id)?.name ?? 'an empty slot'
}

export default function BattingOrderPage() {
  const { players, loading: rosterLoading, error: rosterError } = useRoster()
  const {
    order,
    locked,
    scoresByPlayerId,
    overallScore,
    changes,
    loading,
    error,
    generate,
    reorder,
    toggleLock,
    dismissChanges,
  } = useBattingOrder()

  const busy = rosterLoading || loading
  const playersById = new Map(players.map((p) => [p.id, p]))

  return (
    <section className="page batting-order-page">
      <header className="page-header">
        <div className="page-header-top">
          <h2>Batting Order</h2>
          <p className="score-headline">
            Lineup batting score: <span className="score-headline-value">{overallScore}</span>/100
          </p>
        </div>
        <p className="page-hint">
          Drag rows to reorder unlocked hitters, lock in the spots you want to keep, then generate
          to fill the rest of the lineup.
        </p>
        <button type="button" className="btn-primary" onClick={generate} disabled={busy}>
          Generate order
        </button>
      </header>

      {(error || rosterError) && <p className="error-banner">{error || rosterError}</p>}

      {changes.length > 0 && (
        <p className="changes-banner">
          Changed:{' '}
          {changes
            .map(
              (c) =>
                `#${c.slot + 1} (${playerName(playersById, c.from)} → ${playerName(playersById, c.to)})`,
            )
            .join(', ')}
          {locked.length > 0 &&
            `, ${locked.length} slot${locked.length === 1 ? '' : 's'} held by locks.`}
          <button
            type="button"
            className="dismiss-btn"
            onClick={dismissChanges}
            aria-label="Dismiss changes summary"
          >
            ×
          </button>
        </p>
      )}

      {busy && order.length === 0 ? (
        <p className="loading-banner">Loading…</p>
      ) : (
        <BattingOrderList
          players={players}
          order={order}
          locked={locked}
          scoresByPlayerId={scoresByPlayerId}
          onReorder={reorder}
          onToggleLock={toggleLock}
        />
      )}
    </section>
  )
}

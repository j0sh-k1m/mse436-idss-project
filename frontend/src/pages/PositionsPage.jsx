import { useRoster } from '../hooks/useRoster'
import { usePositionAssignment } from '../hooks/usePositionAssignment'
import PositionField from '../components/PositionField'

function playerName(playersById, id) {
  return playersById.get(id)?.name ?? 'an empty slot'
}

export default function PositionsPage() {
  const { players, loading: rosterLoading, error: rosterError } = useRoster()
  const {
    assignments,
    locked,
    scores,
    overallScore,
    bestAlternative,
    changes,
    warning,
    loading,
    error,
    optimize,
    assignPlayer,
    toggleLock,
    dismissWarning,
    dismissChanges,
  } = usePositionAssignment()

  const busy = rosterLoading || loading
  const playersById = new Map(players.map((p) => [p.id, p]))

  return (
    <section className="page positions-page">
      <header className="page-header">
        <div className="page-header-top">
          <h2>Positions</h2>
          <p className="score-headline">
            Lineup fit: <span className="score-headline-value">{overallScore}</span>/100
          </p>
        </div>
        <p className="page-hint">
          Drag a player onto a spot on the diamond to assign and lock them there, then optimize to
          fill the rest of the field around your locks.
        </p>
        <button type="button" className="btn-primary" onClick={optimize} disabled={busy}>
          Optimize positions
        </button>
      </header>

      {(error || rosterError) && <p className="error-banner">{error || rosterError}</p>}

      {warning && (
        <p className="warning-banner">
          {playerName(playersById, warning.playerId)} ({warning.score}) is a weaker fit for{' '}
          {warning.position} than {playerName(playersById, warning.alternativePlayerId)} (
          {warning.alternativeScore}) — locking anyway.
          <button
            type="button"
            className="dismiss-btn"
            onClick={dismissWarning}
            aria-label="Dismiss fit warning"
          >
            ×
          </button>
        </p>
      )}

      {changes.length > 0 && (
        <p className="changes-banner">
          Changed:{' '}
          {changes
            .map(
              (c) =>
                `${c.position} (${playerName(playersById, c.from)} → ${playerName(playersById, c.to)})`,
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

      {busy && players.length === 0 ? (
        <p className="loading-banner">Loading…</p>
      ) : (
        <PositionField
          players={players}
          assignments={assignments}
          locked={locked}
          scores={scores}
          bestAlternative={bestAlternative}
          onAssign={assignPlayer}
          onToggleLock={toggleLock}
        />
      )}
    </section>
  )
}

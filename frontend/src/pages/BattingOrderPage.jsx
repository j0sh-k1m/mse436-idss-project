import { useRoster } from '../hooks/useRoster'
import { useBattingOrder } from '../hooks/useBattingOrder'
import BattingOrderList from '../components/BattingOrderList'
import LineupAlternatives from '../components/LineupAlternatives'
import RosterStatusPanel from '../components/RosterStatusPanel'

const LINEUP_SIZE = 9

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
    alternatives,
    selectedAlternativeId,
    loading,
    error,
    customWeights,
    setCustomWeight,
    generate,
    generateWithCustom,
    selectAlternative,
    reorder,
    toggleLock,
    dismissChanges,
  } = useBattingOrder()

  const busy = rosterLoading || loading
  const canGenerate = players.length >= LINEUP_SIZE && !busy
  const playersById = new Map(players.map((p) => [p.id, p]))
  const hasOptions = alternatives.length > 0

  return (
    <section className="page batting-order-page">
      <header className="page-header">
        <div className="page-header-top">
          <div className="page-header-copy">
            <h2>Batting Order</h2>
            <p className="page-hint">
              Generate three strategy options, pick one, then lock slots or drag to override. Use
              Customize to try your own weight mix against the same three.
            </p>
          </div>
          <div className="page-header-actions">
            {order.length > 0 && (
              <p className="score-headline">
                Score <span className="score-headline-value">{overallScore}</span>/100
              </p>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={generate}
              disabled={!canGenerate}
              title={
                players.length >= LINEUP_SIZE
                  ? undefined
                  : `Need at least ${LINEUP_SIZE} players (currently ${players.length})`
              }
            >
              {hasOptions ? 'Regenerate options' : 'Generate options'}
            </button>
          </div>
        </div>
        {players.length < LINEUP_SIZE && (
          <p className="strategy-guard">
            Need at least {LINEUP_SIZE} players on the roster (currently {players.length}). Add
            players on the Roster tab.
          </p>
        )}
      </header>

      {(error || rosterError) && <p className="error-banner">{error || rosterError}</p>}

      {!hasOptions && !busy && players.length >= LINEUP_SIZE && (
        <p className="empty-options-banner">
          Hit <strong>Generate options</strong> to compare Balanced, Small-ball, and Max offense
          lineups.
        </p>
      )}

      {busy && !hasOptions && order.length === 0 ? (
        <p className="loading-banner">Loading…</p>
      ) : (
        <>
          <LineupAlternatives
            alternatives={alternatives}
            selectedId={selectedAlternativeId}
            playersById={playersById}
            onSelect={selectAlternative}
            disabled={busy}
            customWeights={customWeights}
            onCustomWeightChange={setCustomWeight}
            onCompareCustom={generateWithCustom}
            canCompareCustom={canGenerate}
          />

          {(order.length > 0 || hasOptions) && (
            <section className="refine-section" aria-label="Refine selected lineup">
              <div className="refine-header">
                <h3>Refine selected lineup</h3>
                <p className="refine-hint">
                  Lock batters you want to keep, drag unlocked rows to override, then regenerate to
                  re-optimize around those locks.
                </p>
              </div>

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

              <div className="refine-layout">
                <div className="refine-lineup">
                  <h4 className="refine-col-label">Lineup &amp; locks</h4>
                  <BattingOrderList
                    players={players}
                    order={order}
                    locked={locked}
                    scoresByPlayerId={scoresByPlayerId}
                    onReorder={reorder}
                    onToggleLock={toggleLock}
                  />
                </div>
                <RosterStatusPanel players={players} order={order} locked={locked} />
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}

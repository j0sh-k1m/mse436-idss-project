import { useEffect, useMemo, useRef } from 'react'
import { useRoster } from '../hooks/useRoster'
import { useBattingOrder } from '../hooks/useBattingOrder'
import BattingOrderList from '../components/BattingOrderList'
import LineupAlternatives from '../components/LineupAlternatives'
import RosterStatusPanel from '../components/RosterStatusPanel'

const LINEUP_SIZE = 9
const ROSTER_SIG_KEY = 'lineupCoachRosterSig'

function rosterSignature(players) {
  return players
    .map(
      (p) =>
        `${p.id}:${p.ratings.contact}-${p.ratings.power}-${p.ratings.discipline}-${p.ratings.speed}`,
    )
    .sort()
    .join('|')
}

export default function BattingOrderPage() {
  const { players, loading: rosterLoading, error: rosterError } = useRoster()
  const {
    order,
    locked,
    explanationsByPlayerId,
    movesByPlayerId,
    alternatives,
    selectedAlternativeId,
    staleNotice,
    loading,
    error,
    customWeights,
    setCustomWeight,
    generate,
    generateWithCustom,
    selectAlternative,
    reorder,
    toggleLock,
    promoteFromBench,
    dismissStaleNotice,
    invalidateForRosterChange,
  } = useBattingOrder()

  const busy = rosterLoading || loading
  const canGenerate = players.length >= LINEUP_SIZE && !busy
  const playersById = new Map(players.map((p) => [p.id, p]))
  const hasOptions = alternatives.length > 0
  const rosterSig = useMemo(() => rosterSignature(players), [players])
  const prevRosterSig = useRef(null)

  // Wipe generated compare/chips when the roster changes after a generate.
  useEffect(() => {
    if (rosterLoading) return

    const saved = sessionStorage.getItem(ROSTER_SIG_KEY)

    if (prevRosterSig.current === null) {
      prevRosterSig.current = rosterSig
      if (saved && saved !== rosterSig) {
        sessionStorage.removeItem(ROSTER_SIG_KEY)
        invalidateForRosterChange()
      } else if (hasOptions) {
        sessionStorage.setItem(ROSTER_SIG_KEY, rosterSig)
      }
      return
    }

    if (prevRosterSig.current !== rosterSig) {
      const shouldInvalidate = hasOptions || Boolean(saved)
      prevRosterSig.current = rosterSig
      sessionStorage.removeItem(ROSTER_SIG_KEY)
      if (shouldInvalidate) invalidateForRosterChange()
      return
    }

    if (hasOptions) {
      sessionStorage.setItem(ROSTER_SIG_KEY, rosterSig)
    }
  }, [rosterSig, rosterLoading, hasOptions, invalidateForRosterChange])

  return (
    <section className="page batting-order-page">
      <header className="page-header">
        <div className="page-header-top">
          <div className="page-header-copy">
            <h2>Batting Order</h2>
            <p className="page-hint">
              Generate three strategy options, pick one, then lock slots or drag to override. Move
              badges and “Why” drivers show how each choice would change your lineup — and which
              trait drove each slot.
            </p>
          </div>
          <div className="page-header-actions">
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

      {!hasOptions && !staleNotice && !busy && players.length >= LINEUP_SIZE && (
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
            currentOrder={order}
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
                  re-optimize around those locks. Hover a “Why” badge for the ingredient mix behind
                  that slot.
                </p>
              </div>

              <div className="refine-layout">
                <div className="refine-lineup">
                  <h4 className="refine-col-label">Lineup &amp; locks</h4>
                  <BattingOrderList
                    players={players}
                    order={order}
                    locked={locked}
                    explanationsByPlayerId={explanationsByPlayerId}
                    movesByPlayerId={movesByPlayerId}
                    onReorder={reorder}
                    onToggleLock={toggleLock}
                  />
                </div>
                <RosterStatusPanel
                  players={players}
                  order={order}
                  locked={locked}
                  onPromoteFromBench={promoteFromBench}
                  busy={busy}
                />
              </div>
            </section>
          )}
        </>
      )}

      {staleNotice && (
        <div className="stale-toast" role="status">
          <p>{staleNotice}</p>
          <button
            type="button"
            className="dismiss-btn"
            onClick={dismissStaleNotice}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}
    </section>
  )
}

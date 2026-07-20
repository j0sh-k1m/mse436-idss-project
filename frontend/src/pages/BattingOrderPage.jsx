import { useRoster } from '../hooks/useRoster'
import { useBattingOrder } from '../hooks/useBattingOrder'
import BattingOrderList from '../components/BattingOrderList'
import { initials } from '../utils/initials'

const INGREDIENT_LABELS = {
  trad: 'Traditional fit',
  power: 'Power',
  speed: 'Speed',
  offense: 'Offense (PA share)',
}

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
    loading,
    error,
    presets,
    activePreset,
    weights,
    selectPreset,
    setWeight,
    generate,
    reorder,
    toggleLock,
    dismissChanges,
  } = useBattingOrder()

  const busy = rosterLoading || loading
  const canGenerate = players.length >= LINEUP_SIZE && !busy
  const playersById = new Map(players.map((p) => [p.id, p]))
  const presetNames = Object.keys(presets)
  const inLineup = new Set(order)
  const bench = players.filter((p) => !inLineup.has(p.id))

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
          Pick a strategy, lock any slots you want to keep, then generate. The model picks the best
          nine from your roster and benches the rest. Drag unlocked rows to override the suggestion.
        </p>
      </header>

      <section className="strategy-panel" aria-label="Lineup strategy">
        <h3>Strategy</h3>
        <div className="preset-row" role="group" aria-label="Strategy presets">
          {presetNames.map((name) => (
            <button
              key={name}
              type="button"
              className={`preset-btn${activePreset === name ? ' active' : ''}`}
              aria-pressed={activePreset === name}
              onClick={() => selectPreset(name)}
              disabled={busy}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="weight-sliders">
          {Object.keys(INGREDIENT_LABELS).map((key) => (
            <label className="weight-slider" key={key}>
              <span className="weight-label">
                {INGREDIENT_LABELS[key]}
                <span className="weight-value">{Number(weights[key] ?? 0).toFixed(1)}</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={weights[key] ?? 0}
                onChange={(e) => setWeight(key, Number(e.target.value))}
                disabled={busy}
              />
            </label>
          ))}
        </div>

        <div className="strategy-actions">
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
            Generate order
          </button>
          {players.length < LINEUP_SIZE && (
            <p className="strategy-guard">
              Need at least {LINEUP_SIZE} players on the roster to fill a batting order
              (currently {players.length}).
            </p>
          )}
        </div>
      </section>

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
        <>
          <BattingOrderList
            players={players}
            order={order}
            locked={locked}
            scoresByPlayerId={scoresByPlayerId}
            onReorder={reorder}
            onToggleLock={toggleLock}
          />

          {bench.length > 0 && (
            <section className="bench-panel" aria-label="Bench">
              <h3>Bench</h3>
              <p className="bench-hint">
                {order.length === LINEUP_SIZE
                  ? 'Not in the current batting order — regenerate to re-evaluate who starts.'
                  : 'Players not currently in a batting order.'}
              </p>
              <ul className="bench-list">
                {bench.map((player) => (
                  <li key={player.id} className="bench-chip">
                    <span className="chip-avatar">{initials(player.name)}</span>
                    <span className="chip-name">{player.name}</span>
                    <span className="stat-chip">
                      C{player.ratings.contact} P{player.ratings.power} D{player.ratings.discipline}{' '}
                      S{player.ratings.speed}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  )
}

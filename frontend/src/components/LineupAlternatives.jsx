import { useState } from 'react'
import { initials } from '../utils/initials'
import {
  explanationSummary,
  playerMoves,
} from '../utils/decisionViz'

const INGREDIENT_LABELS = {
  trad: 'Traditional fit',
  power: 'Power',
  speed: 'Speed',
  offense: 'Offense (PA share)',
}

function strategyPriority(weights = {}) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0)
  if (!entries.length) return null
  entries.sort((a, b) => b[1] - a[1])
  const [key] = entries[0]
  return INGREDIENT_LABELS[key]?.replace(' (PA share)', '') ?? key
}

function slotDiffCount(baselineOrder, order) {
  if (!baselineOrder?.length) return 0
  let n = 0
  for (let i = 0; i < order.length; i++) {
    if (order[i] !== baselineOrder[i]) n += 1
  }
  return n
}

function AlternativeCard({ alt, baseline, baselineLabel, selected, onSelect, disabled }) {
  const isBaseline = Boolean(baseline && (alt.id === baseline.id || selected))
  const diffs = !baseline || isBaseline ? 0 : slotDiffCount(baseline.order, alt.order)
  const moves = baseline && !isBaseline ? playerMoves(baseline.order, alt.order) : new Map()
  const priority = strategyPriority(alt.weights)

  return (
    <article
      role="listitem"
      className={`alternative-card${selected ? ' selected' : ''}`}
      aria-current={selected ? 'true' : undefined}
    >
      <header className="alternative-card-header">
        <h4 className="alternative-label">{alt.label}</h4>
      </header>

      {priority && (
        <p className="alternative-priority">
          Prioritizes <strong>{priority}</strong>
          {diffs > 0 ? ` · ${diffs} slot${diffs === 1 ? '' : 's'} differ from ${baselineLabel}` : null}
        </p>
      )}
      {!priority && diffs > 0 && (
        <p className="alternative-diff">
          {diffs} slot{diffs === 1 ? '' : 's'} differ from {baselineLabel}
        </p>
      )}

      <ol className="alternative-order">
        {alt.order.map((playerId, index) => {
          const player = alt._playersById?.get(playerId)
          const changed =
            !isBaseline && baseline?.order?.length > 0 && playerId !== baseline.order[index]
          const move = moves.get(playerId)
          const explanation = alt.explanations?.[index]
          const why = explanationSummary(explanation)
          return (
            <li
              key={`${alt.id}-${index}`}
              className={`alternative-slot${changed ? ' changed' : ''}`}
              title={why || undefined}
            >
              <span className="alternative-slot-num">{index + 1}</span>
              <span className="alternative-slot-avatar">{initials(player?.name ?? '?')}</span>
              <span className="alternative-slot-body">
                <span className="alternative-slot-name">{player?.name ?? playerId}</span>
                {(move || explanation?.topLabel) && (
                  <span className="alternative-slot-meta">
                    {move && <span className={`move-badge move-${move.kind}`}>{move.label}</span>}
                    {explanation?.topLabel && (
                      <span className="driver-badge-sm">{explanation.topLabel}</span>
                    )}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>

      {alt.bench?.length > 0 && (
        <p className="alternative-bench">
          Bench:{' '}
          {alt.bench.map((id) => alt._playersById?.get(id)?.name ?? id).join(', ')}
        </p>
      )}

      <button
        type="button"
        className={selected ? 'btn-secondary' : 'btn-primary'}
        onClick={() => onSelect(alt)}
        disabled={disabled || selected}
        title={
          diffs > 0
            ? `Choosing ${alt.label} changes ${diffs} batting slot${diffs === 1 ? '' : 's'} vs ${baselineLabel}`
            : undefined
        }
      >
        {selected ? 'Selected' : 'Use this lineup'}
      </button>
    </article>
  )
}

export default function LineupAlternatives({
  alternatives,
  selectedId,
  currentOrder = [],
  playersById,
  onSelect,
  disabled = false,
  customWeights,
  onCustomWeightChange,
  onCompareCustom,
  canCompareCustom = true,
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false)

  if (!alternatives?.length) return null

  const selectedAlt = alternatives.find((a) => a.id === selectedId) ?? null
  const baseline = selectedAlt
    ? selectedAlt
    : currentOrder.length > 0
      ? { id: '__current__', order: currentOrder, label: 'current lineup' }
      : null
  const baselineLabel = baseline?.label ?? 'current lineup'
  const enriched = alternatives.map((alt) => ({ ...alt, _playersById: playersById }))

  return (
    <section className="alternatives-panel" aria-label="Compare lineup options">
      <div className="alternatives-header">
        <h3>Compare options</h3>
        <p className="alternatives-hint">
          Each strategy prioritizes different traits — hover a batter to see which ingredient drove
          their slot. Move badges show how a choice would change the order vs your{' '}
          {selectedAlt ? 'current selection' : 'current lineup'}. Pick one with{' '}
          <strong>Use this lineup</strong> to apply it.
        </p>
      </div>

      <div className="alternatives-grid" role="list">
        {enriched.map((alt) => (
          <AlternativeCard
            key={alt.id}
            alt={alt}
            baseline={baseline}
            baselineLabel={baselineLabel}
            selected={alt.id === selectedId}
            onSelect={onSelect}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="customize-panel">
        <button
          type="button"
          className={`customize-toggle${customizeOpen ? ' open' : ''}`}
          aria-expanded={customizeOpen}
          onClick={() => setCustomizeOpen((open) => !open)}
        >
          <span>{customizeOpen ? 'Hide customize' : 'Customize your own'}</span>
          <span className="customize-toggle-hint">Mix weights and compare as a 4th option</span>
        </button>

        {customizeOpen && (
          <div className="customize-body">
            <div className="weight-sliders">
              {Object.keys(INGREDIENT_LABELS).map((key) => (
                <label className="weight-slider" key={key}>
                  <span className="weight-label">
                    {INGREDIENT_LABELS[key]}
                    <span className="weight-value">
                      {Number(customWeights[key] ?? 0).toFixed(1)}
                    </span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={customWeights[key] ?? 0}
                    onChange={(e) => onCustomWeightChange(key, Number(e.target.value))}
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>
            <div className="customize-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={onCompareCustom}
                disabled={disabled || !canCompareCustom}
              >
                Compare custom lineup
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

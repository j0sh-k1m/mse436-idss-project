import { useState } from 'react'
import { initials } from '../utils/initials'

const INGREDIENT_LABELS = {
  trad: 'Traditional fit',
  power: 'Power',
  speed: 'Speed',
  offense: 'Offense (PA share)',
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
  const diffs = alt.id === baseline?.id || !baseline ? 0 : slotDiffCount(baseline.order, alt.order)

  return (
    <article
      role="listitem"
      className={`alternative-card${selected ? ' selected' : ''}`}
      aria-current={selected ? 'true' : undefined}
    >
      <header className="alternative-card-header">
        <h4 className="alternative-label">{alt.label}</h4>
        <p className="alternative-score">
          <span className="alternative-score-value">{alt.overallScore}</span>
          <span className="alternative-score-unit">/100</span>
        </p>
      </header>

      {diffs > 0 && (
        <p className="alternative-diff">
          {diffs} slot{diffs === 1 ? '' : 's'} differ from {baselineLabel}
        </p>
      )}

      <ol className="alternative-order">
        {alt.order.map((playerId, index) => {
          const player = alt._playersById?.get(playerId)
          const changed = baseline?.order?.length > 0 && playerId !== baseline.order[index]
          return (
            <li
              key={`${alt.id}-${index}`}
              className={`alternative-slot${changed ? ' changed' : ''}`}
            >
              <span className="alternative-slot-num">{index + 1}</span>
              <span className="alternative-slot-avatar">{initials(player?.name ?? '?')}</span>
              <span className="alternative-slot-name">{player?.name ?? playerId}</span>
              <span className="alternative-slot-score">{alt.scores[index]}</span>
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
      >
        {selected ? 'Selected' : 'Use this lineup'}
      </button>
    </article>
  )
}

export default function LineupAlternatives({
  alternatives,
  selectedId,
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

  const baseline = alternatives.find((a) => a.preset === 'Balanced') ?? alternatives[0]
  const enriched = alternatives.map((alt) => ({ ...alt, _playersById: playersById }))

  return (
    <section className="alternatives-panel" aria-label="Compare lineup options">
      <div className="alternatives-header">
        <h3>Compare options</h3>
        <p className="alternatives-hint">
          Three strategy lineups side by side. Open Customize to add your own mix and compare it
          against these.
        </p>
      </div>

      <div className="alternatives-grid" role="list">
        {enriched.map((alt) => (
          <AlternativeCard
            key={alt.id}
            alt={alt}
            baseline={baseline}
            baselineLabel={baseline.label}
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

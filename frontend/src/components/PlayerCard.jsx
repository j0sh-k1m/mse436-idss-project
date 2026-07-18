import { initials } from '../utils/initials'

const RATING_FIELDS = [
  { key: 'hitting', label: 'HIT' },
  { key: 'fielding', label: 'FLD' },
  { key: 'throwing', label: 'THR' },
  { key: 'speed', label: 'SPD' },
]

export default function PlayerCard({ player, actions }) {
  const { name, ratings } = player

  return (
    <div className="player-card">
      <div className="player-card-header">
        <div className="player-avatar" aria-hidden="true">
          {initials(name)}
        </div>
        <span className="player-name">{name}</span>
      </div>

      <dl className="player-ratings">
        {RATING_FIELDS.map(({ key, label }) => (
          <div className="rating-row" key={key}>
            <dt>{label}</dt>
            <dd>
              <span className="rating-value">{ratings[key]}</span>
              <span className="rating-meter" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={i < ratings[key] ? 'bar filled' : 'bar'} />
                ))}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {actions}
    </div>
  )
}

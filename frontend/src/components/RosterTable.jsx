import { useState } from 'react'
import PlayerCard from './PlayerCard'

const RATING_KEYS = ['hitting', 'fielding', 'throwing', 'speed']
const RATING_OPTIONS = [1, 2, 3, 4, 5]
const EMPTY_FORM = { name: '', hitting: 3, fielding: 3, throwing: 3, speed: 3 }

export default function RosterTable({ players, onAdd, onRemove, busy }) {
  const [form, setForm] = useState(EMPTY_FORM)

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: field === 'name' ? value : Number(value) }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    onAdd({
      name: form.name.trim(),
      ratings: {
        hitting: form.hitting,
        fielding: form.fielding,
        throwing: form.throwing,
        speed: form.speed,
      },
    })
    setForm(EMPTY_FORM)
  }

  return (
    <div className="roster-table">
      <div className="roster-grid">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            actions={
              <button
                type="button"
                className="remove-player-btn"
                onClick={() => onRemove(player.id)}
                disabled={busy}
              >
                Remove
              </button>
            }
          />
        ))}
      </div>

      <form className="add-player-form" onSubmit={handleSubmit}>
        <h3>Add Player</h3>
        <div className="add-player-fields">
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Player name"
              required
            />
          </label>
          {RATING_KEYS.map((key) => (
            <label className="field" key={key}>
              <span>{key}</span>
              <select value={form[key]} onChange={(e) => handleChange(key, e.target.value)}>
                {RATING_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          Add Player
        </button>
      </form>
    </div>
  )
}

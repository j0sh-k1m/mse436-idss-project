import { useRoster } from '../hooks/useRoster'
import RosterTable from '../components/RosterTable'

export default function RosterPage() {
  const { players, loading, error, addPlayer, removePlayer } = useRoster()

  return (
    <section className="page roster-page">
      <header className="page-header">
        <h2>Roster</h2>
        <p className="page-hint">
          Add and manage the players available for lineups. Ratings are on a 1-5 scale. Rosters can
          be larger than nine — the batting-order model picks the best nine and benches the rest.
        </p>
      </header>

      {error && <p className="error-banner">{error}</p>}

      {loading && players.length === 0 ? (
        <p className="loading-banner">Loading roster…</p>
      ) : (
        <RosterTable players={players} onAdd={addPlayer} onRemove={removePlayer} busy={loading} />
      )}
    </section>
  )
}

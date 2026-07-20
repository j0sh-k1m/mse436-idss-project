# API reference

Base URL (local default): `http://127.0.0.1:8001`

All mutating roster / lineup changes are persisted to `backend/data/app_state.json`.

## Health

### `GET /health`

```json
{ "status": "ok" }
```

## Roster

Player shape:

```json
{
  "id": "p1",
  "name": "Jordan Ruiz",
  "ratings": {
    "contact": 4,
    "power": 3,
    "discipline": 4,
    "speed": 5
  }
}
```

Ratings are integers 1–5.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/roster` | List all players |
| `POST` | `/roster` | Add a player (`name` + `ratings`); returns the created player (201) |
| `PATCH` | `/roster/{id}` | Partial ratings update |
| `DELETE` | `/roster/{id}` | Remove a player; returns `true` |

## Batting order

Response shape:

```json
{
  "order": ["p7", "p1", "..."],
  "locked": [{ "slot": 0, "playerId": "p7" }],
  "scores": [72, 65, 58, 60, 55, 48, 44, 40, 38],
  "overallScore": 53,
  "bench": ["p8", "p10"]
}
```

- `order` — nine player ids in batting-slot order (index 0 = leadoff).
- `scores[i]` — 0–100 score for `order[i]`.
- `locked` — 0-based `{ slot, playerId }` pairs the coach pinned.
- `bench` — roster players who did not make the starting nine.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/batting-order` | Last generated (or seeded) lineup state |
| `POST` | `/batting-order` | Generate a new order |

### `POST /batting-order` body

```json
{
  "locked": [{ "slot": 0, "playerId": "p3" }],
  "preset": "Aggressive"
}
```

Or custom weights instead of a preset:

```json
{
  "locked": [],
  "weights": { "trad": 0.4, "power": 0.0, "speed": 1.0, "offense": 0.3 }
}
```

- If neither `weights` nor `preset` is sent, the server uses **Balanced**.
- Requires **at least nine** players on the roster (409 otherwise).
- Unknown presets / ingredients or conflicting locks → 422.

## Presets

### `GET /presets`

Returns the weight vectors stored in `slot_scoring.json`, e.g. Balanced, Aggressive, Small-ball, Max offense.

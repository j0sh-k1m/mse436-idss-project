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

Response shape (GET / working state):

```json
{
  "order": ["p7", "p1", "..."],
  "locked": [{ "slot": 0, "playerId": "p7" }],
  "scores": [72, 65, 58, 60, 55, 48, 44, 40, 38],
  "overallScore": 53,
  "bench": ["p8", "p10"],
  "explanations": [
    {
      "topIngredient": "speed",
      "topLabel": "Speed",
      "contributions": { "trad": 35, "speed": 45, "offense": 20 }
    }
  ]
}
```

- `order` — nine player ids in batting-slot order (index 0 = leadoff).
- `scores[i]` — 0–100 score for `order[i]`.
- `explanations[i]` — which strategy ingredient most drove placing `order[i]` in that slot (plus contribution shares).
- `locked` — 0-based `{ slot, playerId }` pairs the coach pinned.
- `bench` — roster players who did not make the starting nine.

`POST /batting-order` returns the same fields plus `alternatives`: always the fixed compare presets **Balanced**, **Small-ball**, and **Max offense**. When `customWeights` is sent, a **Custom** alternative is included as well. Duplicate preset orders are dropped; Custom is kept even if it matches a preset.

```json
{
  "order": ["p7", "p1", "..."],
  "locked": [],
  "scores": [72, 65, 58, 60, 55, 48, 44, 40, 38],
  "overallScore": 53,
  "bench": ["p8"],
  "alternatives": [
    {
      "id": "alt-0",
      "label": "Balanced",
      "preset": "Balanced",
      "weights": { "trad": 1.0, "power": 0.0, "speed": 0.0, "offense": 0.3 },
      "order": ["p7", "p1", "..."],
      "scores": [72, 65, 58, 60, 55, 48, 44, 40, 38],
      "overallScore": 53,
      "bench": ["p8"],
      "locked": []
    }
  ]
}
```

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/batting-order` | Last generated (or seeded) lineup state |
| `POST` | `/batting-order` | Generate compare options (+ optional Custom) |
| `POST` | `/batting-order/select` | Commit one alternative as the working order |

### `POST /batting-order` body

```json
{
  "locked": [{ "slot": 0, "playerId": "p3" }]
}
```

Optional custom strategy:

```json
{
  "locked": [],
  "customWeights": { "trad": 0.4, "power": 0.0, "speed": 1.0, "offense": 0.3 }
}
```

- Without `customWeights`, returns the three fixed presets; working state is set to **Balanced**.
- With `customWeights`, also returns **Custom** and sets the working state to that lineup.
- Requires **at least nine** players on the roster (409 otherwise).
- Unknown ingredients or conflicting locks → 422.

### `POST /batting-order/select` body

```json
{
  "order": ["p7", "p1", "..."],
  "scores": [72, 65, 58, 60, 55, 48, 44, 40, 38],
  "overallScore": 53,
  "bench": ["p8"],
  "locked": []
}
```

Validates that the nine players (and any locks) exist on the roster, then persists that lineup as the working state.

## Presets

### `GET /presets`

Returns the weight vectors stored in `slot_scoring.json` (including Aggressive, which is not used in the compare UI).

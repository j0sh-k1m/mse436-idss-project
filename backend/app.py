"""Backend API entry point.

FastAPI app the React frontend calls to submit player data and receive
optimized batting orders. This module handles API concerns (request
validation, CORS) and delegates all decision logic to modules in ``model``.

Response shapes intentionally mirror ``frontend/src/api/mockApi.js`` so the
frontend hooks work unchanged once they switch from the mock to ``fetch``:

- players are ``{id, name, ratings: {contact, power, discipline, speed}}``
- batting order state is ``{order, locked, scores, overallScore, bench}`` where
  ``order`` is the starting nine by slot, ``scores[i]`` scores ``order[i]``,
  ``locked`` entries are ``{slot, playerId}`` with 0-based slots, and ``bench``
  lists roster players who did not make the lineup.
- ``POST /batting-order`` also returns ``alternatives``: the fixed compare
  presets (Balanced, Small-ball, Max offense) plus an optional Custom lineup.

Roster and batting-order state persist to ``data/app_state.json`` so they
survive server restarts.

Run locally with:

    uvicorn app:app --reload --port 8001
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import store
from model.batting_order import (
    N_SLOTS,
    PRESETS,
    recommend_order,
    score_lineup,
    select_starters,
    starter_values,
)
from model.ratings import roster_to_features

app = FastAPI(title="Softball Lineup Coach API")

# The Vite dev server runs on port 5173 by default.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class Ratings(BaseModel):
    contact: int = Field(ge=1, le=5)
    power: int = Field(ge=1, le=5)
    discipline: int = Field(ge=1, le=5)
    speed: int = Field(ge=1, le=5)


class RatingsUpdate(BaseModel):
    contact: int | None = Field(default=None, ge=1, le=5)
    power: int | None = Field(default=None, ge=1, le=5)
    discipline: int | None = Field(default=None, ge=1, le=5)
    speed: int | None = Field(default=None, ge=1, le=5)


class PlayerIn(BaseModel):
    name: str = Field(min_length=1)
    ratings: Ratings


class Player(BaseModel):
    id: str
    name: str
    ratings: Ratings


class LockEntry(BaseModel):
    slot: int = Field(ge=0, le=N_SLOTS - 1)  # 0-based, matching the frontend
    playerId: str


class GenerateRequest(BaseModel):
    locked: list[LockEntry] = []
    # Optional custom ingredient weights; when set, a "Custom" alternative is
    # included alongside the fixed compare presets.
    customWeights: dict[str, float] | None = None


class BattingOrderState(BaseModel):
    order: list[str]
    locked: list[LockEntry]
    scores: list[int]
    overallScore: int
    # Players on the roster who did not make the starting nine.
    bench: list[str] = []


class LineupAlternative(BaseModel):
    """One candidate lineup for the coach to compare and choose among."""

    id: str
    label: str
    preset: str | None = None
    weights: dict[str, float]
    order: list[str]
    scores: list[int]
    overallScore: int
    bench: list[str] = []
    locked: list[LockEntry] = []


class GenerateResponse(BattingOrderState):
    """Primary lineup plus alternative strategies for side-by-side comparison."""

    alternatives: list[LineupAlternative] = []


class SelectRequest(BaseModel):
    """Commit one of the generated alternatives as the working batting order."""

    order: list[str]
    scores: list[int]
    overallScore: int
    bench: list[str] = []
    locked: list[LockEntry] = []


# --------------------------------------------------------------------------
# Store (JSON-backed; seeded on first run)
# --------------------------------------------------------------------------

_INGREDIENTS = {"trad", "power", "speed", "offense"}
DEFAULT_PRESET = "Balanced"
# Fixed strategies shown for comparison (Aggressive is intentionally omitted).
COMPARE_PRESETS = ("Balanced", "Small-ball", "Max offense")

DEFAULT_ROSTER = [
    ("Jordan Ruiz", dict(contact=4, power=3, discipline=4, speed=5)),
    ("Sam Ito", dict(contact=3, power=5, discipline=4, speed=3)),
    ("Casey Boone", dict(contact=5, power=2, discipline=3, speed=4)),
    ("Riley Marsh", dict(contact=2, power=4, discipline=5, speed=2)),
    ("Avery Quinn", dict(contact=4, power=4, discipline=3, speed=4)),
    ("Morgan Diaz", dict(contact=3, power=3, discipline=3, speed=3)),
    ("Taylor Nguyen", dict(contact=5, power=4, discipline=4, speed=5)),
    ("Drew Falk", dict(contact=2, power=5, discipline=5, speed=2)),
    ("Emerson Cole", dict(contact=3, power=2, discipline=2, speed=5)),
    ("Parker Voss", dict(contact=4, power=3, discipline=4, speed=3)),
]

EMPTY_STATE = BattingOrderState(order=[], locked=[], scores=[], overallScore=0, bench=[])

players: list[Player] = []
next_player_number = 1
batting_order_state: BattingOrderState = EMPTY_STATE


def persist() -> None:
    store.save({
        "players": [p.model_dump() for p in players],
        "next_player_number": next_player_number,
        "batting_order": batting_order_state.model_dump(),
    })


def find_player(player_id: str) -> Player:
    for p in players:
        if p.id == player_id:
            return p
    raise HTTPException(status_code=404, detail=f"Player {player_id} not found")


def resolve_custom_weights(weights: dict[str, float]) -> dict[str, float]:
    unknown = set(weights) - _INGREDIENTS
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown ingredients: {sorted(unknown)}")
    if all(w == 0 for w in weights.values()):
        raise HTTPException(status_code=422, detail="At least one weight must be non-zero")
    return weights


def build_alternatives(
    locked: list[LockEntry],
    custom_weights: dict[str, float] | None = None,
) -> list[LineupAlternative]:
    """Build the fixed compare presets, plus an optional Custom lineup.

    Duplicate orders (same nine in the same slots) are dropped so the coach
    only compares meaningfully different options.
    """
    strategies: list[tuple[str, str | None, dict[str, float]]] = []
    for name in COMPARE_PRESETS:
        if name not in PRESETS:
            raise HTTPException(status_code=500, detail=f"Missing compare preset: {name}")
        strategies.append((name, name, PRESETS[name]))

    if custom_weights is not None:
        strategies.append(("Custom", None, custom_weights))

    alternatives: list[LineupAlternative] = []
    seen_orders: set[tuple[str, ...]] = set()
    for i, (label, preset, weights) in enumerate(strategies):
        state = generate_state(locked, weights)
        key = tuple(state.order)
        if key in seen_orders and label != "Custom":
            continue
        seen_orders.add(key)
        alternatives.append(
            LineupAlternative(
                id=f"alt-{i}",
                label=label,
                preset=preset,
                weights=weights,
                order=state.order,
                scores=state.scores,
                overallScore=state.overallScore,
                bench=state.bench,
                locked=list(state.locked),
            )
        )
    return alternatives


def generate_state(locked: list[LockEntry], weights: dict[str, float]) -> BattingOrderState:
    if len(players) < N_SLOTS:
        raise HTTPException(
            status_code=409,
            detail=f"Batting order needs at least {N_SLOTS} players; roster has {len(players)}",
        )

    index_by_id = {p.id: i for i, p in enumerate(players)}
    locked_roster_indices: list[int] = []
    seen_slots: set[int] = set()
    seen_players: set[str] = set()
    for entry in locked:
        if entry.playerId not in index_by_id:
            raise HTTPException(status_code=422, detail=f"Locked player {entry.playerId} not on roster")
        if entry.slot in seen_slots:
            raise HTTPException(status_code=422, detail=f"Slot {entry.slot} locked twice")
        if entry.playerId in seen_players:
            raise HTTPException(status_code=422, detail=f"Player {entry.playerId} locked twice")
        seen_slots.add(entry.slot)
        seen_players.add(entry.playerId)
        locked_roster_indices.append(index_by_id[entry.playerId])

    if len(locked_roster_indices) > N_SLOTS:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot lock more than {N_SLOTS} players into the batting order",
        )

    # Evaluate the whole roster, keep the best nine (locks always make the cut),
    # then run the 9-slot assignment only on that starting group.
    all_features = roster_to_features([p.ratings.model_dump() for p in players])
    values = starter_values(all_features, weights)
    starter_idxs = select_starters(
        len(players), values, n_slots=N_SLOTS, must_include=locked_roster_indices
    )
    starters = [players[i] for i in starter_idxs]
    features = all_features[starter_idxs]

    starter_id_to_row = {p.id: i for i, p in enumerate(starters)}
    locks = {starter_id_to_row[entry.playerId]: entry.slot + 1 for entry in locked}

    slots, matrix = recommend_order(features, weights, locks or None)
    scores, overall = score_lineup(matrix, slots, weights)

    order = [""] * N_SLOTS
    for p_idx, slot in enumerate(slots):
        order[slot - 1] = starters[p_idx].id

    starter_ids = set(order)
    bench = [p.id for p in players if p.id not in starter_ids]

    return BattingOrderState(
        order=order,
        locked=locked,
        scores=scores,
        overallScore=overall,
        bench=bench,
    )


def prune_player_references(player_id: str) -> None:
    """Drop locks that point at a removed player and refresh the stored state."""
    global batting_order_state
    remaining = [l for l in batting_order_state.locked if l.playerId != player_id]
    if len(players) >= N_SLOTS:
        batting_order_state = generate_state(remaining, PRESETS[DEFAULT_PRESET])
    else:
        batting_order_state = EMPTY_STATE


def bootstrap() -> None:
    """Load saved state, or seed the demo roster and a Balanced lineup."""
    global players, next_player_number, batting_order_state

    saved = store.load()
    if saved and isinstance(saved.get("players"), list):
        players = [Player.model_validate(p) for p in saved["players"]]
        next_player_number = int(saved.get("next_player_number", len(players) + 1))
        raw_order = saved.get("batting_order")
        if raw_order:
            batting_order_state = BattingOrderState.model_validate(raw_order)
        elif len(players) >= N_SLOTS:
            batting_order_state = generate_state([], PRESETS[DEFAULT_PRESET])
        else:
            batting_order_state = EMPTY_STATE
        return

    players = [
        Player(id=f"p{i + 1}", name=name, ratings=Ratings(**r))
        for i, (name, r) in enumerate(DEFAULT_ROSTER)
    ]
    next_player_number = len(players) + 1
    batting_order_state = generate_state([], PRESETS[DEFAULT_PRESET])
    persist()


bootstrap()


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/roster")
def get_roster() -> list[Player]:
    return players


@app.post("/roster", status_code=201)
def add_player(player: PlayerIn) -> Player:
    global next_player_number
    created = Player(id=f"p{next_player_number}", name=player.name.strip(), ratings=player.ratings)
    next_player_number += 1
    players.append(created)
    persist()
    return created


@app.patch("/roster/{player_id}")
def update_player(player_id: str, ratings: RatingsUpdate) -> Player:
    player = find_player(player_id)
    updates = {k: v for k, v in ratings.model_dump().items() if v is not None}
    player.ratings = player.ratings.model_copy(update=updates)
    persist()
    return player


@app.delete("/roster/{player_id}")
def remove_player(player_id: str) -> bool:
    global players
    find_player(player_id)
    players = [p for p in players if p.id != player_id]
    prune_player_references(player_id)
    persist()
    return True


@app.get("/batting-order")
def get_batting_order() -> BattingOrderState:
    return batting_order_state


@app.post("/batting-order")
def generate_batting_order(req: GenerateRequest) -> GenerateResponse:
    """Generate the fixed compare presets (and optional Custom) for the coach.

    Persists the Balanced lineup as the working order; the coach can select a
    different alternative via ``POST /batting-order/select``.
    """
    global batting_order_state
    custom = resolve_custom_weights(req.customWeights) if req.customWeights is not None else None
    alternatives = build_alternatives(req.locked, custom)
    if not alternatives:
        raise HTTPException(status_code=500, detail="No lineup alternatives produced")

    primary = next((a for a in alternatives if a.label == "Custom"), None)
    if primary is None:
        primary = next((a for a in alternatives if a.preset == DEFAULT_PRESET), alternatives[0])
    batting_order_state = BattingOrderState(
        order=primary.order,
        locked=list(primary.locked),
        scores=primary.scores,
        overallScore=primary.overallScore,
        bench=primary.bench,
    )
    persist()
    return GenerateResponse(**batting_order_state.model_dump(), alternatives=alternatives)


@app.post("/batting-order/select")
def select_batting_order(req: SelectRequest) -> BattingOrderState:
    """Commit a compared alternative as the working batting order."""
    global batting_order_state

    if len(req.order) != N_SLOTS:
        raise HTTPException(
            status_code=422,
            detail=f"Order must have exactly {N_SLOTS} players; got {len(req.order)}",
        )
    if len(req.scores) != N_SLOTS:
        raise HTTPException(
            status_code=422,
            detail=f"Scores must have exactly {N_SLOTS} values; got {len(req.scores)}",
        )
    if len(set(req.order)) != N_SLOTS:
        raise HTTPException(status_code=422, detail="Order contains duplicate players")

    roster_ids = {p.id for p in players}
    unknown = [pid for pid in req.order if pid not in roster_ids]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown players in order: {unknown}")
    unknown_bench = [pid for pid in req.bench if pid not in roster_ids]
    if unknown_bench:
        raise HTTPException(status_code=422, detail=f"Unknown players on bench: {unknown_bench}")

    for entry in req.locked:
        if entry.playerId not in roster_ids:
            raise HTTPException(
                status_code=422, detail=f"Locked player {entry.playerId} not on roster"
            )
        if entry.playerId not in req.order or req.order[entry.slot] != entry.playerId:
            raise HTTPException(
                status_code=422,
                detail=f"Lock for {entry.playerId} does not match order slot {entry.slot}",
            )

    batting_order_state = BattingOrderState(
        order=req.order,
        locked=req.locked,
        scores=req.scores,
        overallScore=req.overallScore,
        bench=req.bench,
    )
    persist()
    return batting_order_state


@app.get("/presets")
def get_presets() -> dict[str, dict[str, float]]:
    return PRESETS

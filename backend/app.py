"""Backend API entry point.

FastAPI app the React frontend calls to submit player data and receive
optimized batting orders. This module handles API concerns (request
validation, CORS) and delegates all decision logic to modules in ``model``.

Response shapes intentionally mirror ``frontend/src/api/mockApi.js`` so the
frontend hooks work unchanged once they switch from the mock to ``fetch``:

- players are ``{id, name, ratings: {contact, power, discipline, speed}}``
- batting order state is ``{order, locked, scores, overallScore}`` where
  ``order`` is player ids by slot, ``scores[i]`` scores ``order[i]``, and
  ``locked`` entries are ``{slot, playerId}`` with 0-based slots.

Run locally with:

    uvicorn app:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model.batting_order import N_SLOTS, PRESETS, recommend_order, score_lineup
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
    # Slider weights over the model ingredients; defaults to the Balanced
    # preset when neither weights nor preset is given.
    weights: dict[str, float] | None = None
    preset: str | None = None


class BattingOrderState(BaseModel):
    order: list[str]
    locked: list[LockEntry]
    scores: list[int]
    overallScore: int


# --------------------------------------------------------------------------
# In-memory store (persistence arrives in a later phase)
# --------------------------------------------------------------------------

_INGREDIENTS = {"trad", "power", "speed", "offense"}
DEFAULT_PRESET = "Balanced"

players: list[Player] = [
    Player(id=f"p{i + 1}", name=name, ratings=Ratings(**r))
    for i, (name, r) in enumerate([
        ("Jordan Ruiz", dict(contact=4, power=3, discipline=4, speed=5)),
        ("Sam Ito", dict(contact=3, power=5, discipline=4, speed=3)),
        ("Casey Boone", dict(contact=5, power=2, discipline=3, speed=4)),
        ("Riley Marsh", dict(contact=2, power=4, discipline=5, speed=2)),
        ("Avery Quinn", dict(contact=4, power=4, discipline=3, speed=4)),
        ("Morgan Diaz", dict(contact=3, power=3, discipline=3, speed=3)),
        ("Taylor Nguyen", dict(contact=5, power=4, discipline=4, speed=5)),
        ("Drew Falk", dict(contact=2, power=5, discipline=5, speed=2)),
        ("Emerson Cole", dict(contact=3, power=2, discipline=2, speed=5)),
    ])
]
next_player_number = len(players) + 1

EMPTY_STATE = BattingOrderState(order=[], locked=[], scores=[], overallScore=0)


def find_player(player_id: str) -> Player:
    for p in players:
        if p.id == player_id:
            return p
    raise HTTPException(status_code=404, detail=f"Player {player_id} not found")


def resolve_weights(req: GenerateRequest) -> dict[str, float]:
    if req.weights is not None:
        unknown = set(req.weights) - _INGREDIENTS
        if unknown:
            raise HTTPException(status_code=422, detail=f"Unknown ingredients: {sorted(unknown)}")
        if all(w == 0 for w in req.weights.values()):
            raise HTTPException(status_code=422, detail="At least one weight must be non-zero")
        return req.weights
    preset = req.preset or DEFAULT_PRESET
    if preset not in PRESETS:
        raise HTTPException(status_code=422, detail=f"Unknown preset: {preset}")
    return PRESETS[preset]


def generate_state(locked: list[LockEntry], weights: dict[str, float]) -> BattingOrderState:
    if len(players) != N_SLOTS:
        raise HTTPException(
            status_code=409,
            detail=f"Batting order needs exactly {N_SLOTS} players; roster has {len(players)}",
        )

    index_by_id = {p.id: i for i, p in enumerate(players)}
    locks: dict[int, int] = {}
    seen_slots: set[int] = set()
    for entry in locked:
        if entry.playerId not in index_by_id:
            raise HTTPException(status_code=422, detail=f"Locked player {entry.playerId} not on roster")
        if entry.slot in seen_slots:
            raise HTTPException(status_code=422, detail=f"Slot {entry.slot} locked twice")
        seen_slots.add(entry.slot)
        p_idx = index_by_id[entry.playerId]
        if p_idx in locks:
            raise HTTPException(status_code=422, detail=f"Player {entry.playerId} locked twice")
        locks[p_idx] = entry.slot + 1  # model slots are 1-based

    features = roster_to_features([p.ratings.model_dump() for p in players])
    slots, matrix = recommend_order(features, weights, locks or None)
    scores, overall = score_lineup(matrix, slots, weights)

    order = [""] * N_SLOTS
    for p_idx, slot in enumerate(slots):
        order[slot - 1] = players[p_idx].id

    return BattingOrderState(order=order, locked=locked, scores=scores, overallScore=overall)


def prune_player_references(player_id: str) -> None:
    """Drop locks that point at a removed player and refresh the stored state."""
    global batting_order_state
    remaining = [l for l in batting_order_state.locked if l.playerId != player_id]
    if len(players) == N_SLOTS:
        batting_order_state = generate_state(remaining, PRESETS[DEFAULT_PRESET])
    else:
        batting_order_state = EMPTY_STATE


# Like the mock, serve a freshly generated Balanced lineup on first load.
batting_order_state: BattingOrderState = generate_state([], PRESETS[DEFAULT_PRESET])


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
    return created


@app.patch("/roster/{player_id}")
def update_player(player_id: str, ratings: RatingsUpdate) -> Player:
    player = find_player(player_id)
    updates = {k: v for k, v in ratings.model_dump().items() if v is not None}
    player.ratings = player.ratings.model_copy(update=updates)
    return player


@app.delete("/roster/{player_id}")
def remove_player(player_id: str) -> bool:
    global players
    find_player(player_id)
    players = [p for p in players if p.id != player_id]
    prune_player_references(player_id)
    return True


@app.get("/batting-order")
def get_batting_order() -> BattingOrderState:
    return batting_order_state


@app.post("/batting-order")
def generate_batting_order(req: GenerateRequest) -> BattingOrderState:
    global batting_order_state
    weights = resolve_weights(req)
    batting_order_state = generate_state(req.locked, weights)
    return batting_order_state


@app.get("/presets")
def get_presets() -> dict[str, dict[str, float]]:
    return PRESETS

# Process: from coach input to recommended batting order

This document traces the full pipeline of the Lineup Coach IDSS, end to end:
how the scoring model is trained offline, how a coach's input travels through
the backend, and how a recommended batting order comes back out. It also
flags a few rough edges found while validating the flow.

Source of truth for all of this is `origin/main` (commits through
`de9df7e — Added persistence`). Note: as of writing, the local `Ronald`
branch is a few commits behind `main` and does not yet contain
`backend/app.py`, `backend/store.py`, or the frontend's real API wiring —
merge `main` in before running the app locally.

## High-level flow

```
 OFFLINE (once, in notebooks/)
 ┌─────────────────────────────────────────────────────────────┐
 │ batting.csv (real MLB data)                                  │
 │   -> notebooks/exploration.ipynb        (do slots have       │
 │        distinct, learnable skill profiles? — yes)            │
 │   -> notebooks/slot_scoring_model.ipynb (learn scaler,        │
 │        slot prototypes, demand vectors; export params)       │
 │   -> backend/data/processed/slot_scoring.json                │
 └─────────────────────────────────────────────────────────────┘
                              │  (frozen params, loaded once)
                              ▼
 ONLINE (every request, in backend/ + frontend/)
 ┌─────────────────────────────────────────────────────────────┐
 │ Coach enters/edits players in the UI                         │
 │   RosterTable.jsx  -> POST/PATCH/DELETE /roster              │
 │   app.py stores Player{id, name, ratings} -> store.py (JSON) │
 │                                                                │
 │ Coach picks a strategy and clicks "Generate order"            │
 │   BattingOrderPage.jsx -> POST /batting-order                │
 │     { locked, weights? or preset? }                           │
 │                                                                │
 │ app.py: resolve_weights() -> roster_to_features()             │
 │   (ratings.py: 1-5 ratings -> 6 raw MLB-style stats)          │
 │        -> recommend_order() (batting_order.py)                │
 │   (ingredient_matrices -> blended M -> Hungarian assignment)  │
 │        -> score_lineup() (M -> 0-100 display scores)          │
 │                                                                │
 │ Response: { order, locked, scores, overallScore }             │
 │   -> BattingOrderList.jsx renders slots, scores, drag, locks  │
 └─────────────────────────────────────────────────────────────┘
```

---

## Stage 1 — Offline: learning what each slot "looks like"

**Files:** `notebooks/exploration.ipynb`, `notebooks/slot_scoring_model.ipynb`
→ output `backend/data/processed/slot_scoring.json`

1. `exploration.ipynb` establishes *whether* this is even a learnable
   problem: it aggregates real Retrosheet-style game logs (`batting.csv`)
   into player-seasons, labels each with its primary batting slot, and
   confirms slots have distinct (if gradient-like, not hard-clustered)
   skill profiles.
2. `slot_scoring_model.ipynb` builds the actual model:
   - Restricts to **2021–2025 regular-season starters with a stable primary
     slot** (`slot_share >= 0.5`, `starts >= 80`) — the training population,
     `regulars`.
   - Computes six features per player-season: `obp`, `slg`, `iso`,
     `bb_rate`, `k_rate`, `sb_pg`.
   - **Scaler** — `FEAT_MEAN`, `FEAT_STD`: the mean and standard deviation
     of each feature across `regulars`. This is the fixed yardstick every
     later z-score is measured against.
   - **Prototypes** — z-score every player-season, average within each slot
     (1–9) → a 9×6 matrix, "what a typical #3 hitter looks like" etc.
   - **Demand vectors** — `POWER_DEMAND`/`SPEED_DEMAND` (from the
     prototypes' ISO/SB columns, min-max'd to 0–1) and `PA_DEMAND` (each
     slot's real plate-appearance share, straight from game logs).
   - **Presets** — named ingredient-weight combinations (`Balanced`,
     `Aggressive`, `Small-ball`, `Max offense`).
3. All of the above is exported once as plain JSON to
   `backend/data/processed/slot_scoring.json`. This file is the *entire*
   bridge between the notebooks and the backend — the backend never touches
   `batting.csv` or retrains anything.

## Stage 2 — Coach input: building a roster

**Files:** `frontend/src/components/RosterTable.jsx`,
`frontend/src/pages/RosterPage.jsx` → `backend/app.py` → `backend/store.py`

- A coach adds a player via a form: **name** (free text) + four **1–5
  ratings**: Contact, Power, Discipline, Speed (`RosterTable.jsx`,
  `PlayerCard.jsx`).
- `POST /roster` validates ratings are integers 1–5 (Pydantic `Ratings`
  model, `Field(ge=1, le=5)`), assigns an id (`p1`, `p2`, …), and appends to
  the in-memory `players` list.
- Every mutation (`add_player`, `update_player`, `remove_player`) calls
  `persist()`, which writes the full app state (players, next id counter,
  current batting order) to `backend/data/app_state.json` via `store.save()`
  — an atomic write (temp file + `os.replace`) so a crash mid-write can't
  corrupt the store. On restart, `bootstrap()` reloads this file, or seeds a
  demo 9-player roster if none exists yet.
- Removing a player (`prune_player_references`) also drops any lock that
  pointed at them and regenerates the batting order if a full 9-player
  roster remains — otherwise clears the batting order state.

## Stage 3 — Rating → feature conversion

**File:** `backend/model/ratings.py`

The model was trained on real MLB rate stats, but a coach only enters four
1–5 ratings. `ratings_to_features` bridges the two, per player:

1. **Rating → z-score:** `z = rating - 3`. Rating 3 is defined as
   league-average (z = 0); each point away is treated as one standard
   deviation (1 ≈ -2σ, 5 ≈ +2σ).
2. **Route each trait's z-score to a feature:**
   - Contact → `obp`
   - Power → `slg` **and** `iso` (same z-value used for both)
   - Discipline → `bb_rate`
   - Speed → `sb_pg`
   - `k_rate` is driven by *both* Contact and Discipline (better contact
     and discipline both lower strikeouts), averaged: `-(contact +
     discipline) / 2` so it stays on the same -2..+2 scale as everything
     else instead of being double-weighted.
3. **z-score → raw stat value:** `SCALER_MEAN + z * SCALER_STD`, using the
   *same* scaler learned in Stage 1. This is a deliberate round trip:
   `batting_order.py` immediately re-standardizes with that identical
   scaler, so converting rating → z → raw → z again nets out exactly,
   letting coach-rated and real historical players share one code path.
4. `roster_to_features` stacks all 9 players into a (9, 6) matrix — the
   direct input to the scoring model.

## Stage 4 — Scoring: the four ingredient matrices

**File:** `backend/model/batting_order.py` — `ingredient_matrices`

Given the (9, 6) feature matrix, every player is re-standardized
(`Z = (features - SCALER_MEAN) / SCALER_STD`) against the Stage-1 scaler,
then four 9×9 (players × slots) matrices are built, each min-max'd to 0–1:

| Ingredient | Formula | Meaning |
|---|---|---|
| `trad` | `minmax(-distance(Z, PROTOTYPES))` | how closely a player's whole profile resembles each slot's historical fingerprint |
| `power` | `outer(minmax(Z_iso), POWER_DEMAND)` | rewards power specifically in slots that have historically demanded it |
| `speed` | `outer(minmax(Z_sb_pg), SPEED_DEMAND)` | same construction, for speed |
| `offense` | `outer(minmax(Z_obp + Z_slg), PA_DEMAND)` | rewards giving your best overall hitters the slots with the most plate appearances |

A coach's chosen **weights** (either a named preset like `Balanced`, or raw
slider values from `BattingOrderPage.jsx`) blend these into one matrix:
`M = Σ weight_k * ingredient_k`. `resolve_weights()` in `app.py` rejects
unknown ingredient keys and all-zero weight sets (422 errors) before this
runs.

## Stage 5 — Assignment: the Hungarian algorithm

**File:** `backend/model/batting_order.py` — `recommend_order`

`M` (9 players × 9 slots, higher = better) is handed to
`scipy.optimize.linear_sum_assignment(-M)`. Negating flips the library's
default *minimize cost* behavior into *maximize score*. This solves the
**assignment problem** exactly and in polynomial time: the one-to-one
player↔slot pairing (every player exactly one slot, every slot exactly one
player) that **maximizes total score across all 9 pairings simultaneously**
— not just each player's individual best slot, which can conflict.

**Locking** (a coach pinning a player to a slot) is done entirely through
matrix manipulation, not a separate code path:
```python
solver_M[p_idx, :] -= LOCK_BONUS      # this player: nothing else acceptable
solver_M[:, col]   -= LOCK_BONUS      # this slot: nobody else acceptable
solver_M[p_idx, col] += 3 * LOCK_BONUS  # ...except this exact pairing
```
The solver still runs the same optimal assignment, it just has no better
option than to honor the lock, and optimizes the remaining 8×8 sub-problem
around it. Locks are applied to a **copy** of `M` (`solver_M`) — the
original, unperturbed `M` is what gets returned and later scored, so locked
slots don't display an artificially inflated score.

## Stage 6 — Output: turning scores into a display and a response

**File:** `backend/model/batting_order.py` — `score_lineup`;
`backend/app.py` — `generate_state`

- Each ingredient matrix is already 0–1, so a blended cell can be at most
  `Σ weights`. `score_lineup` divides each chosen (player, slot) cell by
  `total_weight` and scales to 0–100, giving a per-slot score comparable
  across different weight settings. The mean of all 9 slot scores is the
  `overallScore`.
- `generate_state` converts between the model's 1-based slots and the
  frontend's 0-based slot indices, builds the `order` array (player id per
  slot), and returns `{order, locked, scores, overallScore}` — persisted via
  `store.save()` and returned as the API response.
- The frontend (`useBattingOrder.js`) renders this via `BattingOrderList`:
  slot number, player, per-player score badge (tiered by `scoreTier.js`),
  drag-to-reorder (local only, until "Generate" is pressed again), and lock
  toggles. A "changes" banner diffs the previous vs. new order after each
  generate.

---

## Validation notes

Things worth knowing about, found while tracing this flow:

1. **The lock-mutation bug from the original notebook was fixed in the
   ported backend code.** In `slot_scoring_model.ipynb`'s original
   `recommend_order`, locks were applied by mutating `M` directly and
   returning that same mutated matrix — so a locked slot's returned score
   would have included the `±LOCK_BONUS` terms. `batting_order.py` fixes
   this by solving on `solver_M = M.copy()` and returning the original,
   clean `M` for scoring. Good catch during the port; no action needed.

2. **The rating → z-score → raw-stat conversion assumes each trait's real
   distribution is roughly normal, and that assumption doesn't hold for
   every feature.** `sb_pg` (stolen bases/game) has `std ≈ mean` in the
   learned scaler (`0.0822` vs `0.0805`), a strong sign of a right-skewed,
   zero-bounded distribution rather than a normal one. Concretely: a Speed
   rating of 1 (z = -2) produces `raw_sb_pg = 0.0805 + (-2)(0.0822) ≈
   -0.084` — a negative stolen-base rate, which is physically impossible.
   It doesn't currently break scoring (the value is immediately
   re-standardized back to ~the same z-score, so relative ranking is
   unaffected), but it would look wrong if ever surfaced directly (e.g. "this
   player projects to -0.08 SB/game"). A more robust fix: replace the linear
   `mean + z*std` step with an empirical-percentile lookup against the real
   `regulars` distribution per feature (map z's sigma to a percentile via
   the normal CDF once, then read off the actual value at that percentile
   from the training data — always a real, non-negative number). Not
   implemented; flagged for awareness.

3. **`3 = average` on the rating scale is a UX convention, not a derived
   statistic.** It's a reasonable, common approach (mirrors real baseball
   scouting's 20-80 scale, where 50 is average and 10 points ≈ 1σ), but it's
   worth documenting as a deliberate design choice rather than an
   empirically validated calibration.

4. **Minor fragile default:** `app.py`'s docstring instructs running the
   backend on port 8001, and `frontend/.env.example` correctly points
   `VITE_API_BASE_URL` at `8001` — but `mockApi.js`'s hardcoded fallback (used
   if a developer never copies `.env.example` to `.env`) is `8000`. Not a
   bug in checked-in behavior, but a likely first-run confusion point for
   anyone who skips the `.env` setup step.

5. **Everything else checked out consistently:** ingredient/trait key names
   (`contact/power/discipline/speed`, `trad/power/speed/offense`) match
   exactly across the notebook, `ratings.py`, `app.py`'s Pydantic models,
   and the frontend components — no naming drift found. Slot indexing
   (1-based in the model, 0-based in the API/frontend) is converted
   consistently at the one boundary (`generate_state`) where it matters.

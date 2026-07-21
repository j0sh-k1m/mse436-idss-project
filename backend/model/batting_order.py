"""Batting-order recommendation model.

Ported from ``notebooks/slot_scoring_model.ipynb``. The learned parameters
(feature scaler, slot prototypes, slot demand vectors, presets) are loaded
from ``backend/data/processed/slot_scoring.json`` — no CSV, no training, no
ML runtime.

The model scores each (player, slot) pair with four "ingredient" matrices
blended by user-controlled weights, then solves the 9x9 assignment with the
Hungarian algorithm. Locked player-slot pairs are enforced by making the
locked pairing irresistible to the solver, so the remaining players are
re-optimized around the coach's choices.
"""

import json
from pathlib import Path

import numpy as np
from scipy.optimize import linear_sum_assignment

_PARAMS_PATH = Path(__file__).resolve().parent.parent / "data" / "processed" / "slot_scoring.json"

with _PARAMS_PATH.open() as f:
    _PARAMS = json.load(f)

FEATURES = _PARAMS["features"]  # ["obp", "slg", "iso", "bb_rate", "k_rate", "sb_pg"]
SCALER_MEAN = np.array([_PARAMS["scaler_mean"][f] for f in FEATURES])
SCALER_STD = np.array([_PARAMS["scaler_std"][f] for f in FEATURES])
PROTOTYPES = np.array(_PARAMS["prototypes"])  # (9 slots, 6 features), z-space
POWER_DEMAND = np.array(_PARAMS["power_demand"])
SPEED_DEMAND = np.array(_PARAMS["speed_demand"])
PA_SHARE = np.array(_PARAMS["pa_share"])
PRESETS = _PARAMS["presets"]

N_SLOTS = PROTOTYPES.shape[0]
LOCK_BONUS = 1e6


def minmax(v):
    v = np.asarray(v, dtype=float)
    return (v - v.min()) / (v.max() - v.min() + 1e-12)


PA_DEMAND = minmax(PA_SHARE)


def ingredient_matrices(features):
    """features: (9, 6) array of raw feature values, columns in FEATURES order.
    Returns dict of 9x9 matrices (rows=players, cols=slots 1-9), each in 0-1."""
    features = np.asarray(features, dtype=float)
    Z = (features - SCALER_MEAN) / SCALER_STD

    dist = np.sqrt(((Z[:, None, :] - PROTOTYPES[None, :, :]) ** 2).sum(axis=2))
    trad = minmax(-dist)

    power = np.outer(minmax(Z[:, FEATURES.index("iso")]), POWER_DEMAND)
    speed = np.outer(minmax(Z[:, FEATURES.index("sb_pg")]), SPEED_DEMAND)

    quality = minmax(Z[:, FEATURES.index("obp")] + Z[:, FEATURES.index("slg")])
    offense = np.outer(quality, PA_DEMAND)

    return {"trad": trad, "power": power, "speed": speed, "offense": offense}


def blended_matrix(features, weights):
    """Blend the ingredient matrices with the user's weights (no lock terms)."""
    mats = ingredient_matrices(features)
    return sum(w * mats[k] for k, w in weights.items())


def starter_values(features, weights):
    """Strategy-weighted value of each player for making the starting nine.

    Uses absolute talent (z-scored power / speed / OBP+SLG), blended with the
    user's weights, so Aggressive / Small-ball / Max offense prefer different
    bench cutoffs. Deliberately does **not** use slot-prototype distance: that
    signal is for ordering the nine, and it penalizes elite all-around players
    who sit far from every specialized slot fingerprint (so a 5/5/5/5 bat would
    lose the cut to average "shape matches" under Balanced).
    """
    features = np.asarray(features, dtype=float)
    Z = (features - SCALER_MEAN) / SCALER_STD

    # Overall bat quality stands in for "trad" at the cut stage — productive
    # hitters make the nine; prototype shape is applied later in recommend_order.
    offense_z = Z[:, FEATURES.index("obp")] + Z[:, FEATURES.index("slg")]
    trad = minmax(offense_z)
    power = minmax(Z[:, FEATURES.index("iso")])
    speed = minmax(Z[:, FEATURES.index("sb_pg")])
    offense = minmax(offense_z)

    return (
        weights.get("trad", 0.0) * trad
        + weights.get("power", 0.0) * power
        + weights.get("speed", 0.0) * speed
        + weights.get("offense", 0.0) * offense
    )


def select_starters(n_players, values, n_slots=N_SLOTS, must_include=None):
    """Pick ``n_slots`` starter indices from a larger roster.

    Locked players in ``must_include`` are always kept; the remaining seats
    go to the highest ``values``. Returns starter indices in descending
    value order (locks first among ties are already forced in).
    """
    must_include = list(must_include or [])
    if len(must_include) > n_slots:
        raise ValueError(f"Cannot lock more than {n_slots} players into the lineup")
    if n_players < n_slots:
        raise ValueError(f"Need at least {n_slots} players; got {n_players}")

    chosen = set(must_include)
    ranked = sorted(range(n_players), key=lambda i: values[i], reverse=True)
    for i in ranked:
        if len(chosen) >= n_slots:
            break
        chosen.add(i)
    # Stable-ish order: highest value first for readability in debugging
    return sorted(chosen, key=lambda i: values[i], reverse=True)


def recommend_order(features, weights, locks=None):
    """features: (9, 6) array of raw feature values for 9 players.
    weights: dict over ingredients ("trad", "power", "speed", "offense").
    locks: {player_row_index: slot(1-9)}.
    Returns (slots array where slots[i] is player i's batting slot 1-9,
    blended matrix WITHOUT lock perturbations — safe for score display)."""
    M = blended_matrix(features, weights)
    solver_M = M.copy()

    if locks:
        for p_idx, slot in locks.items():
            col = slot - 1
            solver_M[p_idx, :] -= LOCK_BONUS      # this player: nothing else is acceptable
            solver_M[:, col] -= LOCK_BONUS        # this slot: nobody else is acceptable
            solver_M[p_idx, col] += 3 * LOCK_BONUS  # ...except this exact pairing

    rows, cols = linear_sum_assignment(-solver_M)  # maximize total score
    slots = np.zeros(len(features), dtype=int)
    slots[rows] = cols + 1
    return slots, M


def score_lineup(matrix, slots, weights):
    """Convert blended-matrix values for an assignment into display scores.

    Each ingredient matrix is 0-1, so a (player, slot) cell is at most the sum
    of the weights; dividing by that puts every score on a 0-100 scale that is
    comparable across different slider settings.

    Returns (per-slot scores ordered by batting slot 1-9, overall score),
    all rounded ints in 0-100."""
    total_weight = sum(weights.values())
    if total_weight <= 0:
        return [0] * len(slots), 0

    scores = [0] * len(slots)
    for p_idx, slot in enumerate(slots):
        raw = matrix[p_idx, slot - 1] / total_weight
        scores[slot - 1] = int(round(100 * min(max(raw, 0.0), 1.0)))
    overall = int(round(sum(scores) / len(scores)))
    return scores, overall


INGREDIENT_LABELS = {
    "trad": "Traditional fit",
    "power": "Power",
    "speed": "Speed",
    "offense": "Offense",
}


def explain_assignment(features, weights, slots):
    """Per-slot ingredient breakdown for the assigned lineup.

    For each batting slot, returns which weighted ingredient contributed most to
    placing that player there — so the UI can show *why* the model made the
    choice, not just the blended score.

    Returns a list ordered by batting slot 1-9; each entry is
    ``{topIngredient, topLabel, contributions}`` where ``contributions`` maps
    ingredient → percent share of the weighted score for that (player, slot).
    """
    mats = ingredient_matrices(features)
    explanations: list[dict] = []
    for slot_num in range(1, len(slots) + 1):
        # Find which player row was assigned to this slot
        matches = [p_idx for p_idx, s in enumerate(slots) if int(s) == slot_num]
        if not matches:
            explanations.append(
                {
                    "topIngredient": "trad",
                    "topLabel": INGREDIENT_LABELS["trad"],
                    "contributions": {},
                }
            )
            continue
        p_idx = matches[0]
        col = slot_num - 1
        contribs = {
            k: float(w * mats[k][p_idx, col])
            for k, w in weights.items()
            if w > 0
        }
        if not contribs:
            explanations.append(
                {
                    "topIngredient": "trad",
                    "topLabel": INGREDIENT_LABELS["trad"],
                    "contributions": {},
                }
            )
            continue
        total = sum(contribs.values()) or 1.0
        pct = {k: int(round(100 * v / total)) for k, v in contribs.items()}
        # Fix rounding drift so shares sum to ~100
        drift = 100 - sum(pct.values())
        if drift != 0 and pct:
            top_key = max(pct, key=pct.get)
            pct[top_key] = max(0, pct[top_key] + drift)
        top = max(contribs, key=contribs.get)
        explanations.append(
            {
                "topIngredient": top,
                "topLabel": INGREDIENT_LABELS[top],
                "contributions": pct,
            }
        )
    return explanations

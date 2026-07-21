# Slot-scoring model

The batting-order recommender is an interpretable assignment model, not a black-box neural net. Parameters are learned offline from MLB regular-season starters (2021–2025) and shipped as a small JSON file; the backend only loads that file and scores lineups.

## What the coach controls

1. **Roster ratings** — each player gets four 1–5 traits: contact, power, discipline, speed.
2. **Compare options** — generate returns three fixed strategies (Balanced, Small-ball, Max offense) side by side.
3. **Customize** — optional fourth lineup from coach-chosen ingredient weights, compared against the same three.
4. **Locks** — pin a player into a batting slot; regenerate re-optimizes the rest around that choice.

## Trait → feature mapping

The model’s internal features are `OBP`, `SLG`, `ISO`, `BB%`, `K%`, and `SB/game`. Coach traits map onto those features in `backend/model/ratings.py`:

| Trait | Effect on features |
|-------|--------------------|
| Contact | ↑ OBP, ↓ K% |
| Power | ↑ SLG, ↑ ISO |
| Discipline | ↑ BB%, ↓ K% |
| Speed | ↑ SB/game |

A rating of **3** is league-average (\(z = 0\)). Each rating point is one standard deviation (so 1 ≈ −2σ, 5 ≈ +2σ). Z-scores are converted to raw stats using the scaler in `slot_scoring.json`, then the scoring code re-standardizes with the same scaler — no retraining required when coaches enter soft ratings instead of real MLB box scores.

## Scoring ingredients

For a set of nine starters, the model builds four 9×9 matrices (players × slots), each scaled to 0–1:

- **Traditional fit** — similarity of the player’s z-profile to the learned fingerprint of each batting slot.
- **Power** — player power × how much that slot historically “wants” power.
- **Speed** — same idea for speed / stolen-base demand.
- **Offense** — overall hitting quality × plate-appearance share (front-loads PAs to better bats).

User weights blend those matrices. The Hungarian algorithm (`scipy.optimize.linear_sum_assignment`) finds the assignment that maximizes total score. Locks are enforced by making the locked pairing irresistible to the solver.

Presets (Balanced, Small-ball, Max offense) are the fixed compare options in the UI. Aggressive remains in `slot_scoring.json` but is not offered in the compare flow. Custom weights from the coach are an optional fourth candidate.

## Rosters larger than nine

When the roster has more than nine players, the backend first scores everyone with a strategy-weighted **starter value** (power, speed, and OBP+SLG quality — not slot-prototype distance). Locked players always make the starting nine. The remaining seats go to the highest-value players; everyone else is returned on the **bench**. Prototype fit is applied only in the 9×9 slot assignment on the selected starters, so elite all-around bats are not cut for looking “unprototypical.”

## Scores shown in the UI

Per-slot and overall scores are the assigned cells of the blended matrix, normalized by total slider weight and scaled to **0–100** so different strategies remain comparable.

Each assigned slot also ships an **explanation**: the weighted ingredient that contributed most to that (player, slot) score, plus percent shares across active ingredients. The UI uses these for “Why: Speed” badges and hover tooltips so a coach can see *why* a strategy would move someone — not only that the order changed.

## Provenance

- Training / visualization: `notebooks/slot_scoring_model.ipynb`
- Shipped parameters: `backend/data/processed/slot_scoring.json`
- Runtime: `backend/model/batting_order.py` + `backend/model/ratings.py`

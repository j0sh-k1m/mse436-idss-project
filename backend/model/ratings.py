"""Coach ratings to model features.

The coach rates each player on four 1-5 traits; the batting-order model
works on six MLB-derived stats. This module bridges the two:

- **Contact**    -> raises OBP, lowers K%
- **Power**      -> raises SLG and ISO
- **Discipline** -> raises BB%, lowers K%
- **Speed**      -> raises SB/game

Mechanics: a rating of 3 is league-average (z = 0) and each rating point is
one standard deviation, so 1 ~ -2 sigma and 5 ~ +2 sigma. The z-scores are
converted back to raw stat values with the scaler learned in
``slot_scoring.json``. Because ``batting_order`` immediately re-standardizes
with the same scaler, the round trip is exact — no retraining needed.

K% is pulled down by both contact and discipline, so those two contributions
are averaged to keep it on the same -2..+2 scale as everything else.
"""

import numpy as np

from .batting_order import FEATURES, SCALER_MEAN, SCALER_STD

TRAITS = ["contact", "power", "discipline", "speed"]


def _z(rating):
    """1-5 rating -> z-score: 3 is average, each point is one sigma."""
    return float(rating) - 3.0


def ratings_to_features(ratings):
    """ratings: dict with 1-5 values for each of TRAITS.
    Returns a length-6 numpy array of raw feature values in FEATURES order."""
    contact = _z(ratings["contact"])
    power = _z(ratings["power"])
    discipline = _z(ratings["discipline"])
    speed = _z(ratings["speed"])

    z_by_feature = {
        "obp": contact,
        "slg": power,
        "iso": power,
        "bb_rate": discipline,
        "k_rate": -(contact + discipline) / 2.0,
        "sb_pg": speed,
    }
    z = np.array([z_by_feature[f] for f in FEATURES])
    return SCALER_MEAN + z * SCALER_STD


def roster_to_features(roster_ratings):
    """roster_ratings: iterable of per-player ratings dicts (see above).
    Returns an (n_players, 6) feature matrix for the batting-order model."""
    return np.array([ratings_to_features(r) for r in roster_ratings])

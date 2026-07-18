"""Defensive position assignment model.

Build player-to-position fit scores and use the Hungarian algorithm to find
the highest-value assignment. Support locked player-position pairs by fixing
those choices and re-optimizing the remaining players and positions.
"""

// Maps a 0-100 fit/batting score (as returned by the API layer) to a display
// tier. Purely presentational — never used to compute or adjust a score.
export function scoreTier(score) {
  if (score >= 75) return 'high'
  if (score >= 50) return 'mid'
  return 'low'
}

/** Human-readable batting-slot names for decision-facing copy. */
export const SLOT_LABELS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
]

export function slotLabel(index) {
  return SLOT_LABELS[index] ?? `${index + 1}th`
}

/**
 * Player-centric moves between two batting orders.
 * @returns {Map<string, { kind: 'up'|'down'|'in', from: number|null, to: number, label: string }>}
 */
export function playerMoves(prevOrder, nextOrder) {
  const moves = new Map()
  if (!nextOrder?.length) return moves

  const prevSlot = new Map((prevOrder ?? []).map((id, i) => [id, i]))

  nextOrder.forEach((playerId, to) => {
    if (!prevSlot.has(playerId)) {
      moves.set(playerId, {
        kind: 'in',
        from: null,
        to,
        label: `↑ into ${slotLabel(to)}`,
      })
      return
    }
    const from = prevSlot.get(playerId)
    if (from === to) return
    const kind = to < from ? 'up' : 'down'
    const arrow = kind === 'up' ? '↑' : '↓'
    moves.set(playerId, {
      kind,
      from,
      to,
      label: `${arrow} moved to ${slotLabel(to)}`,
    })
  })

  return moves
}

export const INGREDIENT_SHORT = {
  trad: 'Trad',
  power: 'Power',
  speed: 'Speed',
  offense: 'Offense',
}

/** Build a short decision sentence for a slot explanation. */
export function explanationSummary(explanation) {
  if (!explanation?.topLabel) return ''
  const parts = Object.entries(explanation.contributions ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, pct]) => `${INGREDIENT_SHORT[k] ?? k} ${pct}%`)
  const mix = parts.length ? ` (${parts.join(' · ')})` : ''
  return `Mostly ${explanation.topLabel} for this slot${mix}`
}

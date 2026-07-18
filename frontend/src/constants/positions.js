// The 10 defensive positions used across the app (fastpitch 9 + short
// fielder for slow-pitch). `x`/`y` are percentages used to place each
// position slot on top of the SVG diamond in PositionField.jsx — they
// approximate real field geometry, not arbitrary form layout.
export const POSITIONS = [
  { id: 'P', label: 'Pitcher', x: 50, y: 64 },
  { id: 'C', label: 'Catcher', x: 50, y: 96 },
  { id: '1B', label: 'First Base', x: 71, y: 69 },
  { id: '2B', label: 'Second Base', x: 50, y: 46 },
  { id: '3B', label: 'Third Base', x: 29, y: 69 },
  { id: 'SS', label: 'Shortstop', x: 34, y: 52 },
  { id: 'SF', label: 'Short Fielder', x: 50, y: 34 },
  { id: 'LF', label: 'Left Field', x: 22, y: 30 },
  { id: 'CF', label: 'Center Field', x: 50, y: 16 },
  { id: 'RF', label: 'Right Field', x: 78, y: 30 },
]

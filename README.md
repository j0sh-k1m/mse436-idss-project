# Softball Lineup & Position IDSS

## Project structure

```
├── backend/                 Python API and decision-support model
│   ├── app.py               Backend entry point (API / server)
│   ├── requirements.txt     Python dependencies
│   ├── model/               Core IDSS logic (no UI code)
│   │   ├── ratings.py       Convert raw stats → 1–5 skill ratings
│   │   ├── assignment.py    Position optimization (Hungarian algorithm)
│   │   └── batting_order.py Batting order logic
│   └── data/
│       ├── raw/             Downloaded MLB datasets (gitignored)
│       └── processed/       Cleaned / converted training data
│
├── frontend/                React UI (Vite scaffold)
│
├── notebooks/               Exploration and prototyping
│   └── exploration.ipynb
│
└── docs/                    Project documents (proposal, reports, etc.)
```

- `backend/model/` holds the pure decision logic. The frontend should never contain model math.
- `backend/data/raw/` is gitignored so large downloads stay local; `.gitkeep` keeps the empty folder in git.
- `frontend/` is the interactive coach-facing UI; it will call the backend for lineup recommendations.
- `notebooks/` is for one-off analysis and prototyping, not production code.
- `docs/` is for written deliverables and reference material.

## Running locally

## Team

## AI Use Disclosure

AID Statement: Artificial Intelligence Tool: Claude, Claude Code, Cursor; Data Collection Method: Finding sources of MLB data; Execution: Implementing logic and ideas created by the team through writing code.

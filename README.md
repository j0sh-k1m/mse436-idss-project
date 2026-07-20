# Softball Lineup Coach IDSS

## Project structure

```
├── backend/                 Python API and decision-support model
│   ├── app.py               FastAPI entry point (API / server)
│   ├── requirements.txt     Python dependencies
│   ├── model/               Core IDSS logic (no UI code)
│   │   ├── ratings.py       Map coach 1–5 trait ratings → model features
│   │   └── batting_order.py Batting order slot-scoring model
│   └── data/
│       ├── raw/             Downloaded MLB datasets (gitignored)
│       └── processed/       Learned model parameters (slot_scoring.json)
│
├── frontend/                React UI (Vite scaffold)
│
├── notebooks/               Exploration and prototyping
│   └── slot_scoring_model.ipynb
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

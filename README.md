# Softball Lineup Coach IDSS

Batting-order decision support for recreational / beer-league softball coaches.

## Problem

This IDSS lets a coach rate each player on a scale of 1–5 on contact, power, discipline, and speed, then provides tools to assist the coach with creating lineups, compares strategy options side by side, and supports locks so the coach can override parts of the order while the rest of the batting positions can be re-optimized.

## Prerequisites

- **Python 3.11+** (backend: FastAPI, uvicorn, numpy, scipy, pydantic — see [`backend/requirements.txt`](backend/requirements.txt))
- **Node.js 20.19+ or 22.12+** (this repo pins Node **22** via [`.nvmrc`](.nvmrc); `nvm use` recommended)
- No database
- Optional for notebooks only: Jupyter + pandas / scikit-learn (not required to run the app)

## Running locally

### Clone

```bash
git clone https://github.com/j0sh-k1m/mse436-idss-project.git
cd mse436-idss-project
```

In your terminal, please cd into where the project was cloned 

### One command (recommended)

From the repo root:

```bash
./dev
```

Creates a repo-root `.venv` and installs deps on first run if needed, copies `frontend/.env` from `.env.example` when missing, starts the API and UI together, and stops both on Ctrl+C.

- UI: http://127.0.0.1:5173
- API: http://127.0.0.1:8001 (`/health`, interactive docs at `/docs`)

Override ports if needed: `API_PORT=8001 UI_PORT=5173 ./dev`

If Node is wrong/missing, run `nvm use` (see `.nvmrc`) before `./dev`. SSL errors on `pip install` are covered under Manual below.

### Manual (two terminals)

Backend (venv at **repo root**):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app:app --reload --port 8001
```

If `pip install` fails with an SSL certificate error on macOS, retry with:

```bash
pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r backend/requirements.txt
```

Frontend:

```bash
nvm use          # reads .nvmrc; install with: nvm install
cd frontend
cp .env.example .env   # optional; defaults already use port 8001
npm install
npm run dev
```

The Vite app calls the FastAPI backend at `VITE_API_BASE_URL` (see [`frontend/.env.example`](frontend/.env.example)). Default is `http://127.0.0.1:8001`. `./dev` creates `.env` automatically if it is missing.

## Data setup

**To run the app:** no Retrosheet download is required. Learned parameters ship in [`backend/data/processed/slot_scoring.json`](backend/data/processed/slot_scoring.json) (scaler, nine slot prototypes, demand vectors, and strategy presets).

**Raw batting data** (`notebooks/batting.csv`, Retrosheet-style game batting) is used only in notebooks and is **gitignored**. Place a local copy under `notebooks/` if you want to regenerate models or explore.

**Regenerate learned parameters:** run [`notebooks/slot_scoring_model.ipynb`](notebooks/slot_scoring_model.ipynb) (updates `slot_scoring.json`). Optional analysis notebooks: [`notebooks/exploration.ipynb`](notebooks/exploration.ipynb), [`notebooks/ratings_mapping_variants.ipynb`](notebooks/ratings_mapping_variants.ipynb).

## Documentation

- [`docs/model.md`](docs/model.md) — trait → feature mapping, scoring ingredients, locks, and how lineups are assigned
- [`docs/api.md`](docs/api.md) — FastAPI endpoints the UI calls (roster, batting order, presets)

## How to use the UI

1. Start the stack (`./dev` or manual) and open http://127.0.0.1:5173.
2. **Roster** — view seeded players; add or remove players; set contact, power, discipline, and speed (1–5). You need at least nine players to generate a full order. Rosters larger than nine are fine: the backend picks nine starters and returns everyone else on the bench.
3. **Batting Order** — click **Generate options** to compare three strategies (Balanced, Small-ball, Max offense). Optionally set custom ingredient weights and compare a fourth candidate. Select an alternative, then lock players to slots and regenerate (or drag unlocked rows) to refine. Fit scores, move badges, and “Why” drivers come from the API—the frontend does not invent model scores.

## Project structure

```
├── dev                      One-command local runner (API + UI)
├── .nvmrc                   Pins Node 22
├── backend/                 Python API and decision-support model
│   ├── app.py               FastAPI entry point
│   ├── store.py             In-memory / file-backed app state
│   ├── requirements.txt     Python dependencies
│   ├── model/               Core IDSS logic (no UI code)
│   │   ├── ratings.py       Map coach 1–5 trait ratings → model features
│   │   └── batting_order.py Slot-scoring + Hungarian assignment
│   └── data/
│       ├── raw/             Downloaded MLB datasets (gitignored)
│       └── processed/       Learned parameters (slot_scoring.json)
│
├── frontend/                React + Vite coach UI (Roster + Batting Order)
│
├── notebooks/               Exploration and prototyping
│   ├── slot_scoring_model.ipynb
│   ├── exploration.ipynb
│   └── ratings_mapping_variants.ipynb
│
└── docs/                    See Documentation above (model.md, api.md)
```

- `backend/model/` holds the pure decision logic. The frontend should never contain model math.
- `backend/data/raw/` is gitignored so large downloads stay local; `.gitkeep` keeps the empty folder in git.
- `notebooks/` is for analysis and regenerating parameters, not production code.
- Further detail: [`docs/model.md`](docs/model.md), [`docs/api.md`](docs/api.md).

## Model / methodology

The recommender is an assignment model. Six batting features (OBP, SLG, ISO, BB%, K%, SB/game) and nine slot prototypes are learned offline from MLB games and shipped in `slot_scoring.json`. Coach will rate their players on four different stats on a scale from 1–5; traits are mapped into that feature space (Six batting features) in [`backend/model/ratings.py`](backend/model/ratings.py); weighted scoring ingredients (traditional fit, power, speed, offense) are blended and assigned with the Hungarian algorithm in [`backend/model/batting_order.py`](backend/model/batting_order.py). Full write-up: [`docs/model.md`](docs/model.md).

## AI Use Disclosure

AID Statement: Artificial Intelligence Tool: Claude, Claude Code, Cursor; Data Collection Method: Finding sources of MLB data; Execution: Implementing logic and ideas created by the team through writing code; Writing—Review & Editing: Writing README and other markdown files in the repo. 

More Details on AI generated content are in these files: [`backend/model/batting_order.py`](backend/model/batting_order.py). Full write-up: [`docs/model.md`](docs/model.md)
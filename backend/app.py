"""Backend API entry point.

FastAPI app the React frontend calls to submit player data and receive
optimized batting orders. This module handles API concerns (request
validation, CORS) and delegates all decision logic to modules in ``model``.

Run locally with:

    uvicorn app:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Softball Lineup Coach API")

# The Vite dev server runs on port 5173 by default.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}

# RVLRY

RVLRY is a mobile-first party game web app with a shared launcher and extensible architecture for multiple games:

- **Imposter** (social deduction)
- **WhoWhatWhere** (Articulate-style clue game)
- **DrawNGuess** (Telestrations-style drawing chain)

## Current progress

- React + Vite front-end optimized for mobile screens.
- Socket.IO room/lobby service for multi-device sessions.
- Host-based room start flow with per-player private game payloads.
- Local pass-and-play mode scaffold with handoff/reveal controls.
- Word list sync service integrated with WordListManager.
- Startup + weekly sync with local word-cache fallback for uninterrupted game starts.
- Railway-friendly deployment with optional Docker self-hosting.

A full phased implementation roadmap is available at `docs/IMPLEMENTATION_PLAN.md`.

## Local development

```bash
npm install
npm run dev
```

- Client: `http://localhost:5173`
- Server API: `http://localhost:3001`

## WordListManager integration

Set `WORDLIST_BASE_URL` if needed (defaults to Railway URL provided):

```bash
WORDLIST_BASE_URL=https://wordlistmanager-production.up.railway.app
```

The server syncs words at startup, refreshes weekly, and persists a local cache at `server/data/word-cache.json` so gameplay can continue even if WordListManager is temporarily unavailable.

Endpoints:

- `GET /api/words/random?type=guessing|describing`
- `GET /api/words/status`
- `POST /api/words/sync`

## Deploy to Railway

- Build command: `npm run build`
- Start command: `npm run start`
- Set env vars: `PORT`, `WORDLIST_BASE_URL` (optional)

## Docker self-hosting

```bash
docker build -t rvlry .
docker run -p 3001:3001 rvlry
```

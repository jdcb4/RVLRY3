# RVLRY

RVLRY is a mobile-first React web app that hosts multiple online parlour games in one place:

- **Imposter** (social deduction)
- **WhoWhatWhere** (Articulate-style team guessing)
- **DrawNGuess** (Telestrations-style draw and guess)

The app is built for both:

- **multi-device online play** through socket lobbies
- **local pass-and-play** flows for games where it makes sense

## Tech stack

- React + Vite
- React Router for multi-game navigation
- Socket.IO client for multiplayer room connections
- TanStack Query + localForage to cache and manage game word lists
- Railway-first deployment, with Docker support for self-hosting

## Word list synchronization

RVLRY syncs words from WordListManager and caches them locally.

- Default source: `https://wordlistmanager-production.up.railway.app`
- Sync cadence: once every 7 days on app load, with manual "Sync now"
- Type mapping:
  - `guessing` words => WhoWhatWhere
  - `describing` words => Imposter and DrawNGuess

Set custom source with:

```bash
VITE_WORD_API_BASE_URL=https://wordlistmanager-production.up.railway.app
```

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Railway deployment

Railway can auto-detect this project as a Node build:

- Build command: `npm ci && npm run build`
- Start command: `npm run preview -- --host 0.0.0.0 --port $PORT`

Environment variables:

- `VITE_SOCKET_SERVER_URL` (URL of your socket backend)
- `VITE_WORD_API_BASE_URL` (optional override)

## Docker deployment

```bash
docker build -t rvlry .
docker run --rm -p 8080:8080 rvlry
```

Then open `http://localhost:8080`.

## Expansion pattern

Games are registered in `src/games/catalog.js` and rendered through a shared launcher + lobby flow. New games can be added by extending the game catalog and providing mode-specific setup and runtime views.

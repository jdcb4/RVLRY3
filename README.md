# RVLRY

RVLRY is a mobile-first React + Socket.IO web app for playing parlour party games online, with support for local pass-and-play where appropriate.

## Included games
- **Imposter** (online): hidden role + shared prompt game.
- **WhoWhatWhere** (online + pass-and-play): Articulate-inspired clue/guess game.
- **DrawNGuess** (online): Telestrations-style chain prompts.

## Architecture
- `client/`: React (Vite), routing, game launcher UI, game views.
- `server/`: Express API, Socket.IO room engine, word-sync service.
- Word lists sync from **WordListManager** and fallback to defaults.

## Word list integration
- Source: `WORD_MANAGER_URL` (`https://wordlistmanager-production.up.railway.app` by default).
- Mapping:
  - `whowhatwhere` -> `guessing`
  - `imposter` -> `describing`
  - `drawnguess` -> `describing`
- Sync schedule: weekly on Monday at 05:00 server time.
- Manual trigger: `POST /api/words/sync`.

## Run locally
```bash
npm install
npm run dev
```
- Client: `http://localhost:5173`
- API/Socket server: `http://localhost:3000`

## Production (Railway)
- `railway.json` included for default deploy settings.
- Start command: `npm run start`.
- Health endpoint: `/api/health`.

## Docker
```bash
docker build -t rvlry .
docker run -p 3000:3000 --env-file .env rvlry
```

## Expansion model
The app uses a game metadata registry and shared room infrastructure so additional games can be added with:
1. New game metadata + route.
2. A game component in `client/src/games`.
3. Socket handlers + word source mapping in server modules.

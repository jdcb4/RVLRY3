# RVLRY

RVLRY is a mobile-first multiplayer parlor game app built with React, Vite, Express, and Socket.IO. It supports both online multiplayer and single-device pass-and-play, with shared rule engines used across the larger game flows.

## Shipped games

- **Imposter**
  Social deduction with secret roles, in-room spoken clue rounds, group discussion, and in-app voting.
- **WhoWhatWhere**
  Team-based timed clue game with rotating describers, buffered word decks, and skipped-word return flow.
- **DrawNGuess**
  Drawing-and-guessing chaos.
  Online mode uses simultaneous "books" for all players at once.
  Pass-and-play mode uses a single-device handoff flow.
- **HatGame**
  Celebrity!-style three-phase team game with editable clue packs, auto-suggestions from the `Who` list, phase rollover, and both online + pass-and-play support.

Recommended player ranges:

- Imposter: `3+ players`
- WhoWhatWhere: `4-12 players`
- DrawNGuess: `3+ players`
- HatGame: `4-12 players`

## Current product shape

- Clean central landing flow with:
  - player name
  - join-by-code
  - host-a-game flow
  - visible player-range badges before a room is created
- Online lobbies with:
  - ready states
  - live joined/required player counters near the room code
  - in-lobby "How to play" help popovers
  - team management where relevant
  - host controls
  - compact settings panels
- Pass-and-play flows with:
  - explicit handoff screens
  - hidden-information reveals
  - local setup and restart loops
- Shared game-core rules for:
  - WhoWhatWhere
  - HatGame
  - DrawNGuess
- Audio cues for:
  - turn start
  - turn end
  - five-second warning
  - handoffs
  - results
  - correct / skip in local timed team turns
  - HatGame mid-turn phase changes
- DrawNGuess drawing tools with:
  - undo
  - variable brush sizes with larger touch defaults
  - small color palette selection
- Word sync + caching through WordListManager

## Repository layout

- [client](/C:/CodingProjects/RVLRY3/client)
  React + Vite front end
- [server](/C:/CodingProjects/RVLRY3/server)
  Express + Socket.IO backend
- [shared](/C:/CodingProjects/RVLRY3/shared)
  shared game-core rule modules
- [docs](/C:/CodingProjects/RVLRY3/docs)
  planning notes, playtest notes, spoken phrase list

## Local development

Install once:

```bash
npm install
```

Run client + server together:

```bash
npm run dev
```

Useful URLs:

- Client: `http://localhost:5173`
- Server/API: `http://localhost:3001`

## Scripts

From the repo root:

```bash
npm run dev
npm run lint
npm run test
npm run build
```

Workspace-specific examples:

```bash
npm run test -w client
npm run test -w server
npm run lint -w client
npm run lint -w server
```

## Word list integration

The server syncs content from WordListManager and caches it locally for offline resilience during startup failures or upstream outages.

Optional environment variable:

```bash
WORDLIST_BASE_URL=https://wordlistmanager-production.up.railway.app
```

Relevant endpoints:

- `GET /api/words/random?type=guessing|describing`
- `GET /api/words/deck?type=guessing|describing&category=<name>&count=<n>`
- `GET /api/words/status`
- `POST /api/words/sync`
- `GET /api/rooms/:code`
- `GET /api/health`

## Deployment

Railway:

- Build command: `npm run build`
- Start command: `npm run start`

Docker:

```bash
docker build -t rvlry .
docker run -p 3001:3001 rvlry
```

## Docs

- [Implementation plan](/C:/CodingProjects/RVLRY3/docs/IMPLEMENTATION_PLAN.md)
- [Persistence plan](/C:/CodingProjects/RVLRY3/docs/PERSISTENCE_PLAN.md)
- [Playtest review](/C:/CodingProjects/RVLRY3/docs/PLAYTEST_REVIEW_JOE.md)
- [Spoken phrases](/C:/CodingProjects/RVLRY3/docs/SPOKEN_PHRASES.md)
- [Roadmap](/C:/CodingProjects/RVLRY3/Roadmap.MD)

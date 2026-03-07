# RVLRY

RVLRY is a mobile-first React + Socket.IO web app for playing parlour party games in either online multi-device mode or local pass-and-play mode.

## Included games

- **Imposter** (social deduction)
- **WhoWhatWhere** (Articulate-style describing game)
- **DrawNGuess** (Telestrations-style draw & guess game)

The architecture is intentionally modular so you can add future games without reworking the app shell.

## Tech stack

- Client: React + Vite
- Server: Express + Socket.IO
- Word syncing: WordListManager API + `node-cron`
- Deployment: Railway-friendly config and Dockerfile included

## WordListManager integration

The server syncs words from your WordListManager service:

- Base URL default: `https://wordlistmanager-production.up.railway.app`
- Guessing words (`type=guessing`) power **WhoWhatWhere**
- Describing words (`type=describing`) power **Imposter** and **DrawNGuess**
- Automatic sync schedule defaults to weekly: `0 3 * * 1` (Monday 03:00)
- Manual sync endpoint: `POST /api/words/sync`

### Environment variables

| Name | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Express + Socket.IO server port |
| `WORD_MANAGER_BASE_URL` | `https://wordlistmanager-production.up.railway.app` | Source for word lists |
| `WORD_SYNC_CRON` | `0 3 * * 1` | Cron string for periodic syncing |

## Local development

```bash
npm install
npm run dev
```

- Client runs on `http://localhost:5173`
- Server runs on `http://localhost:3000`

## Build

```bash
npm run build
```

## Railway deployment

1. Push this repo to GitHub.
2. Create a Railway service from the repo.
3. Ensure environment variables are set as desired.
4. Railway reads `railway.json` and runs the server start command.

## Docker deployment

```bash
docker build -t rvlry .
docker run -p 3000:3000 rvlry
```

## Future expansion ideas

- Persistent room + player state in Redis/Postgres
- Authenticated profiles and friend groups
- In-app drawing canvas + reveal animation workflow for DrawNGuess
- Rich round/timer control UI for WhoWhatWhere

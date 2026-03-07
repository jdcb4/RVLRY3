# RVLRY Implementation Plan

This document defines a phased implementation approach for shipping **RVLRY** as a mobile-first React + Socket.IO web app with support for online multiplayer and local pass-and-play.

## Product Goals

- Deliver a reliable launcher with three games:
  - **Imposter** (social deduction)
  - **WhoWhatWhere** (Articulate-style)
  - **DrawNGuess** (Telestrations-style)
- Support both:
  - **Multi-device online sessions** via sockets/rooms
  - **Single-device pass-and-play** where the game format allows it
- Pull words from **WordListManager** and keep content fresh via scheduled sync.
- Be deployable to **Railway** first, while remaining Docker/self-host capable.

## Technical Principles

1. **Game engine architecture:** shared room/session primitives + game-specific logic modules.
2. **Mobile-first UX:** finger-friendly controls, clear role handoff states, minimal typing friction.
3. **Server authority:** game state transitions happen on the backend to avoid desync/cheating.
4. **Extensibility:** game config registry and route-level composition for future titles.
5. **Operational readiness:** health checks, structured logs, room cleanup, sync observability.

---

## Phase 0 — Foundation Baseline (current + hardening)

### Scope
- Keep monorepo workspace structure (`client`, `server`).
- Keep Railway-compatible unified build/start scripts.
- Keep WordListManager integration + weekly sync schedule + manual sync endpoint.
- Harden room lifecycle and player/session handling.

### Deliverables
- Shared room state model with host, phase, and game-specific public/private state.
- Socket events for create/join/leave/start and game actions.
- Server-side validation for every room/game event.

---

## Phase 1 — Launcher + Online Lobby MVP

### Scope
- Build polished launcher UI with game cards and mode options.
- Build online lobby flow:
  - Create room
  - Join room by code
  - Show live roster
  - Start game (host-only)

### Deliverables
- Public room status payload (`players`, `host`, `phase`, `gameId`).
- Per-player private payload channel for secret roles/prompts.
- Error and reconnect handling.

### Acceptance Criteria
- 2+ users can join the same room and see synchronized lobby state.
- Host can start supported game and each player receives correct private info.

---

## Phase 2 — Game MVPs (online)

### 2.1 Imposter MVP
- Round setup:
  - select `describing` word from WordListManager
  - pick one imposter
  - deliver private role payload
- Core loop:
  - clue turn order
  - vote phase
  - reveal and score update

### 2.2 WhoWhatWhere MVP
- Team setup and timed turns.
- Word stream from `guessing` list.
- Actions: correct/pass/end-turn.
- Scoreboard + round progression.

### 2.3 DrawNGuess MVP
- Prompt source from `describing` list.
- Alternating draw/guess chain per round.
- Submission lock + next handoff.
- Final reveal carousel.

### Acceptance Criteria
- Each game can complete at least one full round online with synchronized state.

---

## Phase 3 — Pass-and-Play Modes

### Scope
- Device handoff UX (conceal/reveal controls).
- Player ordering + team setup on one device.
- Local state machine for each supported game mode.

### Deliverables
- Local WhoWhatWhere playable session.
- Local Imposter role reveal + vote capture flow.
- Local DrawNGuess turn handoff prototype.

---

## Phase 4 — Persistence, Reliability, and Admin

### Scope
- Optional persistence backing store (Redis/Postgres) for room snapshots.
- Better room expiry and reconnect resume.
- Admin endpoints:
  - force word sync
  - room diagnostics
  - sync status + source health

### Deliverables
- Config-driven room TTL and cleanup worker.
- Audit logs for critical room/game transitions.

---

## Phase 5 — UX Polish + Production Readiness

### Scope
- UI polish aligned with existing RVLRY style references.
- Accessibility and responsive behavior tuning.
- Error states, empty states, and offline/retry affordances.
- QA pass and release checklist.

### Deliverables
- Lighthouse/perf pass on mobile profiles.
- Final deployment docs for Railway + Docker + env vars.
- Smoke-test scripts for CI pipeline.

---

## Architecture Plan

## Client (React + Vite)
- `games/config.js`: game metadata registry.
- `components/`:
  - launcher views
  - room/lobby shell
  - per-game online screens
  - local mode screens
- `services/`:
  - socket client wrapper
  - API client for words/admin

## Server (Express + Socket.IO)
- `services/rooms.js`: room index + socket handlers.
- `services/gameEngines/`: one module per game:
  - `imposterEngine.js`
  - `whoWhatWhereEngine.js`
  - `drawNGuessEngine.js`
- `services/wordStore.js`: WordListManager sync/cache.
- `routes/words.js`: sync/status/random endpoints.

## Data Contracts (initial)

- `room:update` public payload:
  - `code`, `gameId`, `phase`, `hostId`, `players[]`, `gamePublicState`
- `game:private` private payload:
  - `gameId`, `phase`, `role`, `privatePrompt`, `playerId`

---

## WordListManager Strategy

- Source `guessing` for WhoWhatWhere.
- Source `describing` for Imposter + DrawNGuess.
- Load-on-boot + weekly cron refresh.
- Manual refresh endpoint for immediate updates.
- Fallback behavior if source unavailable:
  - keep previous cache if available
  - surface stale status in `/api/words/status`

---

## Deployment Plan

### Railway
- Build: `npm run build`
- Start: `npm run start`
- Required env:
  - `PORT`
  - `WORDLIST_BASE_URL` (optional override)

### Docker
- Keep single image deploying server + static client build.
- Expose Node port and support env configuration parity with Railway.

---

## Execution Sequence (next milestones)

1. Implement shared room state and start-game contract.
2. Ship Imposter online playable loop first (lowest complexity/high value).
3. Add WhoWhatWhere timed turn engine.
4. Add DrawNGuess chain mechanics.
5. Expand local pass-and-play parity by game.
6. Add persistence + reconnect polish.


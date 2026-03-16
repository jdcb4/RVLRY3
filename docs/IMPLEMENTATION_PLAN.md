# RVLRY Implementation Status

This document now serves as a current-state architecture and delivery summary rather than a pre-build plan. The original milestone work described here has largely been completed.

## Product status

RVLRY currently ships four games:

- **Imposter**
  - online multiplayer
  - pass-and-play
  - hybrid spoken clue rounds
  - in-app voting
- **WhoWhatWhere**
  - online multiplayer
  - pass-and-play
  - team turns
  - buffered category decks
  - skipped-word return mechanic
- **DrawNGuess**
  - online simultaneous-books mode
  - pass-and-play handoff mode
  - reveal browsing
  - reveal export
  - undo / brush size / color controls on the drawing surface
- **HatGame**
  - online multiplayer
  - pass-and-play
  - private clue collection
  - three reusable phases
  - best-turn summary

## Core implementation choices

### Shared game logic

Shared rule engines live under [shared/src/gameCore](/C:/CodingProjects/RVLRY3/shared/src/gameCore).

Current shared cores:

- [whoWhatWhere.js](/C:/CodingProjects/RVLRY3/shared/src/gameCore/whoWhatWhere.js)
- [hatGame.js](/C:/CodingProjects/RVLRY3/shared/src/gameCore/hatGame.js)
- [drawNGuess.js](/C:/CodingProjects/RVLRY3/shared/src/gameCore/drawNGuess.js)

This keeps local-mode and websocket game rules aligned.

### Server authority

The backend remains authoritative for online room state:

- room lifecycle in [rooms.js](/C:/CodingProjects/RVLRY3/server/src/services/rooms.js)
- room-specific setup policy in [roomGameRegistry.js](/C:/CodingProjects/RVLRY3/server/src/services/roomGameRegistry.js)
- game engine adapters in [server/src/services/gameEngines](/C:/CodingProjects/RVLRY3/server/src/services/gameEngines)

### Client composition

The client uses registries and per-game shells instead of one giant conditional screen:

- game metadata in [config.js](/C:/CodingProjects/RVLRY3/client/src/games/config.js)
- client game registry in [registry.js](/C:/CodingProjects/RVLRY3/client/src/games/registry.js)
- lobby modules in [client/src/play/lobby](/C:/CodingProjects/RVLRY3/client/src/play/lobby)
- gameplay modules in [client/src/play/gameplay](/C:/CodingProjects/RVLRY3/client/src/play/gameplay)
- local-mode modules in [client/src/components/local](/C:/CodingProjects/RVLRY3/client/src/components/local)

## UX principles now in place

- Mobile-first layouts
- Compact entry and lobby screens
- Player-count guidance before room creation
- Collapsible secondary information
- In-lobby rules help via popover
- Explicit hidden-information handoff screens
- Consistent team management patterns
- Minimal icon-based obvious actions where possible
- Audio support with optional spoken-phrase roadmap

## Operational status

- Word syncing and cache fallback are implemented.
- Socket room create/join/rejoin flows are implemented.
- Timed turns are implemented for the relevant games.
- Integration and UI tests are in place for the main flows.
- Persistence is still intentionally deferred.

## What is still future-facing

- Cross-instance persistence and timer ownership
- Multiplayer horizontal scaling
- In-lobby game switching
- Additional games and content systems
- Broader analytics and archival features

See:

- [PERSISTENCE_PLAN.md](/C:/CodingProjects/RVLRY3/docs/PERSISTENCE_PLAN.md)
- [Roadmap.MD](/C:/CodingProjects/RVLRY3/Roadmap.MD)

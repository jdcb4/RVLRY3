# Persistence Layer Plan

This is a planning document only. No persistence work is implemented yet.

Current non-persistence refactors are already in place:

- shared game-core rule modules
- registry-driven client game composition
- room game registry on the server
- expanded integration and UI test coverage

That means persistence can now be added onto a cleaner foundation than the original single-file approach.

## Goals

- Keep rooms alive across server restarts.
- Support multiple app instances without splitting live rooms.
- Preserve rejoin state, timers, lobby setup, and active turns.
- Reuse the new shared game core so persisted state stays deterministic.

## Recommended Shape

### 1. Add a room repository boundary

Introduce a `RoomRepository` interface between `rooms.js` and storage:

- `getRoom(code)`
- `saveRoom(room)`
- `deleteRoom(code)`
- `listExpiringRooms()`
- `claimTimer(roomCode, timerKey)`

Start by moving the current in-memory `Map` behind this interface so the room service stops depending on storage details.

### 2. Use Redis for live room state

Redis should hold the hot multiplayer state:

- room record
- players and rejoin tokens
- lobby state
- game public/private/internal state
- timer metadata

Reasons:

- fast reads and writes
- native expiry support
- good fit for ephemeral room data
- works well with the Socket.IO Redis adapter

### 3. Add the Socket.IO Redis adapter

Once room state is shared, add the Redis adapter so any instance can emit to the same room and handle reconnects safely.

### 4. Move timed turns onto claimed jobs

Current in-process `setTimeout` timers should become storage-backed jobs:

- persist `endsAt`
- on room update, enqueue or refresh the timer job
- when a worker handles expiry, it must claim the timer first
- re-load room state before applying the shared game-core action

This prevents double-ending turns when multiple instances are running.

### 5. Add Postgres only for durable history

Postgres is best kept for longer-lived data rather than hot room state:

- match summaries
- analytics
- recorded clue packs or custom decks
- moderation logs

That keeps live gameplay simple while still giving you durable reporting later.

## Data Model Notes

- Persist game state as versioned JSON snapshots keyed by room code.
- Store `gameId` and `schemaVersion` with every room.
- Keep private per-player state derivable from shared internal state where possible.
- Treat the shared game-core modules as the only place allowed to mutate rule state.

## Rollout Order

1. Extract a `RoomRepository` with the current memory store.
2. Add a Redis implementation and switch the room service to it behind a flag.
3. Add the Socket.IO Redis adapter.
4. Move timed turn expiry to claimed Redis-backed jobs.
5. Add recovery tests for restart, reconnect, and dual-instance play.
6. Add optional Postgres archiving for completed games.

## Test Coverage To Add

- restart during lobby
- restart during active timed turn
- reconnect on a different server instance
- duplicate timer claim prevention
- return-to-lobby after persisted game end
- schema migration from older stored room versions

# Joe Playtest Review

This document records the playtest notes from Joe and how they landed after review.

## Implemented from this review

### Shared / global

- Host refresh now restores host ownership when the original host rejoins with the same player token.
- The roadmap now tracks “change game inside the same online lobby” as a future feature.

### Pass-and-play

- Back navigation from active local flows returns to setup instead of jumping straight to the hub.
- Hidden-information handoffs were tightened so the next player does not flash on reveal transitions.
- Default local player naming now fills the next free `Player N` slot instead of duplicating names after removals.

### Imposter

- Minimum local player count now matches the game’s real needs.
- “Lock and pass” remains available after rehiding the screen.
- The game is now framed around spoken clue rounds instead of app-entered clue text.

### WhoWhatWhere

- Skip penalties were replaced with a return-to-skipped-word flow.
- The local describer-ready hide affordance was removed after reveal.
- Word buffering now supports continuing beyond the initial visible batch instead of behaving like 30 is a hard round cap.

### DrawNGuess

- “Play another round” rotates local player order.
- Local guesser hide controls were tightened.
- Round-length settings were added.
- Online mode was rebuilt around simultaneous books instead of a single sequential chain.

### HatGame

- “Give me suggestions” now fills blank clue slots rather than overwriting typed clues.
- Skipped-clue messaging now distinguishes between:
  - skipped clue waiting
  - back on skipped clue
- Pass-and-play clue entry is now private, phone-pass setup instead of one shared clue wall.
- Remaining clue order is randomized from the active unguessed pool.

## Suggestions that were intentionally not implemented

These items were reviewed and left as product-direction choices or explicitly ignored.

### Imposter

- Emoji restriction in clues
- Removing clue limits altogether
- Alternative tie-resolution rules beyond “imposters survive unresolved votes”

### WhoWhatWhere

- Changing auto-balance from deterministic round-robin to chunked or randomized assignment
- End-of-turn or end-of-game word review

### HatGame

- Emoji restriction in clues
- Additional spacing-only lobby polish requests

### Moderation / room controls

- Undo or reinstate kicked players

## Suggestions still worth future product input

- In-lobby game switching without rebuilding the room
- Whether WhoWhatWhere should later expose a recap or review mode
- Whether Imposter vote ties should keep the current behavior permanently or adopt a custom house-rule option
- Whether removed players should have a softer block model in private/friendly rooms

## Notes that were not clearly reproducible

- VPN / browser-specific online registration issues
- One-off HatGame clue-save glitch that resolved on refresh
- Older reports about DrawNGuess returning to lobby mid-round

Those were treated as watch-list items rather than confirmed bugs because they did not have a stable reproduction path.

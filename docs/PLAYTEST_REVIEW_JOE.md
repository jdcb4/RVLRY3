# Joe Playtest Review

## Implemented now

- Imposter pass-and-play role reveals no longer leave the "Lock and pass" action stranded after hiding the screen, and the reveal action now hides before advancing to avoid exposing the next player's secret.
- Pass-and-play back navigation now returns from an active round to setup first, instead of jumping straight back to the hub.
- Local add-player naming now fills the next open `Player N` slot instead of creating duplicates after removals.
- Local Imposter now requires at least 3 players in setup and start validation, matching the actual gameplay needs better than the old 2-player allowance.
- Local DrawNGuess now rotates the player order on "Play another round" so the same people are not stuck drawing or guessing first every time.
- HatGame "Give me suggestions" now fills blank clue slots first instead of overwriting clues the player already typed, in both online and pass-and-play flows.
- Online room rejoin now restores host ownership when the original host refreshes and comes back with the same player token.
- HatGame skipped-clue messaging now distinguishes between "a skipped clue is waiting" and "you are back on the skipped clue", instead of always exposing or implying the same state.

## Needs your call

### Imposter

- Tie resolution:
  Right now any tie means the imposter survives. That is internally consistent, but if you want "crew tie without the imposter involved" to resolve differently, that is a rules change rather than a bug fix.
- Clue restrictions:
  Requests to block emojis or remove clue length limits are game-design choices. At the moment the app permits normal Unicode text and has a local clue length cap.
- Clue feed default open state:
  Reasonable UX improvement, but it is preference/presentation rather than correctness.

### WhoWhatWhere

- Auto-balance randomness:
  The current behavior is deterministic round-robin balancing. Changing it to chunked or randomized distributions is a product choice.
- Returning to skipped words:
  Adding a HatGame-style "return to skipped word" mechanic would materially change the turn flow and scoring rhythm.
- End-of-turn or end-of-game word review:
  Useful feature, but it adds recap UI and possibly more persisted turn data.
- 30-word round cap:
  Worth confirming whether that cap is intentional or whether you want rounds to end only on timer/turn completion.
- Hide-screen affordance after the describer is revealed:
  This reads more like UI tightening than a bug, and could be standardized across pass-and-play screens if you want it changed.

### DrawNGuess

- Lobby options for timers/rounds:
  That is feature expansion rather than a bug fix. Current DrawNGuess is still a single-chain round.
- Guesser hide-screen controls:
  Similar to the WhoWhatWhere note above, this is mainly a UI pattern decision.

### HatGame

- Emoji restriction in clues:
  This is a content-policy choice. Blocking emoji/personality symbols may reduce abuse, but it also removes harmless expressive entries.
- Re-shuffling when phases restart:
  The playtester felt the list became predictable with a small clue pool. If you want stronger unpredictability, we can make the re-phase shuffle more visibly varied or avoid repeating recent order.
- Round/turn progress on the gameplay screen:
  This is a legitimate enhancement, but it needs a design choice about whether to show "team turn number", "phase progress", "round count", or all three.
- Extra spacing around HatGame clue actions:
  This is UI polish rather than a correctness issue.

### Global / Online flow

- Change game from within the same online lobby:
  Valuable feature, but it is a product/workflow expansion with backend implications for room reset, settings migration, and player consent.
- Undo / reinstate kicked players:
  The current permanent block is intentional for safety. Supporting reversal would need a host-managed removed-player list or a scoped temporary kick model.

## Not clearly reproducible yet

- VPN / refresh / browser registration issues in online rooms:
  The notes strongly point to host-network conditions rather than a stable app bug. Worth retesting without VPN before spending engineering time here.
- DrawNGuess "end of round goes to lobby instead":
  I do not yet have a reproducible path from the notes alone.
- HatGame "save clues would not register" one-off:
  Since it was not reproducible and a refresh fixed it, I would treat this as watch-list material unless it happens again.
- HatGame player rejoining into Team 1:
  The current room rejoin code already tries to preserve team membership. If this happens again, I would want exact steps, especially whether team counts changed before the rejoin.
- Imposter "no character limit on clue":
  Current local clue entry already has a length limit, so this may have been observed in a different context or before a recent change.

export const games = [
  {
    id: 'imposter',
    name: 'Imposter',
    tagline: 'Read the room before the room reads you.',
    description: 'One player has no word. Everyone else does. Bluff, accuse, and survive the vote.',
    playerRangeLabel: '3+ players',
    howToPlay: [
      'Create a room, share the code, and wait until everyone is ready.',
      'Each crew player receives the same word. The imposter receives no word at all.',
      'Take turns saying one word out loud in the room, then discuss together before voting in the app.'
    ],
    minPlayers: 3,
    supportsLocal: true,
    lobbyFeatures: ['ready-check', 'invite-link', 'host-start'],
    gameplayView: 'imposter'
  },
  {
    id: 'whowhatwhere',
    name: 'WhoWhatWhere',
    tagline: 'Articulate-style team rounds, simplified for phones.',
    description: 'Auto-balanced teams race the clock, with a fresh category chosen at the start of every turn.',
    playerRangeLabel: '4-12 players',
    howToPlay: [
      'The host chooses 2, 3, or 4 teams. Players are assigned automatically to the smallest team as they join.',
      'One describer starts a timed turn while teammates guess out loud from their own phones or around the same device.',
      'Each turn picks a random category, and every word in that turn comes from that category.'
    ],
    minPlayers: 4,
    supportsLocal: true,
    lobbyFeatures: ['team-select', 'ready-check', 'invite-link', 'host-start'],
    gameplayView: 'whowhatwhere',
    teamBased: true
  },
  {
    id: 'drawnguess',
    name: 'DrawNGuess',
    tagline: 'Sketch chaos into something guessable.',
    description: 'Pass drawings and prompts around the room, then watch the chain drift sideways.',
    playerRangeLabel: '3+ players',
    howToPlay: [
      'Build a room, bring everyone in, and use the lobby to confirm who is playing.',
      'Online rooms run simultaneous books so everyone draws or guesses at the same time.',
      'Each starting word becomes its own reveal chain you can browse and export at the end.'
    ],
    minPlayers: 3,
    supportsLocal: true,
    lobbyFeatures: ['ready-check', 'invite-link', 'host-start'],
    gameplayView: 'drawnguess'
  },
  {
    id: 'hatgame',
    name: 'HatGame',
    tagline: 'Three phases, one shared clue pool, escalating chaos.',
    description: 'Celebrity!-style team rounds where the same people return for describe, one-word, and charades phases.',
    playerRangeLabel: '4-12 players',
    howToPlay: [
      'Split into 2 to 4 teams, then have each player submit a set of person-name clues.',
      'Phase 1 allows full descriptions, Phase 2 limits you to one word, and Phase 3 is silent charades.',
      'The same clue pool resets each phase, so memorable clues early pay off later.'
    ],
    minPlayers: 4,
    supportsLocal: true,
    lobbyFeatures: ['team-select', 'clue-submit', 'ready-check', 'invite-link', 'host-start'],
    gameplayView: 'hatgame',
    teamBased: true
  }
];

export const getGameById = (id) => games.find((game) => game.id === id);

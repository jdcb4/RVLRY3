export const games = [
  {
    id: 'imposter',
    name: 'Imposter',
    tagline: 'Read the room before the room reads you.',
    description: 'One player has no word. Everyone else does. Bluff, accuse, and survive the vote.',
    howToPlay: [
      'Create a room, share the code, and wait until everyone is ready.',
      'Each crew player receives the same word. The imposter receives no word at all.',
      'Take turns giving clues without making the answer obvious.'
    ],
    minPlayers: 2,
    supportsLocal: true,
    lobbyFeatures: ['ready-check', 'invite-link', 'host-start'],
    gameplayView: 'imposter'
  },
  {
    id: 'whowhatwhere',
    name: 'WhoWhatWhere',
    tagline: 'Fast clues, faster guesses.',
    description: 'Race through prompt rounds by describing clearly and keeping the room moving.',
    howToPlay: [
      'Join the room and mark yourself ready before the host starts.',
      'Players describe a hidden prompt while the room calls out guesses.',
      'Track correct guesses, skips, and momentum as the round unfolds.'
    ],
    minPlayers: 2,
    supportsLocal: true,
    lobbyFeatures: ['ready-check', 'invite-link', 'host-start'],
    gameplayView: 'whowhatwhere'
  },
  {
    id: 'drawnguess',
    name: 'DrawNGuess',
    tagline: 'Sketch chaos into something guessable.',
    description: 'Pass drawings and prompts around the room, then watch the chain drift sideways.',
    howToPlay: [
      'Build a room, bring everyone in, and use the lobby to confirm who is playing.',
      'Players sketch, pass, and interpret prompts one round at a time.',
      'The active prompt and chain progress stay visible during play.'
    ],
    minPlayers: 2,
    supportsLocal: true,
    lobbyFeatures: ['ready-check', 'invite-link', 'host-start'],
    gameplayView: 'drawnguess'
  }
];

export const getGameById = (id) => games.find((game) => game.id === id);

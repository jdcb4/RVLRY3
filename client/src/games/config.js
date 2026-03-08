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
    tagline: 'Articulate-style team rounds, built for phones.',
    description: 'Split into teams, rotate the describer, and race the clock to land as many words as you can.',
    howToPlay: [
      'Join a team in the lobby, rename teams if you want, and get everyone ready.',
      'One describer starts a timed turn while teammates guess out loud from their own phones or around the same device.',
      'Each team gets one turn per round. Correct answers add points, and extra skips cost points.'
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

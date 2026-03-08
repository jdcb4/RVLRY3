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
    tagline: 'Articulate-style team rounds, simplified for phones.',
    description: 'Auto-balanced teams race the clock, with a fresh category chosen at the start of every turn.',
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

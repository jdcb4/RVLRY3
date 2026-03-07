export const games = [
  {
    id: 'imposter',
    name: 'Imposter',
    description: 'Find the imposter before they blend in.',
    supportsLocal: true
  },
  {
    id: 'whowhatwhere',
    name: 'WhoWhatWhere',
    description: 'Describe and guess words against the clock.',
    supportsLocal: true
  },
  {
    id: 'drawnguess',
    name: 'DrawNGuess',
    description: 'Sketch, pass, and laugh at the final reveal.',
    supportsLocal: true
  }
];

export const getGameById = (id) => games.find((game) => game.id === id);

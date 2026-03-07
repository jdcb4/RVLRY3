export const GAME_TYPES = {
  IMPOSTER: 'imposter',
  WHOWHATWHERE: 'whowhatwhere',
  DRAWNGUESS: 'drawnguess',
};

export const GAME_METADATA = {
  [GAME_TYPES.IMPOSTER]: {
    name: 'Imposter',
    description: 'One player is the imposter and must blend in.',
    modes: ['online'],
  },
  [GAME_TYPES.WHOWHATWHERE]: {
    name: 'WhoWhatWhere',
    description: 'Fast-paced clue game inspired by Articulate!',
    modes: ['online', 'pass-and-play'],
  },
  [GAME_TYPES.DRAWNGUESS]: {
    name: 'DrawNGuess',
    description: 'Telephone Pictionary for groups.',
    modes: ['online'],
  },
};

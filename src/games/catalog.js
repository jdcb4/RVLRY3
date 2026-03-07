export const GAME_MODES = {
  SOCKET: 'socket',
  PASS_AND_PLAY: 'pass-and-play',
};

export const gameCatalog = [
  {
    id: 'imposter',
    title: 'Imposter',
    summary: 'Find the player who does not know the secret word.',
    wordType: 'describing',
    supportedModes: [GAME_MODES.SOCKET],
  },
  {
    id: 'whowhatwhere',
    title: 'WhoWhatWhere',
    summary: 'Describe terms quickly while teammates guess.',
    wordType: 'guessing',
    supportedModes: [GAME_MODES.SOCKET, GAME_MODES.PASS_AND_PLAY],
  },
  {
    id: 'drawnguess',
    title: 'DrawNGuess',
    summary: 'Pass drawings and guesses in a hilarious chain.',
    wordType: 'describing',
    supportedModes: [GAME_MODES.SOCKET],
  },
];

export function getGameById(gameId) {
  return gameCatalog.find((game) => game.id === gameId);
}

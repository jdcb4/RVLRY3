const GAME_WORD_TYPE = {
  imposter: 'describing',
  whowhatwhere: 'guessing',
  drawnguess: 'describing'
};

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const buildImposterState = ({ players, word }) => {
  const imposter = randomItem(players);
  const privateState = new Map(
    players.map((player) => [
      player.id,
      {
        role: player.id === imposter.id ? 'imposter' : 'crew',
        word: player.id === imposter.id ? null : word
      }
    ])
  );

  return {
    publicState: {
      status: 'round-active',
      clueCount: 0
    },
    privateState
  };
};

const buildWhoWhatWhereState = ({ word }) => ({
  publicState: {
    status: 'round-active',
    currentWordLength: word.length,
    guessed: 0,
    skipped: 0
  },
  privateState: new Map()
});

const buildDrawNGuessState = ({ word, players }) => ({
  publicState: {
    status: 'round-active',
    submissions: 0,
    chainLength: players.length,
    activePrompt: word
  },
  privateState: new Map()
});

const GAME_BUILDERS = {
  imposter: buildImposterState,
  whowhatwhere: buildWhoWhatWhereState,
  drawnguess: buildDrawNGuessState
};

export function getWordTypeForGame(gameId) {
  return GAME_WORD_TYPE[gameId] ?? 'describing';
}

export function buildGameStartState({ gameId, players, word }) {
  const builder = GAME_BUILDERS[gameId];
  if (!builder) {
    return {
      publicState: { status: 'not-configured' },
      privateState: new Map()
    };
  }

  return builder({ players, word });
}

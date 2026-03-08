const GAME_WORD_TYPE = {
  imposter: 'describing',
  whowhatwhere: 'guessing',
  drawnguess: 'describing'
};

const GAME_MIN_PLAYERS = {
  imposter: 2,
  whowhatwhere: 2,
  drawnguess: 2
};

const MAX_CLUE_LENGTH = 120;
const MAX_GUESS_LENGTH = 100;
const MAX_DRAWING_DATA_URL_LENGTH = 800_000;

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const buildPrivateState = (players, mapper) => new Map(players.map((player) => [player.id, mapper(player)]));
const normalizeText = (value) => String(value ?? '').trim();
const getPlayerIds = (players) => players.map((player) => player.id);
const hasPlayer = (players, playerId) => players.some((player) => player.id === playerId);

const buildImposterPrivateState = (players, publicState, internalState) =>
  buildPrivateState(players, (player) => ({
    role: player.id === internalState.imposterId ? 'imposter' : 'crew',
    word: player.id === internalState.imposterId ? null : internalState.word,
    canClue: publicState.stage === 'clues' && publicState.currentTurnPlayerId === player.id,
    canVote: publicState.stage === 'voting' && !internalState.votes[player.id],
    hasVoted: Boolean(internalState.votes[player.id]),
    votedForPlayerId: internalState.votes[player.id] ?? null
  }));

const buildWhoWhatWherePrivateState = (players, publicState, internalState) =>
  buildPrivateState(players, (player) => ({
    role: publicState.stage === 'turn' && publicState.activePlayerId === player.id ? 'describer' : 'guesser',
    isActive: publicState.stage === 'turn' && publicState.activePlayerId === player.id,
    canResolve: publicState.stage === 'turn' && publicState.activePlayerId === player.id,
    word: publicState.stage === 'turn' && publicState.activePlayerId === player.id ? internalState.currentWord : null
  }));

const buildDrawNGuessPrivateState = (players, publicState, internalState) => {
  if (publicState.stage === 'results') {
    return buildPrivateState(players, () => ({
      mode: 'results',
      isActive: false,
      prompt: null,
      drawing: null,
      canSubmit: false
    }));
  }

  const previousEntry = internalState.chain.at(-1);

  return buildPrivateState(players, (player) => {
    if (player.id !== publicState.activePlayerId) {
      return {
        mode: 'wait',
        isActive: false,
        prompt: null,
        drawing: null,
        canSubmit: false
      };
    }

    if (publicState.stage === 'draw') {
      return {
        mode: 'draw',
        isActive: true,
        prompt: previousEntry?.type === 'prompt' || previousEntry?.type === 'guess' ? previousEntry.text : null,
        drawing: null,
        canSubmit: true
      };
    }

    return {
      mode: 'guess',
      isActive: true,
      prompt: null,
      drawing: previousEntry?.type === 'drawing' ? previousEntry.imageData : null,
      canSubmit: true
    };
  });
};

const buildImposterState = ({ players, word }) => {
  const turnOrder = getPlayerIds(players);
  const imposter = randomItem(players);
  const publicState = {
    status: 'round-active',
    stage: 'clues',
    clueCount: 0,
    clues: [],
    currentTurnPlayerId: turnOrder[0] ?? null,
    turnIndex: 0,
    totalTurns: turnOrder.length,
    votesSubmitted: 0,
    results: null
  };
  const internalState = {
    word,
    imposterId: imposter.id,
    turnOrder,
    votes: {}
  };

  return {
    publicState,
    privateState: buildImposterPrivateState(players, publicState, internalState),
    internalState
  };
};

const buildWhoWhatWhereState = ({ players, word }) => {
  const turnOrder = getPlayerIds(players);
  const publicState = {
    status: 'round-active',
    stage: 'turn',
    activePlayerId: turnOrder[0] ?? null,
    turnNumber: 1,
    totalTurns: turnOrder.length,
    currentWordLength: word.length,
    guessed: 0,
    skipped: 0,
    turnSummary: [],
    results: null
  };
  const internalState = {
    turnOrder,
    turnIndex: 0,
    currentWord: word,
    turnResults: []
  };

  return {
    publicState,
    privateState: buildWhoWhatWherePrivateState(players, publicState, internalState),
    internalState
  };
};

const buildDrawNGuessState = ({ players, word }) => {
  const turnOrder = getPlayerIds(players);
  const publicState = {
    status: 'round-active',
    stage: 'draw',
    activePlayerId: turnOrder[0] ?? null,
    stageNumber: 1,
    totalStages: turnOrder.length,
    submissions: 0,
    promptLength: word.length,
    results: null
  };
  const internalState = {
    turnOrder,
    stageIndex: 0,
    chain: [{ type: 'prompt', text: word, submittedBy: null }]
  };

  return {
    publicState,
    privateState: buildDrawNGuessPrivateState(players, publicState, internalState),
    internalState
  };
};

const GAME_BUILDERS = {
  imposter: buildImposterState,
  whowhatwhere: buildWhoWhatWhereState,
  drawnguess: buildDrawNGuessState
};

function applyImposterAction({ players, playerId, action, publicState, internalState }) {
  if (action.type === 'submit-clue') {
    if (publicState.stage !== 'clues') {
      return { error: 'Clues are no longer being collected' };
    }

    if (publicState.currentTurnPlayerId !== playerId) {
      return { error: 'It is not your turn to submit a clue' };
    }

    const clue = normalizeText(action.payload?.text);
    if (!clue) {
      return { error: 'Enter a clue before submitting' };
    }

    if (clue.length > MAX_CLUE_LENGTH) {
      return { error: `Clues must be ${MAX_CLUE_LENGTH} characters or fewer` };
    }

    const nextTurnIndex = publicState.turnIndex + 1;
    const clues = [...publicState.clues, { playerId, text: clue }];
    const nextPublicState =
      nextTurnIndex < internalState.turnOrder.length
        ? {
            ...publicState,
            clueCount: clues.length,
            clues,
            currentTurnPlayerId: internalState.turnOrder[nextTurnIndex],
            turnIndex: nextTurnIndex
          }
        : {
            ...publicState,
            clueCount: clues.length,
            clues,
            stage: 'voting',
            currentTurnPlayerId: null,
            turnIndex: nextTurnIndex,
            votesSubmitted: 0
          };

    return {
      publicState: nextPublicState,
      privateState: buildImposterPrivateState(players, nextPublicState, internalState),
      internalState
    };
  }

  if (action.type === 'cast-vote') {
    if (publicState.stage !== 'voting') {
      return { error: 'Voting is not active right now' };
    }

    if (internalState.votes[playerId]) {
      return { error: 'You have already voted' };
    }

    const targetPlayerId = action.payload?.targetPlayerId;
    if (!hasPlayer(players, targetPlayerId)) {
      return { error: 'Select a valid player to accuse' };
    }

    if (targetPlayerId === playerId) {
      return { error: 'You cannot vote for yourself' };
    }

    const votes = { ...internalState.votes, [playerId]: targetPlayerId };
    const votesSubmitted = Object.keys(votes).length;
    const nextInternalState = { ...internalState, votes };

    if (votesSubmitted < players.length) {
      const nextPublicState = {
        ...publicState,
        votesSubmitted
      };

      return {
        publicState: nextPublicState,
        privateState: buildImposterPrivateState(players, nextPublicState, nextInternalState),
        internalState: nextInternalState
      };
    }

    const voteCounts = players.reduce((counts, player) => {
      counts[player.id] = 0;
      return counts;
    }, {});

    for (const targetId of Object.values(votes)) {
      voteCounts[targetId] += 1;
    }

    const highestVoteCount = Math.max(...Object.values(voteCounts));
    const leadingPlayers = Object.entries(voteCounts)
      .filter(([, count]) => count === highestVoteCount)
      .map(([targetId]) => targetId);
    const accusedPlayerId = leadingPlayers.length === 1 ? leadingPlayers[0] : null;
    const crewWon = accusedPlayerId === internalState.imposterId;
    const nextPublicState = {
      ...publicState,
      stage: 'results',
      status: 'round-complete',
      votesSubmitted,
      results: {
        outcome: crewWon ? 'crew' : 'imposter',
        reason:
          accusedPlayerId === null
            ? 'The room tied its vote, so the imposter escaped.'
            : crewWon
              ? 'The room identified the imposter.'
              : 'The room accused the wrong player.',
        imposterId: internalState.imposterId,
        secretWord: internalState.word,
        accusedPlayerId,
        voteTally: players.map((player) => ({
          playerId: player.id,
          votes: voteCounts[player.id] ?? 0
        })),
        votes: Object.entries(votes).map(([voterId, targetId]) => ({
          voterId,
          targetId
        }))
      }
    };

    return {
      publicState: nextPublicState,
      privateState: buildImposterPrivateState(players, nextPublicState, nextInternalState),
      internalState: nextInternalState
    };
  }

  return { error: 'Unknown action for Imposter' };
}

function applyWhoWhatWhereAction({ players, playerId, action, publicState, internalState, wordStore }) {
  if (!['mark-guessed', 'mark-skipped'].includes(action.type)) {
    return { error: 'Unknown action for WhoWhatWhere' };
  }

  if (publicState.stage !== 'turn') {
    return { error: 'The round has already ended' };
  }

  if (publicState.activePlayerId !== playerId) {
    return { error: 'Only the active describer can resolve this turn' };
  }

  const didGuess = action.type === 'mark-guessed';
  const nextTurnIndex = internalState.turnIndex + 1;
  const turnResult = {
    playerId,
    outcome: didGuess ? 'guessed' : 'skipped',
    word: internalState.currentWord
  };
  const guessed = publicState.guessed + (didGuess ? 1 : 0);
  const skipped = publicState.skipped + (didGuess ? 0 : 1);
  const turnSummary = [
    ...publicState.turnSummary,
    {
      playerId,
      outcome: turnResult.outcome,
      wordLength: internalState.currentWord.length
    }
  ];
  const turnResults = [...internalState.turnResults, turnResult];

  if (nextTurnIndex >= internalState.turnOrder.length) {
    const nextPublicState = {
      ...publicState,
      status: 'round-complete',
      stage: 'results',
      guessed,
      skipped,
      turnSummary,
      results: {
        guessed,
        skipped,
        turns: turnResults
      },
      activePlayerId: null
    };
    const nextInternalState = {
      ...internalState,
      turnIndex: nextTurnIndex,
      turnResults
    };

    return {
      publicState: nextPublicState,
      privateState: buildWhoWhatWherePrivateState(players, nextPublicState, nextInternalState),
      internalState: nextInternalState
    };
  }

  const nextWord = wordStore.getRandomWord(GAME_WORD_TYPE.whowhatwhere);
  if (!nextWord) {
    return { error: 'Unable to load the next prompt yet' };
  }

  const nextPublicState = {
    ...publicState,
    guessed,
    skipped,
    turnSummary,
    activePlayerId: internalState.turnOrder[nextTurnIndex],
    turnNumber: nextTurnIndex + 1,
    currentWordLength: nextWord.length
  };
  const nextInternalState = {
    ...internalState,
    turnIndex: nextTurnIndex,
    currentWord: nextWord,
    turnResults
  };

  return {
    publicState: nextPublicState,
    privateState: buildWhoWhatWherePrivateState(players, nextPublicState, nextInternalState),
    internalState: nextInternalState
  };
}

function applyDrawNGuessAction({ players, playerId, action, publicState, internalState }) {
  const isActivePlayer = publicState.activePlayerId === playerId;
  if (!isActivePlayer) {
    return { error: 'Only the active player can submit for this stage' };
  }

  if (action.type === 'submit-drawing') {
    if (publicState.stage !== 'draw') {
      return { error: 'The current stage is not a drawing stage' };
    }

    const imageData = String(action.payload?.imageData ?? '');
    if (!imageData.startsWith('data:image/')) {
      return { error: 'Submit a drawing before continuing' };
    }

    if (imageData.length > MAX_DRAWING_DATA_URL_LENGTH) {
      return { error: 'That drawing is too large to send' };
    }

    const chain = [...internalState.chain, { type: 'drawing', imageData, submittedBy: playerId }];
    return advanceDrawNGuessState({ players, publicState, internalState, chain });
  }

  if (action.type === 'submit-guess') {
    if (publicState.stage !== 'guess') {
      return { error: 'The current stage is not a guessing stage' };
    }

    const text = normalizeText(action.payload?.text);
    if (!text) {
      return { error: 'Enter a guess before continuing' };
    }

    if (text.length > MAX_GUESS_LENGTH) {
      return { error: `Guesses must be ${MAX_GUESS_LENGTH} characters or fewer` };
    }

    const chain = [...internalState.chain, { type: 'guess', text, submittedBy: playerId }];
    return advanceDrawNGuessState({ players, publicState, internalState, chain });
  }

  return { error: 'Unknown action for DrawNGuess' };
}

function advanceDrawNGuessState({ players, publicState, internalState, chain }) {
  const nextStageIndex = internalState.stageIndex + 1;
  const submissions = publicState.submissions + 1;

  if (nextStageIndex >= internalState.turnOrder.length) {
    const nextPublicState = {
      ...publicState,
      status: 'round-complete',
      stage: 'results',
      submissions,
      activePlayerId: null,
      results: {
        chain
      }
    };
    const nextInternalState = {
      ...internalState,
      stageIndex: nextStageIndex,
      chain
    };

    return {
      publicState: nextPublicState,
      privateState: buildDrawNGuessPrivateState(players, nextPublicState, nextInternalState),
      internalState: nextInternalState
    };
  }

  const nextStage = nextStageIndex % 2 === 0 ? 'draw' : 'guess';
  const nextPublicState = {
    ...publicState,
    stage: nextStage,
    activePlayerId: internalState.turnOrder[nextStageIndex],
    stageNumber: nextStageIndex + 1,
    submissions
  };
  const nextInternalState = {
    ...internalState,
    stageIndex: nextStageIndex,
    chain
  };

  return {
    publicState: nextPublicState,
    privateState: buildDrawNGuessPrivateState(players, nextPublicState, nextInternalState),
    internalState: nextInternalState
  };
}

const GAME_ACTION_HANDLERS = {
  imposter: applyImposterAction,
  whowhatwhere: applyWhoWhatWhereAction,
  drawnguess: applyDrawNGuessAction
};

export function getWordTypeForGame(gameId) {
  return GAME_WORD_TYPE[gameId] ?? 'describing';
}

export function getMinPlayersForGame(gameId) {
  return GAME_MIN_PLAYERS[gameId] ?? 2;
}

export function buildGameStartState({ gameId, players, word }) {
  const builder = GAME_BUILDERS[gameId];
  if (!builder) {
    return {
      publicState: { status: 'not-configured' },
      privateState: new Map(),
      internalState: {}
    };
  }

  return builder({ players, word });
}

export function applyGameAction({ gameId, players, playerId, action, publicState, privateState, internalState, wordStore }) {
  const handler = GAME_ACTION_HANDLERS[gameId];
  if (!handler) {
    return { error: 'This game is not configured for gameplay yet' };
  }

  return handler({
    players,
    playerId,
    action,
    publicState,
    privateState,
    internalState,
    wordStore
  });
}

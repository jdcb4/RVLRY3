import { normalizeText } from './teamUtils.js';

const getSimultaneousRoundModes = (playerCount) => {
  const rounds = [];
  const totalRounds = Math.max(playerCount - 1, 1);

  if (playerCount % 2 === 1) {
    rounds.push('pass');
  }

  let nextMode = 'draw';
  while (rounds.length < totalRounds) {
    rounds.push(nextMode);
    nextMode = nextMode === 'draw' ? 'guess' : 'draw';
  }

  return rounds;
};

const getAssignedBookIndex = (playerIndex, roundIndex, playerCount) =>
  ((playerIndex - roundIndex) % playerCount + playerCount) % playerCount;

const getLatestBookEntry = (book) => book.entries.at(-1) ?? null;

const createSequentialDrawNGuessGame = ({ players, prompt, settings = {} }) => ({
  mode: 'sequential',
  settings,
  prompt,
  stage: 'draw',
  stageIndex: 0,
  activePlayerId: players[0]?.id ?? null,
  stageNumber: 1,
  totalStages: players.length,
  submissions: 0,
  chain: [{ type: 'prompt', text: prompt, submittedBy: null }],
  results: null
});

const createSimultaneousDrawNGuessGame = ({ players, prompts, settings = {} }) => ({
  mode: 'simultaneous',
  settings,
  stage: 'round',
  roundIndex: 0,
  roundModes: getSimultaneousRoundModes(players.length),
  totalRounds: Math.max(players.length - 1, 1),
  submittedPlayerIds: [],
  roundSubmissions: {},
  books: players.map((player, index) => ({
    id: `book-${player.id}`,
    originPlayerId: player.id,
    ownerSeat: index,
    prompt: prompts[index],
    entries: [{ type: 'prompt', text: prompts[index], submittedBy: null }]
  })),
  results: null
});

export const createDrawNGuessGame = ({
  players,
  prompt = '',
  prompts = [],
  settings = {}
}) => {
  if (settings.mode === 'simultaneous') {
    const promptList =
      prompts.length > 0
        ? prompts
        : players.map((_, index) => `${prompt || 'Prompt'} ${index + 1}`);
    return createSimultaneousDrawNGuessGame({ players, prompts: promptList, settings });
  }

  return createSequentialDrawNGuessGame({ players, prompt, settings });
};

const advanceSequentialDrawNGuessState = (game, players, chain) => {
  const nextStageIndex = game.stageIndex + 1;
  const submissions = game.submissions + 1;

  if (nextStageIndex >= players.length) {
    return {
      ...game,
      stage: 'results',
      stageIndex: nextStageIndex,
      submissions,
      activePlayerId: null,
      chain,
      results: {
        chain
      }
    };
  }

  return {
    ...game,
    stage: nextStageIndex % 2 === 0 ? 'draw' : 'guess',
    stageIndex: nextStageIndex,
    activePlayerId: players[nextStageIndex]?.id ?? null,
    stageNumber: nextStageIndex + 1,
    submissions,
    chain
  };
};

const applySequentialDrawNGuessAction = (
  game,
  {
    players,
    action,
    actorId = null,
    maxGuessLength = 100,
    maxDrawingLength = 800_000
  }
) => {
  if (actorId && game.activePlayerId !== actorId) {
    return { error: 'Only the active player can submit for this stage' };
  }

  if (action.type === 'submit-drawing') {
    if (game.stage !== 'draw') {
      return { error: 'The current stage is not a drawing stage' };
    }

    const imageData = String(action.payload?.imageData ?? '');
    if (!imageData.startsWith('data:image/')) {
      return { error: 'Submit a drawing before continuing' };
    }

    if (imageData.length > maxDrawingLength) {
      return { error: 'That drawing is too large to send' };
    }

    return advanceSequentialDrawNGuessState(game, players, [
      ...game.chain,
      { type: 'drawing', imageData, submittedBy: game.activePlayerId }
    ]);
  }

  if (action.type === 'submit-guess') {
    if (game.stage !== 'guess') {
      return { error: 'The current stage is not a guessing stage' };
    }

    const text = normalizeText(action.payload?.text);
    if (!text) {
      return { error: 'Enter a guess before continuing' };
    }

    if (text.length > maxGuessLength) {
      return { error: `Guesses must be ${maxGuessLength} characters or fewer` };
    }

    return advanceSequentialDrawNGuessState(game, players, [
      ...game.chain,
      { type: 'guess', text, submittedBy: game.activePlayerId }
    ]);
  }

  return { error: 'Unknown action for DrawNGuess' };
};

const applySimultaneousRoundSubmission = ({
  game,
  players,
  action,
  actorId = null,
  maxGuessLength = 100,
  maxDrawingLength = 800_000
}) => {
  if (game.stage !== 'round') {
    return { error: 'The round is already complete' };
  }

  const playerIndex = players.findIndex((player) => player.id === actorId);
  if (playerIndex < 0) {
    return { error: 'Player not found for this round' };
  }

  if (game.submittedPlayerIds.includes(actorId)) {
    return { error: 'You have already submitted this round' };
  }

  const roundMode = game.roundModes[game.roundIndex];
  if (roundMode === 'pass' && action.type !== 'pass-book') {
    return { error: 'This round only needs a pass acknowledgement' };
  }

  if (roundMode === 'draw') {
    if (action.type !== 'submit-drawing') {
      return { error: 'This round needs a drawing submission' };
    }

    const imageData = String(action.payload?.imageData ?? '');
    if (!imageData.startsWith('data:image/')) {
      return { error: 'Submit a drawing before continuing' };
    }

    if (imageData.length > maxDrawingLength) {
      return { error: 'That drawing is too large to send' };
    }
  }

  if (roundMode === 'guess') {
    if (action.type !== 'submit-guess') {
      return { error: 'This round needs a guess submission' };
    }

    const text = normalizeText(action.payload?.text);
    if (!text) {
      return { error: 'Enter a guess before continuing' };
    }

    if (text.length > maxGuessLength) {
      return { error: `Guesses must be ${maxGuessLength} characters or fewer` };
    }
  }

  const roundSubmissions = {
    ...(game.roundSubmissions ?? {}),
    [actorId]:
      roundMode === 'draw'
        ? { type: 'drawing', imageData: action.payload.imageData }
        : roundMode === 'guess'
          ? { type: 'guess', text: normalizeText(action.payload?.text) }
          : { type: 'pass' }
  };
  const submittedPlayerIds = [...game.submittedPlayerIds, actorId];

  if (submittedPlayerIds.length < players.length) {
    return {
      ...game,
      roundSubmissions,
      submittedPlayerIds
    };
  }

  const books = game.books.map((book) => ({
    ...book,
    entries: [...book.entries]
  }));

  players.forEach((player, currentPlayerIndex) => {
    const bookIndex = getAssignedBookIndex(currentPlayerIndex, game.roundIndex, players.length);
    const submission = roundSubmissions[player.id];
    if (!submission || submission.type === 'pass') {
      return;
    }

    books[bookIndex].entries.push({
      type: submission.type,
      text: submission.text,
      imageData: submission.imageData,
      submittedBy: player.id
    });
  });

  const nextRoundIndex = game.roundIndex + 1;
  if (nextRoundIndex >= game.roundModes.length) {
    return {
      ...game,
      stage: 'results',
      roundIndex: nextRoundIndex,
      submittedPlayerIds,
      roundSubmissions: {},
      books,
      results: {
        books
      }
    };
  }

  return {
    ...game,
    roundIndex: nextRoundIndex,
    books,
    submittedPlayerIds: [],
    roundSubmissions: {}
  };
};

export const applyDrawNGuessAction = (game, options) => {
  if (game.mode === 'simultaneous') {
    return applySimultaneousRoundSubmission({
      game,
      ...options
    });
  }

  return applySequentialDrawNGuessAction(game, options);
};

export const getDrawNGuessRoundMeta = (game, players, playerId) => {
  if (game.mode !== 'simultaneous' || game.stage !== 'round') {
    return null;
  }

  const playerIndex = players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0) {
    return null;
  }

  const roundMode = game.roundModes[game.roundIndex];
  const bookIndex = getAssignedBookIndex(playerIndex, game.roundIndex, players.length);
  const book = game.books[bookIndex];
  const latestEntry = getLatestBookEntry(book);

  return {
    roundMode,
    roundIndex: game.roundIndex,
    roundNumber: game.roundIndex + 1,
    totalRounds: game.roundModes.length,
    bookIndex,
    bookId: book.id,
    originPlayerId: book.originPlayerId,
    latestEntry,
    hasSubmitted: game.submittedPlayerIds.includes(playerId)
  };
};

import {
  applyDrawNGuessAction as applyCoreDrawNGuessAction,
  createDrawNGuessGame,
  getDrawNGuessRoundMeta
} from '../../../../shared/src/gameCore/drawNGuess.js';

const MAX_GUESS_LENGTH = 100;
const MAX_DRAWING_DATA_URL_LENGTH = 800_000;

const buildPrivateState = (players, mapper) =>
  new Map(players.map((player) => [player.id, mapper(player)]));

const pickPrompts = (wordStore, count) => {
  const words = [...wordStore.getWords('describing')];
  if (words.length === 0) {
    return [];
  }

  const prompts = [];
  const available = [...words];
  while (prompts.length < count && available.length > 0) {
    const index = Math.floor(Math.random() * available.length);
    prompts.push(available.splice(index, 1)[0]);
  }

  while (prompts.length < count) {
    prompts.push(wordStore.getRandomWord('describing') ?? `Prompt ${prompts.length + 1}`);
  }

  return prompts;
};

const buildDrawNGuessPublicState = (players, game) => {
  if (game.mode === 'simultaneous') {
    const roundMode = game.stage === 'round' ? game.roundModes[game.roundIndex] : null;
    return {
      status: game.stage === 'results' ? 'round-complete' : 'round-active',
      mode: game.mode,
      stage: game.stage,
      roundMode,
      roundNumber: game.stage === 'results' ? game.roundModes.length : game.roundIndex + 1,
      totalRounds: game.roundModes.length,
      submittedCount: game.submittedPlayerIds.length,
      waitingCount: players.length - game.submittedPlayerIds.length,
      submittedPlayerIds: game.submittedPlayerIds,
      roundDurationSeconds: game.settings?.roundDurationSeconds ?? 45,
      results: game.results
    };
  }

  return {
    status: game.stage === 'results' ? 'round-complete' : 'round-active',
    mode: game.mode,
    stage: game.stage,
    activePlayerId: game.activePlayerId,
    stageNumber: game.stageNumber,
    totalStages: game.totalStages,
    submissions: game.submissions,
    promptLength: game.prompt.length,
    results: game.results
  };
};

const buildDrawNGuessPrivateState = (players, publicState, internalState) => {
  if (internalState.mode === 'simultaneous') {
    if (publicState.stage === 'results') {
      return buildPrivateState(players, (player) => ({
        mode: 'results',
        isActive: false,
        ownBookId: `book-${player.id}`,
        books: internalState.results?.books ?? internalState.books
      }));
    }

    return buildPrivateState(players, (player) => {
      const roundMeta = getDrawNGuessRoundMeta(internalState, players, player.id);
      const latestEntry = roundMeta?.latestEntry ?? null;
      const hasSubmitted = roundMeta?.hasSubmitted ?? false;

      return {
        mode: roundMeta?.roundMode ?? 'wait',
        isActive: true,
        hasSubmitted,
        canSubmit: !hasSubmitted,
        ownBookId: `book-${player.id}`,
        roundMode: roundMeta?.roundMode ?? null,
        prompt:
          latestEntry?.type === 'prompt' || latestEntry?.type === 'guess'
            ? latestEntry.text
            : null,
        drawing: latestEntry?.type === 'drawing' ? latestEntry.imageData : null,
        bookId: roundMeta?.bookId ?? null,
        originPlayerId: roundMeta?.originPlayerId ?? null
      };
    });
  }

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
        prompt:
          previousEntry?.type === 'prompt' || previousEntry?.type === 'guess'
            ? previousEntry.text
            : null,
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

export const buildDrawNGuessState = ({ players, word, settings = {}, wordStore }) => {
  const prompts = pickPrompts(wordStore, players.length);
  const internalState = createDrawNGuessGame({
    players,
    prompt: word,
    prompts,
    settings: {
      ...settings,
      mode: 'simultaneous'
    }
  });
  const publicState = buildDrawNGuessPublicState(players, internalState);

  return {
    publicState,
    privateState: buildDrawNGuessPrivateState(players, publicState, internalState),
    internalState
  };
};

export function applyDrawNGuessAction({ players, playerId, action, internalState }) {
  const nextState = applyCoreDrawNGuessAction(internalState, {
    players,
    action,
    actorId: playerId,
    maxGuessLength: MAX_GUESS_LENGTH,
    maxDrawingLength: MAX_DRAWING_DATA_URL_LENGTH
  });

  if (nextState.error) {
    return nextState;
  }

  const publicState = buildDrawNGuessPublicState(players, nextState);
  return {
    publicState,
    privateState: buildDrawNGuessPrivateState(players, publicState, nextState),
    internalState: nextState
  };
}

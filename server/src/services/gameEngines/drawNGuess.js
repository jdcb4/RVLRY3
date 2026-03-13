import {
  applyDrawNGuessAction as applyCoreDrawNGuessAction,
  createDrawNGuessGame
} from '../../../../shared/src/gameCore/drawNGuess.js';

const MAX_GUESS_LENGTH = 100;
const MAX_DRAWING_DATA_URL_LENGTH = 800_000;

const buildPrivateState = (players, mapper) =>
  new Map(players.map((player) => [player.id, mapper(player)]));

const buildDrawNGuessPublicState = (game) => ({
  status: game.stage === 'results' ? 'round-complete' : 'round-active',
  stage: game.stage,
  activePlayerId: game.activePlayerId,
  stageNumber: game.stageNumber,
  totalStages: game.totalStages,
  submissions: game.submissions,
  promptLength: game.prompt.length,
  results: game.results
});

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

export const buildDrawNGuessState = ({ players, word }) => {
  const internalState = createDrawNGuessGame({ players, prompt: word });
  const publicState = buildDrawNGuessPublicState(internalState);

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

  const publicState = buildDrawNGuessPublicState(nextState);
  return {
    publicState,
    privateState: buildDrawNGuessPrivateState(players, publicState, nextState),
    internalState: nextState
  };
}

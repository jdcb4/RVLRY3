import { normalizeText } from './teamUtils.js';

export const createDrawNGuessGame = ({ players, prompt }) => ({
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

const advanceDrawNGuessState = (game, players, chain) => {
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

export const applyDrawNGuessAction = (
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

    return advanceDrawNGuessState(game, players, [
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

    return advanceDrawNGuessState(game, players, [
      ...game.chain,
      { type: 'guess', text, submittedBy: game.activePlayerId }
    ]);
  }

  return { error: 'Unknown action for DrawNGuess' };
};

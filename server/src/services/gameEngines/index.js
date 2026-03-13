import { buildImposterState, applyImposterAction } from './imposter.js';
import { buildDrawNGuessState, applyDrawNGuessAction } from './drawNGuess.js';
import {
  DEFAULT_HATGAME_SETTINGS,
  DEFAULT_WHOWHATWHERE_SETTINGS,
  applyHatGameAction,
  applyWhoWhatWhereAction,
  buildHatGameState,
  buildWhoWhatWhereState,
  buildWhoWhatWhereTeams
} from './teamGames.js';

const GAME_WORD_TYPE = {
  imposter: 'describing',
  whowhatwhere: 'guessing',
  drawnguess: 'describing',
  hatgame: 'guessing'
};

const GAME_MIN_PLAYERS = {
  imposter: 2,
  whowhatwhere: 4,
  drawnguess: 2,
  hatgame: 4
};

const GAME_BUILDERS = {
  imposter: buildImposterState,
  whowhatwhere: buildWhoWhatWhereState,
  drawnguess: buildDrawNGuessState,
  hatgame: buildHatGameState
};

const GAME_ACTION_HANDLERS = {
  imposter: applyImposterAction,
  whowhatwhere: applyWhoWhatWhereAction,
  drawnguess: applyDrawNGuessAction,
  hatgame: applyHatGameAction
};

export {
  DEFAULT_HATGAME_SETTINGS,
  DEFAULT_WHOWHATWHERE_SETTINGS,
  buildWhoWhatWhereTeams
};

export function getWordTypeForGame(gameId) {
  return GAME_WORD_TYPE[gameId] ?? 'describing';
}

export function getMinPlayersForGame(gameId) {
  return GAME_MIN_PLAYERS[gameId] ?? 2;
}

export function buildGameStartState({
  gameId,
  players,
  word,
  teams = [],
  settings = {},
  lobbyState = {},
  wordStore
}) {
  const builder = GAME_BUILDERS[gameId];
  if (!builder) {
    return {
      publicState: { status: 'not-configured' },
      privateState: new Map(),
      internalState: {}
    };
  }

  return builder({ players, word, teams, settings, lobbyState, wordStore });
}

export function applyGameAction({
  gameId,
  players,
  teams = [],
  playerId,
  action,
  publicState,
  privateState,
  internalState,
  wordStore
}) {
  const handler = GAME_ACTION_HANDLERS[gameId];
  if (!handler) {
    return { error: 'This game is not configured for gameplay yet' };
  }

  return handler({
    gameId,
    players,
    teams,
    playerId,
    action,
    publicState,
    privateState,
    internalState,
    wordStore
  });
}

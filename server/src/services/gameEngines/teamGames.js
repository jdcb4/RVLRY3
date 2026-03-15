import {
  applyHatGameAction as applyCoreHatGameAction,
  buildHatGameCluePool,
  createHatGame,
  getHatGameContext,
  getHatGamePhaseMeta,
  isHatGameShowingSkippedClue
} from '../../../../shared/src/gameCore/hatGame.js';
import {
  buildTeams,
  cloneTeams,
  normalizeText,
  shuffleArray
} from '../../../../shared/src/gameCore/teamUtils.js';
import {
  applyWhoWhatWhereAction as applyCoreWhoWhatWhereAction,
  createWhoWhatWhereGame,
  getWhoWhatWhereContext,
  getWhoWhatWhereCurrentWord
} from '../../../../shared/src/gameCore/whoWhatWhere.js';

export const DEFAULT_WHOWHATWHERE_SETTINGS = {
  teamCount: 2,
  turnDurationSeconds: 45,
  totalRounds: 3,
  skipLimit: 1
};

export const DEFAULT_HATGAME_SETTINGS = {
  teamCount: 2,
  turnDurationSeconds: 45,
  cluesPerPlayer: 6,
  skipsPerTurn: 1
};

export const buildWhoWhatWhereTeams = buildTeams;

const buildPrivateState = (players, mapper) =>
  new Map(players.map((player) => [player.id, mapper(player)]));

const getTeamMap = (teams = []) => new Map(teams.map((team) => [team.id, team]));

const buildWhoWhatWhereTurnSnapshot = (activeTurn) => {
  const currentWord = getWhoWhatWhereCurrentWord(activeTurn);

  return {
    startedAt: activeTurn.startedAt,
    endsAt: activeTurn.endsAt,
    durationSeconds: activeTurn.durationSeconds,
    category: activeTurn.category,
    score: activeTurn.score,
    correctCount: activeTurn.correctCount,
    skippedCount: activeTurn.skippedCount,
    skipLimit: activeTurn.skipLimit,
    pendingSkippedCount: activeTurn.skippedWords.length,
    returningSkippedWord: activeTurn.currentWordSource === 'skipped',
    currentWordLength: currentWord?.length ?? 0,
    wordHistory: activeTurn.wordHistory
  };
};

const buildWhoWhatWherePublicState = (players, game) => {
  if (game.stage === 'results') {
    return {
      status: 'game-complete',
      stage: 'game-over',
      roundNumber: game.settings.totalRounds,
      totalRounds: game.settings.totalRounds,
      activeTeamId: null,
      activeTeamName: null,
      activeDescriberId: null,
      activeDescriberName: null,
      turn: null,
      lastTurnSummary: game.lastTurnSummary,
      results: game.results
    };
  }

  const context = getWhoWhatWhereContext(game, players);
  return {
    status: 'round-active',
    stage: game.stage,
    roundNumber: game.roundNumber,
    totalRounds: game.settings.totalRounds,
    activeTeamId: context.activeTeamId,
    activeTeamName: context.activeTeam?.name ?? 'Team',
    activeDescriberId: context.activeDescriberId,
    activeDescriberName: context.activeDescriberName,
    turn: game.stage === 'turn' && game.activeTurn ? buildWhoWhatWhereTurnSnapshot(game.activeTurn) : null,
    lastTurnSummary: game.lastTurnSummary,
    results: null
  };
};

const buildWhoWhatWherePrivateState = (players, publicState, game) => {
  const teamMap = getTeamMap(game.teams);
  const currentWord = game.activeTurn ? getWhoWhatWhereCurrentWord(game.activeTurn) : null;

  return buildPrivateState(players, (player) => {
    const playerTeam = teamMap.get(player.teamId) ?? null;
    const isDescriber = player.id === publicState.activeDescriberId;
    const isActiveTeam = player.teamId && player.teamId === publicState.activeTeamId;
    const role = !player.teamId ? 'unassigned' : isDescriber ? 'describer' : isActiveTeam ? 'guesser' : 'spectator';

    return {
      teamId: player.teamId ?? null,
      teamName: playerTeam?.name ?? null,
      role,
      isActiveTeam,
      isDescriber,
      canStartTurn: publicState.stage === 'ready' && isDescriber,
      canMarkCorrect: publicState.stage === 'turn' && isDescriber,
      canSkip:
        publicState.stage === 'turn' &&
        isDescriber &&
        (
          (game.activeTurn?.skipLimit ?? 0) < 0 ||
          (game.activeTurn?.skippedWords?.length ?? 0) < (game.activeTurn?.skipLimit ?? 0)
        ),
      canReturnSkippedWord:
        publicState.stage === 'turn' && isDescriber && game.activeTurn?.skippedWords?.length > 0,
      canEndTurn: publicState.stage === 'turn' && isDescriber,
      category: publicState.stage === 'turn' ? game.activeTurn?.category ?? null : null,
      word: publicState.stage === 'turn' && isDescriber ? currentWord : null,
      pendingSkippedCount: publicState.stage === 'turn' ? game.activeTurn?.skippedWords?.length ?? 0 : 0,
      skippedWords:
        publicState.stage === 'turn' && isDescriber
          ? (game.activeTurn?.skippedWords ?? []).map((entry) => ({
              id: entry.id,
              word: entry.word
            }))
          : [],
      returningSkippedWord:
        publicState.stage === 'turn' && game.activeTurn?.currentWordSource === 'skipped'
    };
  });
};

const buildHatGameTurnSnapshot = (activeTurn, phaseNumber) => {
  const currentClue = activeTurn.clueQueue[activeTurn.queueIndex] ?? null;
  const pendingSkippedCount = activeTurn.skippedClues?.length ?? 0;
  const skippedCluePending =
    pendingSkippedCount > 0 || activeTurn.currentSkippedCluePoolIndex !== null;

  return {
    startedAt: activeTurn.startedAt,
    endsAt: activeTurn.endsAt,
    durationSeconds: activeTurn.durationSeconds,
    phaseNumber,
    score: activeTurn.score,
    correctCount: activeTurn.correctCount,
    skippedCount: activeTurn.skippedCount,
    skipsRemaining: activeTurn.skipsRemaining,
    pendingSkippedCount,
    currentClueLength: currentClue?.text?.length ?? 0,
    skippedCluePending,
    showingSkippedClue: skippedCluePending && isHatGameShowingSkippedClue(activeTurn),
    clueHistory: activeTurn.clueHistory
  };
};

const buildHatGamePublicState = (players, game) => {
  if (game.stage === 'results') {
    return {
      status: 'game-complete',
      stage: 'game-over',
      roundNumber: game.roundNumber,
      phaseNumber: 3,
      phaseName: getHatGamePhaseMeta(3).name,
      phaseInstruction: getHatGamePhaseMeta(3).instruction,
      activeTeamId: null,
      activeTeamName: null,
      activeDescriberId: null,
      activeDescriberName: null,
      turn: null,
      lastTurnSummary: game.lastTurnSummary,
      results: game.results
    };
  }

  const context = getHatGameContext(game, players);
  const phaseMeta = getHatGamePhaseMeta(game.phaseNumber);

  return {
    status: 'round-active',
    stage: game.stage,
    roundNumber: game.roundNumber,
    phaseNumber: game.phaseNumber,
    phaseName: phaseMeta.name,
    phaseInstruction: phaseMeta.instruction,
    activeTeamId: context.activeTeamId,
    activeTeamName: context.activeTeam?.name ?? 'Team',
    activeDescriberId: context.activeDescriberId,
    activeDescriberName: context.activeDescriberName,
    turn: game.stage === 'turn' && game.activeTurn ? buildHatGameTurnSnapshot(game.activeTurn, game.phaseNumber) : null,
    lastTurnSummary: game.lastTurnSummary,
    results: null
  };
};

const buildHatGamePrivateState = (players, publicState, game) => {
  const teamMap = getTeamMap(game.teams);
  const phaseMeta = getHatGamePhaseMeta(game.phaseNumber);
  const currentClue = game.activeTurn?.clueQueue[game.activeTurn.queueIndex] ?? null;

  return buildPrivateState(players, (player) => {
    const playerTeam = teamMap.get(player.teamId) ?? null;
    const isDescriber = player.id === publicState.activeDescriberId;
    const isActiveTeam = player.teamId && player.teamId === publicState.activeTeamId;
    const role = !player.teamId ? 'unassigned' : isDescriber ? 'describer' : isActiveTeam ? 'guesser' : 'spectator';

    const pendingSkippedCount =
      publicState.stage === 'turn' ? game.activeTurn?.skippedClues?.length ?? 0 : 0;
    const skippedCluePending =
      publicState.stage === 'turn' &&
      (pendingSkippedCount > 0 || game.activeTurn?.currentSkippedCluePoolIndex !== null);
    const showingSkippedClue =
      skippedCluePending && isHatGameShowingSkippedClue(game.activeTurn);

    return {
      teamId: player.teamId ?? null,
      teamName: playerTeam?.name ?? null,
      role,
      isActiveTeam,
      isDescriber,
      phaseNumber: game.phaseNumber,
      phaseName: phaseMeta.name,
      phaseInstruction: phaseMeta.instruction,
      canStartTurn: publicState.stage === 'ready' && isDescriber,
      canMarkCorrect: publicState.stage === 'turn' && isDescriber,
      canSkip:
        publicState.stage === 'turn' &&
        isDescriber &&
        (game.activeTurn?.skipsRemaining ?? 0) > 0,
      canReturnSkippedClue:
        publicState.stage === 'turn' &&
        isDescriber &&
        (game.activeTurn?.skippedClues?.length ?? 0) > 0,
      canEndTurn: publicState.stage === 'turn' && isDescriber,
      clue: publicState.stage === 'turn' && isDescriber ? currentClue?.text ?? null : null,
      skipsRemaining:
        publicState.stage === 'turn'
          ? game.activeTurn?.skipsRemaining ?? 0
          : game.settings.skipsPerTurn,
      pendingSkippedCount,
      skippedCluePending,
      showingSkippedClue,
      skippedClues:
        publicState.stage === 'turn' && isDescriber
          ? (game.activeTurn?.skippedClues ?? []).map((entry) => ({
              poolIndex: entry.poolIndex,
              text: entry.text
            }))
          : []
    };
  });
};

const pickWhoWhatWhereCategory = (wordStore) => {
  const categories = wordStore.getCategories('guessing');
  if (categories.length === 0) {
    return null;
  }

  return categories[Math.floor(Math.random() * categories.length)];
};

const collectWhoWhatWhereWordQueue = (wordStore, category) =>
  shuffleArray(
    wordStore
      .getWordsForCategory('guessing', category)
      .map((word) => normalizeText(word))
      .filter(Boolean)
  );

export const buildWhoWhatWhereState = ({ players, teams, settings }) => {
  const internalState = createWhoWhatWhereGame({
    players,
    teams,
    settings
  });
  const publicState = buildWhoWhatWherePublicState(players, internalState);

  return {
    publicState,
    privateState: buildWhoWhatWherePrivateState(players, publicState, internalState),
    internalState,
    teams: cloneTeams(internalState.teams)
  };
};

export function applyWhoWhatWhereAction({ players, playerId, action, internalState, wordStore }) {
  const payload =
    action.type === 'start-turn'
      ? (() => {
          const category = pickWhoWhatWhereCategory(wordStore);
          if (!category) {
            return { error: 'Unable to load categories for this turn right now' };
          }

          const words = collectWhoWhatWhereWordQueue(wordStore, category);
          if (words.length === 0) {
            return { error: 'Unable to load words for the selected category right now' };
          }

          return {
            ...action.payload,
            category,
            words
          };
        })()
      : action.payload;

  if (payload?.error) {
    return payload;
  }

  const nextState = applyCoreWhoWhatWhereAction(internalState, {
    players,
    action: {
      ...action,
      payload
    },
    actorId: playerId,
    buildMoreWords: (category) => collectWhoWhatWhereWordQueue(wordStore, category)
  });

  if (nextState.error) {
    return nextState;
  }

  const publicState = buildWhoWhatWherePublicState(players, nextState);
  return {
    publicState,
    privateState: buildWhoWhatWherePrivateState(players, publicState, nextState),
    internalState: nextState,
    teams: cloneTeams(nextState.teams)
  };
}

export const buildHatGameState = ({ players, teams, settings, lobbyState }) => {
  const internalState = createHatGame({
    teams,
    settings,
    cluePool: buildHatGameCluePool(players, lobbyState?.clueSubmissions ?? {})
  });
  const publicState = buildHatGamePublicState(players, internalState);

  return {
    publicState,
    privateState: buildHatGamePrivateState(players, publicState, internalState),
    internalState,
    teams: cloneTeams(internalState.teams)
  };
};

export function applyHatGameAction({ players, playerId, action, internalState }) {
  const nextState = applyCoreHatGameAction(internalState, {
    players,
    action,
    actorId: playerId
  });

  if (nextState.error) {
    return nextState;
  }

  const publicState = buildHatGamePublicState(players, nextState);
  return {
    publicState,
    privateState: buildHatGamePrivateState(players, publicState, nextState),
    internalState: nextState,
    teams: cloneTeams(nextState.teams)
  };
}

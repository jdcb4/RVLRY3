import {
  buildLeaderboard,
  cloneTeams,
  getTimedTeamContext,
  normalizeText,
  nowIso
} from './teamUtils.js';

export const getWhoWhatWhereContext = (game, players) =>
  getTimedTeamContext({
    players,
    teams: game.teams ?? [],
    teamOrder: game.teamOrder ?? [],
    teamIndex: game.teamIndex ?? 0,
    describerIndexes: game.describerIndexes ?? {}
  });

export const createWhoWhatWhereGame = ({ teams, settings }) => {
  const nextTeams = cloneTeams(teams).map((team) => ({ ...team, score: 0 }));
  const teamOrder = nextTeams.map((team) => team.id);

  return {
    teams: nextTeams,
    settings: { ...settings },
    stage: 'ready',
    roundNumber: 1,
    teamOrder,
    teamIndex: 0,
    describerIndexes: Object.fromEntries(teamOrder.map((teamId) => [teamId, 0])),
    activeTurn: null,
    lastTurnSummary: null,
    results: null
  };
};

const createTurnSummary = (game, context) => ({
  teamId: context.activeTeamId,
  teamName: context.activeTeam?.name ?? 'Team',
  describerId: context.activeDescriberId,
  describerName: context.activeDescriberName,
  scoreDelta: game.activeTurn.score,
  correctCount: game.activeTurn.correctCount,
  skippedCount: game.activeTurn.skippedCount,
  freeSkipsRemaining: game.activeTurn.freeSkipsRemaining,
  words: game.activeTurn.wordHistory
});

const buildWhoWhatWhereResults = (teams) => {
  const leaderboard = buildLeaderboard(teams);
  const topScore = leaderboard[0]?.score ?? 0;
  const winnerTeamIds = leaderboard
    .filter((team) => team.score === topScore)
    .map((team) => team.teamId);

  return {
    leaderboard,
    winnerTeamIds,
    isTie: winnerTeamIds.length > 1
  };
};

export const finishWhoWhatWhereTurn = (game, players) => {
  const context = getWhoWhatWhereContext(game, players);
  if (!game.activeTurn || !context.activeTeamId) {
    return { error: 'No live turn is active right now' };
  }

  const teams = game.teams.map((team) =>
    team.id === context.activeTeamId
      ? { ...team, score: team.score + game.activeTurn.score }
      : team
  );
  const lastTurnSummary = createTurnSummary(game, context);
  const currentDescriberIndex = game.describerIndexes[context.activeTeamId] ?? 0;
  const describerIndexes = {
    ...game.describerIndexes,
    [context.activeTeamId]:
      context.activeTeamPlayers.length === 0
        ? 0
        : (currentDescriberIndex + 1) % context.activeTeamPlayers.length
  };

  let teamIndex = game.teamIndex + 1;
  let roundNumber = game.roundNumber;

  if (teamIndex >= game.teamOrder.length) {
    teamIndex = 0;
    roundNumber += 1;
  }

  if (roundNumber > game.settings.totalRounds) {
    return {
      ...game,
      teams,
      stage: 'results',
      activeTurn: null,
      lastTurnSummary,
      teamIndex,
      roundNumber,
      describerIndexes,
      results: buildWhoWhatWhereResults(teams)
    };
  }

  return {
    ...game,
    teams,
    stage: 'ready',
    activeTurn: null,
    lastTurnSummary,
    teamIndex,
    roundNumber,
    describerIndexes
  };
};

export const applyWhoWhatWhereAction = (
  game,
  {
    players,
    action,
    actorId = null,
    nowMs = Date.now,
    toIso = (timestamp) => new Date(timestamp).toISOString(),
    makeTimestamp = nowIso,
    isPast = (timestamp) => new Date(timestamp).getTime() <= Date.now(),
    buildMoreWords = null
  }
) => {
  if (action.type === 'start-turn') {
    if (game.stage !== 'ready') {
      return { error: 'The next turn is already underway' };
    }

    const context = getWhoWhatWhereContext(game, players);
    if (actorId && actorId !== context.activeDescriberId) {
      return { error: 'Only the active describer can start this turn' };
    }

    const words = Array.isArray(action.payload?.words)
      ? action.payload.words.map((word) => normalizeText(word)).filter(Boolean)
      : [];
    if (words.length === 0) {
      return { error: 'Need at least one word to start the turn' };
    }

    const category = normalizeText(action.payload?.category, 'Mixed deck');
    const startedAt = nowMs();
    return {
      ...game,
      stage: 'turn',
      activeTurn: {
        startedAt: toIso(startedAt),
        endsAt: toIso(startedAt + game.settings.turnDurationSeconds * 1000),
        durationSeconds: game.settings.turnDurationSeconds,
        category,
        wordQueue: words,
        queueIndex: 0,
        score: 0,
        correctCount: 0,
        skippedCount: 0,
        freeSkipsRemaining: game.settings.freeSkips,
        wordHistory: []
      }
    };
  }

  if (action.type === 'end-turn') {
    if (game.stage !== 'turn' || !game.activeTurn) {
      return { error: 'There is no active turn to end' };
    }

    const context = getWhoWhatWhereContext(game, players);
    const isExpired = isPast(game.activeTurn.endsAt);
    if (actorId && actorId !== context.activeDescriberId && !isExpired) {
      return { error: 'Only the active describer can end the turn early' };
    }

    return finishWhoWhatWhereTurn(game, players);
  }

  if (!['mark-correct', 'skip-word'].includes(action.type)) {
    return { error: 'Unknown action for WhoWhatWhere' };
  }

  if (game.stage !== 'turn' || !game.activeTurn) {
    return { error: 'The turn has not started yet' };
  }

  const context = getWhoWhatWhereContext(game, players);
  if (actorId && actorId !== context.activeDescriberId) {
    return { error: 'Only the active describer can control the turn' };
  }

  if (isPast(game.activeTurn.endsAt)) {
    return finishWhoWhatWhereTurn(game, players);
  }

  const currentWord = game.activeTurn.wordQueue[game.activeTurn.queueIndex] ?? null;
  if (!currentWord) {
    return finishWhoWhatWhereTurn(game, players);
  }

  const activeTurn = {
    ...game.activeTurn,
    wordQueue: [...game.activeTurn.wordQueue],
    wordHistory: [...game.activeTurn.wordHistory]
  };

  if (action.type === 'mark-correct') {
    activeTurn.score += 1;
    activeTurn.correctCount += 1;
    activeTurn.wordHistory.push({
      word: currentWord,
      status: 'correct',
      timestamp: makeTimestamp()
    });
  }

  if (action.type === 'skip-word') {
    activeTurn.skippedCount += 1;
    activeTurn.wordHistory.push({
      word: currentWord,
      status: 'skipped',
      timestamp: makeTimestamp()
    });

    if (activeTurn.freeSkipsRemaining > 0) {
      activeTurn.freeSkipsRemaining -= 1;
    } else {
      activeTurn.score -= game.settings.skipPenalty;
    }
  }

  activeTurn.queueIndex += 1;

  if (!activeTurn.wordQueue[activeTurn.queueIndex] && buildMoreWords) {
    const moreWords = buildMoreWords(activeTurn.category)
      .map((word) => normalizeText(word))
      .filter(Boolean);
    if (moreWords.length > 0) {
      activeTurn.wordQueue = [...activeTurn.wordQueue, ...moreWords];
    }
  }

  if (!activeTurn.wordQueue[activeTurn.queueIndex]) {
    return finishWhoWhatWhereTurn(
      {
        ...game,
        activeTurn
      },
      players
    );
  }

  return {
    ...game,
    activeTurn
  };
};

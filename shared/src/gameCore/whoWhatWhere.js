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

export const getWhoWhatWhereCurrentWord = (activeTurn) => {
  if (!activeTurn) {
    return null;
  }

  if (activeTurn.currentWordSource === 'skipped') {
    return activeTurn.currentSkippedWord?.word ?? null;
  }

  return activeTurn.wordQueue[activeTurn.queueIndex] ?? null;
};

const getWhoWhatWhereRemainingMainWords = (activeTurn) =>
  Math.max(activeTurn.wordQueue.length - activeTurn.queueIndex, 0);

const needsWhoWhatWhereBuffer = (activeTurn) =>
  activeTurn.currentWordSource === 'main' &&
  getWhoWhatWhereRemainingMainWords(activeTurn) < 10;

const canQueueAnotherSkippedWord = (activeTurn) =>
  activeTurn.skipLimit < 0 || activeTurn.skippedWords.length < activeTurn.skipLimit;

const createSkippedWordEntry = (activeTurn, word) => ({
  id: `skip-${activeTurn.nextSkippedWordId}`,
  word
});

const primeWhoWhatWhereNextWord = (activeTurn, buildMoreWords) => {
  if (needsWhoWhatWhereBuffer(activeTurn) && buildMoreWords) {
    const moreWords = buildMoreWords(activeTurn.category)
      .map((word) => normalizeText(word))
      .filter(Boolean);

    if (moreWords.length > 0) {
      activeTurn.wordQueue = [...activeTurn.wordQueue, ...moreWords];
    }
  }

  const nextMainWord = activeTurn.wordQueue[activeTurn.queueIndex] ?? null;
  if (nextMainWord) {
    activeTurn.currentWordSource = 'main';
    activeTurn.currentSkippedWord = null;
    return;
  }

  if (activeTurn.skippedWords.length > 0) {
    activeTurn.currentWordSource = 'skipped';
    activeTurn.currentSkippedWord = activeTurn.skippedWords.shift();
    return;
  }

  activeTurn.currentWordSource = 'main';
  activeTurn.currentSkippedWord = null;
};

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
  pendingSkippedCount: game.activeTurn.skippedWords.length,
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
        currentWordSource: 'main',
        currentSkippedWord: null,
        score: 0,
        correctCount: 0,
        skippedCount: 0,
        skipLimit: game.settings.skipLimit,
        skippedWords: [],
        nextSkippedWordId: 1,
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

  if (!['mark-correct', 'skip-word', 'return-skipped-word'].includes(action.type)) {
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

  const currentWord = getWhoWhatWhereCurrentWord(game.activeTurn);
  if (!currentWord) {
    return finishWhoWhatWhereTurn(game, players);
  }

  const activeTurn = {
    ...game.activeTurn,
    wordQueue: [...game.activeTurn.wordQueue],
    skippedWords: [...(game.activeTurn.skippedWords ?? [])],
    wordHistory: [...game.activeTurn.wordHistory]
  };

  if (action.type === 'return-skipped-word') {
    const waitingSkippedWords = [...activeTurn.skippedWords];
    const currentSkippedWord =
      activeTurn.currentWordSource === 'skipped' ? activeTurn.currentSkippedWord : null;
    const availableSkippedWords = currentSkippedWord
      ? [currentSkippedWord, ...waitingSkippedWords]
      : waitingSkippedWords;
    if (availableSkippedWords.length === 0) {
      return { error: 'There are no skipped words waiting' };
    }

    const targetSkippedWordId =
      action.payload?.skippedWordId ?? availableSkippedWords[0]?.id ?? null;
    const targetSkippedWord = availableSkippedWords.find((entry) => entry.id === targetSkippedWordId);
    if (!targetSkippedWord) {
      return { error: 'That skipped word is no longer available' };
    }

    activeTurn.skippedWords = waitingSkippedWords.filter((entry) => entry.id !== targetSkippedWordId);
    if (currentSkippedWord && currentSkippedWord.id !== targetSkippedWordId) {
      activeTurn.skippedWords.push(currentSkippedWord);
    }
    activeTurn.currentWordSource = 'skipped';
    activeTurn.currentSkippedWord = targetSkippedWord;

    return {
      ...game,
      activeTurn
    };
  }

  if (action.type === 'mark-correct') {
    activeTurn.score += 1;
    activeTurn.correctCount += 1;
    activeTurn.wordHistory.push({
      word: currentWord,
      status: 'correct',
      source: activeTurn.currentWordSource,
      timestamp: makeTimestamp()
    });
    if (activeTurn.currentWordSource === 'skipped') {
      activeTurn.currentSkippedWord = null;
    } else {
      activeTurn.queueIndex += 1;
    }
  } else if (action.type === 'skip-word') {
    activeTurn.skippedCount += 1;
    activeTurn.wordHistory.push({
      word: currentWord,
      status: 'skipped',
      source: activeTurn.currentWordSource,
      timestamp: makeTimestamp()
    });

    if (activeTurn.currentWordSource === 'skipped') {
      if (activeTurn.currentSkippedWord) {
        if (!canQueueAnotherSkippedWord(activeTurn)) {
          return { error: 'Return to skipped words before skipping again' };
        }
        activeTurn.skippedWords.push(activeTurn.currentSkippedWord);
        activeTurn.currentSkippedWord = null;
      }
    } else {
      if (!canQueueAnotherSkippedWord(activeTurn)) {
        return { error: 'Return to skipped words before skipping again' };
      }

      activeTurn.skippedWords.push(createSkippedWordEntry(activeTurn, currentWord));
      activeTurn.nextSkippedWordId += 1;
      activeTurn.queueIndex += 1;
    }
  }

  primeWhoWhatWhereNextWord(activeTurn, buildMoreWords);

  if (!getWhoWhatWhereCurrentWord(activeTurn)) {
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

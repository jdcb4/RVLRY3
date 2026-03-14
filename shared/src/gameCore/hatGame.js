import {
  buildLeaderboard,
  cloneTeams,
  getTimedTeamContext,
  normalizeText,
  nowIso,
  shuffleArray,
  sortPlayersBySeat
} from './teamUtils.js';

export const HATGAME_PHASES = {
  1: {
    name: 'Describe',
    instruction: 'Use as many words as you want, but do not say any part of the name.'
  },
  2: {
    name: 'One Word',
    instruction: 'Say exactly one word only. No gestures.'
  },
  3: {
    name: 'Charades',
    instruction: 'Act it out silently. No words or sounds.'
  }
};

export const getHatGamePhaseMeta = (phaseNumber) =>
  HATGAME_PHASES[phaseNumber] ?? HATGAME_PHASES[1];

export const getHatGameContext = (game, players) =>
  getTimedTeamContext({
    players,
    teams: game.teams ?? [],
    teamOrder: game.teamOrder ?? [],
    teamIndex: game.teamIndex ?? 0,
    describerIndexes: game.describerIndexes ?? {}
  });

export const buildHatGameCluePool = (players, clueSubmissions = {}) =>
  sortPlayersBySeat(players).flatMap((player) =>
    (clueSubmissions[player.id]?.clues ?? [])
      .map((clue) => normalizeText(clue))
      .filter(Boolean)
      .map((clue) => ({
        text: clue,
        submittedBy: player.id,
        submittedByName: player.name
      }))
  );

export const isHatGameShowingSkippedClue = (activeTurn) => {
  if (!activeTurn || activeTurn.skippedCluePoolIndex === null) {
    return false;
  }

  const currentClue = activeTurn.clueQueue[activeTurn.queueIndex] ?? null;
  return currentClue?.poolIndex === activeTurn.skippedCluePoolIndex;
};

export const createHatGame = ({ teams, settings, cluePool }) => {
  const nextTeams = cloneTeams(teams).map((team) => ({ ...team, score: 0 }));
  const teamOrder = nextTeams.map((team) => team.id);

  return {
    teams: nextTeams,
    settings: { ...settings },
    stage: 'ready',
    roundNumber: 1,
    phaseNumber: 1,
    teamOrder,
    teamIndex: 0,
    describerIndexes: Object.fromEntries(teamOrder.map((teamId) => [teamId, 0])),
    cluePool: [...cluePool],
    usedCluePoolIndices: [],
    activeTurn: null,
    lastTurnSummary: null,
    bestTurnSummary: null,
    results: null
  };
};

const collectClueQueue = (game, rng) =>
  shuffleArray(
    game.cluePool
      .map((clue, index) => ({
        ...clue,
        poolIndex: index
      }))
      .filter((clue) => !game.usedCluePoolIndices.includes(clue.poolIndex)),
    rng
  );

const advanceHatGamePhaseWithinTurn = (game, activeTurn, rng) => {
  if (activeTurn.skippedCluePoolIndex !== null) {
    return { error: 'Bring the skipped clue back before moving to the next phase' };
  }

  const nextPhaseNumber = Math.min(game.phaseNumber + 1, 3);
  const nextQueue = shuffleArray(
    game.cluePool.map((clue, index) => ({
      ...clue,
      poolIndex: index
    })),
    rng
  );

  if (nextQueue.length === 0) {
    return { error: 'No clues are available for the next phase' };
  }

  return {
    ...game,
    phaseNumber: nextPhaseNumber,
    usedCluePoolIndices: [],
    activeTurn: {
      ...activeTurn,
      clueQueue: nextQueue,
      queueIndex: 0,
      skippedCluePoolIndex: null,
      skippedClueText: null
    }
  };
};

const buildHatGameResults = (game) => {
  const leaderboard = buildLeaderboard(game.teams);
  const topScore = leaderboard[0]?.score ?? 0;
  const winnerTeamIds = leaderboard
    .filter((team) => team.score === topScore)
    .map((team) => team.teamId);

  return {
    leaderboard,
    winnerTeamIds,
    isTie: winnerTeamIds.length > 1,
    totalClues: game.cluePool.length,
    bestTurn: game.bestTurnSummary
  };
};

export const finishHatGameTurn = (game, players) => {
  const context = getHatGameContext(game, players);
  if (!game.activeTurn || !context.activeTeamId) {
    return { error: 'No live turn is active right now' };
  }

  const teams = game.teams.map((team) =>
    team.id === context.activeTeamId
      ? { ...team, score: team.score + game.activeTurn.score }
      : team
  );
  const usedCluePoolIndices = [
    ...new Set([
      ...game.usedCluePoolIndices,
      ...game.activeTurn.clueHistory
        .filter((entry) => entry.status === 'correct')
        .map((entry) => entry.poolIndex)
        .filter(Number.isFinite)
    ])
  ];
  const phaseCompleted =
    game.cluePool.length > 0 && usedCluePoolIndices.length >= game.cluePool.length;
  const nextPhaseNumber = phaseCompleted ? Math.min(game.phaseNumber + 1, 3) : game.phaseNumber;
  const lastTurnSummary = {
    teamId: context.activeTeamId,
    teamName: context.activeTeam?.name ?? 'Team',
    describerId: context.activeDescriberId,
    describerName: context.activeDescriberName,
    scoreDelta: game.activeTurn.score,
    correctCount: game.activeTurn.correctCount,
    skippedCount: game.activeTurn.skippedCount,
    clues: game.activeTurn.clueHistory,
    phaseCompleted,
    completedPhaseNumber: phaseCompleted ? game.phaseNumber : null,
    nextPhaseNumber: phaseCompleted && game.phaseNumber < 3 ? nextPhaseNumber : null,
    nextPhaseName:
      phaseCompleted && game.phaseNumber < 3 ? getHatGamePhaseMeta(nextPhaseNumber).name : null
  };
  const currentTurnHighlight = {
    teamId: context.activeTeamId,
    teamName: context.activeTeam?.name ?? 'Team',
    describerId: context.activeDescriberId,
    describerName: context.activeDescriberName,
    score: game.activeTurn.score,
    phaseNumber: game.phaseNumber,
    phaseName: getHatGamePhaseMeta(game.phaseNumber).name
  };
  const bestTurnSummary =
    !game.bestTurnSummary || currentTurnHighlight.score > game.bestTurnSummary.score
      ? currentTurnHighlight
      : game.bestTurnSummary;
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

  const nextGame = {
    ...game,
    teams,
    stage: 'ready',
    activeTurn: null,
    lastTurnSummary,
    bestTurnSummary,
    teamIndex,
    roundNumber,
    phaseNumber: nextPhaseNumber,
    describerIndexes,
    usedCluePoolIndices: phaseCompleted ? [] : usedCluePoolIndices
  };

  if (phaseCompleted && game.phaseNumber >= 3) {
    return {
      ...nextGame,
      stage: 'results',
      usedCluePoolIndices: [],
      results: buildHatGameResults(nextGame)
    };
  }

  return nextGame;
};

export const applyHatGameAction = (
  game,
  {
    players,
    action,
    actorId = null,
    rng = Math.random,
    nowMs = Date.now,
    toIso = (timestamp) => new Date(timestamp).toISOString(),
    makeTimestamp = nowIso,
    isPast = (timestamp) => new Date(timestamp).getTime() <= Date.now()
  }
) => {
  if (action.type === 'start-turn') {
    if (game.stage !== 'ready') {
      return { error: 'The next turn is already underway' };
    }

    const context = getHatGameContext(game, players);
    if (actorId && actorId !== context.activeDescriberId) {
      return { error: 'Only the active describer can start this turn' };
    }

    const clueQueue = collectClueQueue(game, rng);
    if (clueQueue.length === 0) {
      return { error: 'No clues are available for this turn right now' };
    }

    const startedAt = nowMs();
    return {
      ...game,
      stage: 'turn',
      activeTurn: {
        startedAt: toIso(startedAt),
        endsAt: toIso(startedAt + game.settings.turnDurationSeconds * 1000),
        durationSeconds: game.settings.turnDurationSeconds,
        clueQueue,
        queueIndex: 0,
        score: 0,
        correctCount: 0,
        skippedCount: 0,
        skipsRemaining: game.settings.skipsPerTurn,
        skippedCluePoolIndex: null,
        skippedClueText: null,
        clueHistory: []
      }
    };
  }

  if (action.type === 'end-turn') {
    if (game.stage !== 'turn' || !game.activeTurn) {
      return { error: 'There is no active turn to end' };
    }

    const context = getHatGameContext(game, players);
    const isExpired = isPast(game.activeTurn.endsAt);
    if (actorId && actorId !== context.activeDescriberId && !isExpired) {
      return { error: 'Only the active describer can end the turn early' };
    }

    return finishHatGameTurn(game, players);
  }

  if (!['mark-correct', 'skip-clue', 'return-skipped-clue'].includes(action.type)) {
    return { error: 'Unknown action for HatGame' };
  }

  if (game.stage !== 'turn' || !game.activeTurn) {
    return { error: 'The turn has not started yet' };
  }

  const context = getHatGameContext(game, players);
  if (actorId && actorId !== context.activeDescriberId) {
    return { error: 'Only the active describer can control the turn' };
  }

  if (isPast(game.activeTurn.endsAt)) {
    return finishHatGameTurn(game, players);
  }

  const currentClue = game.activeTurn.clueQueue[game.activeTurn.queueIndex] ?? null;
  if (!currentClue) {
    return finishHatGameTurn(game, players);
  }

  const activeTurn = {
    ...game.activeTurn,
    clueQueue: [...game.activeTurn.clueQueue],
    clueHistory: [...game.activeTurn.clueHistory]
  };

  if (action.type === 'mark-correct') {
    activeTurn.score += 1;
    activeTurn.correctCount += 1;
    activeTurn.clueHistory.push({
      clue: currentClue.text,
      status: 'correct',
      timestamp: makeTimestamp(),
      poolIndex: currentClue.poolIndex
    });

    if (activeTurn.skippedCluePoolIndex === currentClue.poolIndex) {
      activeTurn.skippedCluePoolIndex = null;
      activeTurn.skippedClueText = null;
    }

    activeTurn.queueIndex += 1;
  }

  if (action.type === 'skip-clue') {
    if (activeTurn.skippedCluePoolIndex !== null) {
      return { error: 'Answer the skipped clue before skipping again' };
    }

    if (activeTurn.skipsRemaining <= 0) {
      return { error: 'No skips remain this turn' };
    }

    activeTurn.skippedCount += 1;
    activeTurn.skipsRemaining -= 1;
    activeTurn.skippedCluePoolIndex = currentClue.poolIndex;
    activeTurn.skippedClueText = currentClue.text;
    activeTurn.clueHistory.push({
      clue: currentClue.text,
      status: 'skipped',
      timestamp: makeTimestamp(),
      poolIndex: currentClue.poolIndex
    });

    const [skippedClue] = activeTurn.clueQueue.splice(activeTurn.queueIndex, 1);
    activeTurn.clueQueue.push(skippedClue);
  }

  if (action.type === 'return-skipped-clue') {
    if (activeTurn.skippedCluePoolIndex === null) {
      return { error: 'There is no skipped clue to return to' };
    }

    const skippedIndex = activeTurn.clueQueue.findIndex(
      (clue) => clue.poolIndex === activeTurn.skippedCluePoolIndex
    );
    if (skippedIndex === -1) {
      return { error: 'The skipped clue is no longer available' };
    }

    if (skippedIndex !== activeTurn.queueIndex) {
      const [skippedClue] = activeTurn.clueQueue.splice(skippedIndex, 1);
      activeTurn.clueQueue.splice(activeTurn.queueIndex, 0, skippedClue);
    }
  }

  if (!activeTurn.clueQueue[activeTurn.queueIndex]) {
    if (game.phaseNumber < 3) {
      return advanceHatGamePhaseWithinTurn(
        {
          ...game,
          activeTurn
        },
        activeTurn,
        rng
      );
    }

    return finishHatGameTurn(
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

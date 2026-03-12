export const MIN_LOCAL_PLAYERS = 2;
export const MAX_LOCAL_PLAYERS = 8;
export const LOCAL_TEAM_LABELS = ['A', 'B', 'C', 'D'];
export const MAX_LOCAL_CLUE_LENGTH = 120;
export const MAX_LOCAL_GUESS_LENGTH = 100;
export const MAX_LOCAL_DRAWING_DATA_URL_LENGTH = 800_000;

export const DEFAULT_LOCAL_PLAYER_COUNT = {
  imposter: 4,
  whowhatwhere: 4,
  drawnguess: 4
};

export const DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS = {
  teamCount: 2,
  turnDurationSeconds: 45,
  totalRounds: 2,
  freeSkips: 1,
  skipPenalty: 1
};

const clampInteger = (value, minimum, maximum, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
};

const sanitizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const sortPlayers = (players) => [...players].sort((left, right) => left.seat - right.seat);

const shuffleArray = (items, rng = Math.random) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildTeamId = (index) => `team-${String.fromCharCode(97 + index)}`;

export const buildLocalTeams = (teamCount = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.teamCount) =>
  LOCAL_TEAM_LABELS.slice(0, Math.min(Math.max(teamCount, 2), 4)).map((label, index) => ({
    id: buildTeamId(index),
    name: `Team ${label}`,
    score: 0
  }));

const normalizeLocalPlayer = (player, index) => ({
  id: player.id ?? `player-${index + 1}`,
  seat: Number.isFinite(player.seat) ? player.seat : index,
  name: sanitizeText(player.name, `Player ${index + 1}`),
  teamId: player.teamId ?? null
});

export function rebalanceWhoWhatWherePlayers(players, teamCount) {
  const teamIds = buildLocalTeams(teamCount).map((team) => team.id);
  return sortPlayers(players).map((player, index) => ({
    ...normalizeLocalPlayer(player, index),
    teamId: teamIds[index % teamIds.length] ?? null
  }));
}

export function createLocalPlayers(count, { teamCount = null } = {}) {
  const safeCount = clampInteger(
    count,
    MIN_LOCAL_PLAYERS,
    MAX_LOCAL_PLAYERS,
    DEFAULT_LOCAL_PLAYER_COUNT.imposter
  );

  const players = Array.from({ length: safeCount }, (_, index) =>
    normalizeLocalPlayer(
      {
        id: `player-${index + 1}`,
        seat: index,
        name: `Player ${index + 1}`,
        teamId: null
      },
      index
    )
  );

  return teamCount ? rebalanceWhoWhatWherePlayers(players, teamCount) : players;
}

export const getLocalWordType = (gameId) =>
  gameId === 'whowhatwhere' ? 'guessing' : 'describing';

export function getLocalStartError({ gameId, players, settings = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS }) {
  const normalizedPlayers = sortPlayers(players).map(normalizeLocalPlayer);
  const minimumPlayers = gameId === 'whowhatwhere'
    ? Math.max(4, settings.teamCount * 2)
    : gameId === 'drawnguess'
      ? 2
      : 2;

  if (normalizedPlayers.length < minimumPlayers) {
    return `Need at least ${minimumPlayers} players`;
  }

  if (gameId === 'whowhatwhere') {
    const teams = buildLocalTeams(settings.teamCount);
    for (const team of teams) {
      const rosterSize = normalizedPlayers.filter((player) => player.teamId === team.id).length;
      if (rosterSize < 2) {
        return 'Each team needs at least 2 players';
      }
    }
  }

  return null;
}

const sanitizeWhoWhatWhereSettings = (settings = {}) => ({
  teamCount: clampInteger(
    settings.teamCount,
    2,
    4,
    DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.teamCount
  ),
  turnDurationSeconds: clampInteger(
    settings.turnDurationSeconds,
    15,
    90,
    DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.turnDurationSeconds
  ),
  totalRounds: clampInteger(
    settings.totalRounds,
    1,
    8,
    DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.totalRounds
  ),
  freeSkips: clampInteger(
    settings.freeSkips,
    0,
    4,
    DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.freeSkips
  ),
  skipPenalty: clampInteger(
    settings.skipPenalty,
    0,
    3,
    DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.skipPenalty
  )
});

function buildImposterSession({ players, prompt, rng = Math.random }) {
  const orderedPlayers = sortPlayers(players).map(normalizeLocalPlayer);
  const imposterIndex = Math.floor(rng() * orderedPlayers.length);
  const imposterId = orderedPlayers[imposterIndex]?.id ?? orderedPlayers[0]?.id ?? null;

  return {
    gameId: 'imposter',
    players: orderedPlayers,
    prompt,
    stage: 'reveal',
    imposterId,
    revealIndex: 0,
    clueIndex: 0,
    votingIndex: 0,
    clues: [],
    votes: {},
    results: null
  };
}

function buildWhoWhatWhereSession({ players, settings = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS }) {
  const normalizedSettings = sanitizeWhoWhatWhereSettings(settings);
  const orderedPlayers = rebalanceWhoWhatWherePlayers(players, normalizedSettings.teamCount);
  const teams = buildLocalTeams(normalizedSettings.teamCount);
  const teamOrder = teams.map((team) => team.id);

  return {
    gameId: 'whowhatwhere',
    players: orderedPlayers,
    teams,
    settings: normalizedSettings,
    stage: 'ready',
    roundNumber: 1,
    teamOrder,
    teamIndex: 0,
    describerIndexes: Object.fromEntries(teamOrder.map((teamId) => [teamId, 0])),
    activeTurn: null,
    lastTurnSummary: null,
    results: null
  };
}

function buildDrawNGuessSession({ players, prompt }) {
  const orderedPlayers = sortPlayers(players).map(normalizeLocalPlayer);

  return {
    gameId: 'drawnguess',
    players: orderedPlayers,
    prompt,
    stage: 'draw',
    stageIndex: 0,
    activePlayerId: orderedPlayers[0]?.id ?? null,
    stageNumber: 1,
    totalStages: orderedPlayers.length,
    submissions: 0,
    chain: [{ type: 'prompt', text: prompt, submittedBy: null }],
    results: null
  };
}

export function buildLocalSession({ gameId, players, prompt = '', settings = {}, rng = Math.random }) {
  if (gameId === 'imposter') {
    return buildImposterSession({ players, prompt, rng });
  }

  if (gameId === 'whowhatwhere') {
    return buildWhoWhatWhereSession({ players, settings });
  }

  if (gameId === 'drawnguess') {
    return buildDrawNGuessSession({ players, prompt });
  }

  throw new Error(`Unsupported local game: ${gameId}`);
}

export const getActiveImposterPlayer = (session) => {
  if (session.stage === 'reveal') {
    return session.players[session.revealIndex] ?? null;
  }

  if (session.stage === 'clues') {
    return session.players[session.clueIndex] ?? null;
  }

  if (session.stage === 'voting') {
    return session.players[session.votingIndex] ?? null;
  }

  return null;
};

export const getImposterSecretForPlayer = (session, playerId) => ({
  role: playerId === session.imposterId ? 'imposter' : 'crew',
  word: playerId === session.imposterId ? null : session.prompt
});

const buildImposterResults = (session, votes) => {
  const voteCounts = session.players.reduce((counts, player) => {
    counts[player.id] = 0;
    return counts;
  }, {});

  for (const targetId of Object.values(votes)) {
    voteCounts[targetId] += 1;
  }

  const highestVoteCount = Math.max(...Object.values(voteCounts));
  const leadingPlayers = Object.entries(voteCounts)
    .filter(([, count]) => count === highestVoteCount)
    .map(([playerId]) => playerId);
  const accusedPlayerId = leadingPlayers.length === 1 ? leadingPlayers[0] : null;
  const crewWon = accusedPlayerId === session.imposterId;

  return {
    outcome: crewWon ? 'crew' : 'imposter',
    reason:
      accusedPlayerId === null
        ? 'The room tied its vote, so the imposter slipped away.'
        : crewWon
          ? 'The room found the imposter.'
          : 'The room accused the wrong player.',
    imposterId: session.imposterId,
    secretWord: session.prompt,
    accusedPlayerId,
    voteTally: session.players.map((player) => ({
      playerId: player.id,
      votes: voteCounts[player.id] ?? 0
    })),
    votes: Object.entries(votes).map(([voterId, targetPlayerId]) => ({
      voterId,
      targetPlayerId
    }))
  };
};

function applyLocalImposterAction(session, action) {
  if (action.type === 'next-reveal') {
    if (session.stage !== 'reveal') {
      return { error: 'Role reveals are already complete' };
    }

    const nextRevealIndex = session.revealIndex + 1;
    if (nextRevealIndex >= session.players.length) {
      return {
        ...session,
        stage: 'clues',
        clueIndex: 0
      };
    }

    return {
      ...session,
      revealIndex: nextRevealIndex
    };
  }

  if (action.type === 'submit-clue') {
    if (session.stage !== 'clues') {
      return { error: 'Clues are not active right now' };
    }

    const clue = sanitizeText(action.payload?.text);
    if (!clue) {
      return { error: 'Enter a clue before continuing' };
    }

    if (clue.length > MAX_LOCAL_CLUE_LENGTH) {
      return { error: `Clues must be ${MAX_LOCAL_CLUE_LENGTH} characters or fewer` };
    }

    const activePlayer = session.players[session.clueIndex];
    const clues = [...session.clues, { playerId: activePlayer.id, text: clue }];
    const nextClueIndex = session.clueIndex + 1;

    if (nextClueIndex >= session.players.length) {
      return {
        ...session,
        stage: 'voting',
        clues,
        votingIndex: 0
      };
    }

    return {
      ...session,
      clues,
      clueIndex: nextClueIndex
    };
  }

  if (action.type === 'submit-vote') {
    if (session.stage !== 'voting') {
      return { error: 'Voting is not active right now' };
    }

    const activePlayer = session.players[session.votingIndex];
    const targetPlayerId = action.payload?.targetPlayerId;
    if (!session.players.some((player) => player.id === targetPlayerId)) {
      return { error: 'Choose a valid player to accuse' };
    }

    if (targetPlayerId === activePlayer.id) {
      return { error: 'Players cannot vote for themselves' };
    }

    const votes = {
      ...session.votes,
      [activePlayer.id]: targetPlayerId
    };
    const nextVotingIndex = session.votingIndex + 1;

    if (nextVotingIndex >= session.players.length) {
      return {
        ...session,
        stage: 'results',
        votes,
        results: buildImposterResults(session, votes)
      };
    }

    return {
      ...session,
      votes,
      votingIndex: nextVotingIndex
    };
  }

  return { error: 'Unknown action for local Imposter' };
}

const getWhoWhatWhereTeamPlayers = (session, teamId) =>
  sortPlayers(session.players.filter((player) => player.teamId === teamId));

export function getWhoWhatWhereContext(session) {
  const activeTeamId = session.teamOrder[session.teamIndex] ?? null;
  const activeTeam = session.teams.find((team) => team.id === activeTeamId) ?? null;
  const activeTeamPlayers = getWhoWhatWhereTeamPlayers(session, activeTeamId);
  const describerIndex =
    activeTeamPlayers.length === 0
      ? 0
      : (session.describerIndexes[activeTeamId] ?? 0) % activeTeamPlayers.length;
  const activeDescriber = activeTeamPlayers[describerIndex] ?? null;

  return {
    activeTeamId,
    activeTeam,
    activeTeamPlayers,
    activeDescriberId: activeDescriber?.id ?? null,
    activeDescriberName: activeDescriber?.name ?? 'Waiting'
  };
}

const finishWhoWhatWhereTurn = (session) => {
  const context = getWhoWhatWhereContext(session);
  const activeTurn = session.activeTurn;
  if (!activeTurn || !context.activeTeamId) {
    return { error: 'No live turn is active right now' };
  }

  const nextTeams = session.teams.map((team) =>
    team.id === context.activeTeamId
      ? { ...team, score: team.score + activeTurn.score }
      : team
  );

  const lastTurnSummary = {
    teamId: context.activeTeamId,
    teamName: context.activeTeam?.name ?? 'Team',
    describerId: context.activeDescriberId,
    describerName: context.activeDescriberName,
    scoreDelta: activeTurn.score,
    correctCount: activeTurn.correctCount,
    skippedCount: activeTurn.skippedCount,
    freeSkipsRemaining: activeTurn.freeSkipsRemaining,
    words: activeTurn.wordHistory
  };

  const currentDescriberIndex = session.describerIndexes[context.activeTeamId] ?? 0;
  const nextDescriberIndexes = {
    ...session.describerIndexes,
    [context.activeTeamId]:
      context.activeTeamPlayers.length === 0
        ? 0
        : (currentDescriberIndex + 1) % context.activeTeamPlayers.length
  };

  let nextTeamIndex = session.teamIndex + 1;
  let nextRoundNumber = session.roundNumber;

  if (nextTeamIndex >= session.teamOrder.length) {
    nextTeamIndex = 0;
    nextRoundNumber += 1;
  }

  if (nextRoundNumber > session.settings.totalRounds) {
    const leaderboard = [...nextTeams]
      .sort((left, right) => right.score - left.score)
      .map((team) => ({
        teamId: team.id,
        teamName: team.name,
        score: team.score
      }));
    const topScore = leaderboard[0]?.score ?? 0;
    const winnerTeamIds = leaderboard
      .filter((team) => team.score === topScore)
      .map((team) => team.teamId);

    return {
      ...session,
      teams: nextTeams,
      stage: 'results',
      activeTurn: null,
      lastTurnSummary,
      teamIndex: nextTeamIndex,
      roundNumber: nextRoundNumber,
      describerIndexes: nextDescriberIndexes,
      results: {
        leaderboard,
        winnerTeamIds,
        isTie: winnerTeamIds.length > 1
      }
    };
  }

  return {
    ...session,
    teams: nextTeams,
    stage: 'ready',
    activeTurn: null,
    lastTurnSummary,
    teamIndex: nextTeamIndex,
    roundNumber: nextRoundNumber,
    describerIndexes: nextDescriberIndexes
  };
};

function applyLocalWhoWhatWhereAction(session, action) {
  if (action.type === 'start-turn') {
    if (session.stage !== 'ready') {
      return { error: 'The next turn is already underway' };
    }

    const words = Array.isArray(action.payload?.words)
      ? action.payload.words.map((word) => sanitizeText(word)).filter(Boolean)
      : [];
    if (words.length === 0) {
      return { error: 'Need at least one word to start the turn' };
    }

    const category = sanitizeText(action.payload?.category, 'Mixed deck');
    const startedAt = Date.now();
    return {
      ...session,
      stage: 'turn',
      activeTurn: {
        startedAt: new Date(startedAt).toISOString(),
        endsAt: new Date(startedAt + session.settings.turnDurationSeconds * 1000).toISOString(),
        durationSeconds: session.settings.turnDurationSeconds,
        category,
        wordQueue: words,
        queueIndex: 0,
        score: 0,
        correctCount: 0,
        skippedCount: 0,
        freeSkipsRemaining: session.settings.freeSkips,
        wordHistory: []
      }
    };
  }

  if (action.type === 'end-turn') {
    if (session.stage !== 'turn' || !session.activeTurn) {
      return { error: 'There is no active turn to end' };
    }

    return finishWhoWhatWhereTurn(session);
  }

  if (!['mark-correct', 'skip-word'].includes(action.type)) {
    return { error: 'Unknown action for local WhoWhatWhere' };
  }

  if (session.stage !== 'turn' || !session.activeTurn) {
    return { error: 'The turn has not started yet' };
  }

  const currentWord = session.activeTurn.wordQueue[session.activeTurn.queueIndex] ?? null;
  if (!currentWord) {
    return finishWhoWhatWhereTurn(session);
  }

  const nextActiveTurn = {
    ...session.activeTurn,
    wordHistory: [...session.activeTurn.wordHistory]
  };

  if (action.type === 'mark-correct') {
    nextActiveTurn.score += 1;
    nextActiveTurn.correctCount += 1;
    nextActiveTurn.wordHistory.push({
      word: currentWord,
      status: 'correct',
      timestamp: new Date().toISOString()
    });
  }

  if (action.type === 'skip-word') {
    nextActiveTurn.skippedCount += 1;
    nextActiveTurn.wordHistory.push({
      word: currentWord,
      status: 'skipped',
      timestamp: new Date().toISOString()
    });

    if (nextActiveTurn.freeSkipsRemaining > 0) {
      nextActiveTurn.freeSkipsRemaining -= 1;
    } else {
      nextActiveTurn.score -= session.settings.skipPenalty;
    }
  }

  nextActiveTurn.queueIndex += 1;

  if (!nextActiveTurn.wordQueue[nextActiveTurn.queueIndex]) {
    return finishWhoWhatWhereTurn({
      ...session,
      activeTurn: nextActiveTurn
    });
  }

  return {
    ...session,
    activeTurn: nextActiveTurn
  };
}

const advanceDrawNGuessState = (session, chain) => {
  const nextStageIndex = session.stageIndex + 1;
  const submissions = session.submissions + 1;

  if (nextStageIndex >= session.players.length) {
    return {
      ...session,
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

  const nextStage = nextStageIndex % 2 === 0 ? 'draw' : 'guess';
  return {
    ...session,
    stage: nextStage,
    stageIndex: nextStageIndex,
    activePlayerId: session.players[nextStageIndex]?.id ?? null,
    stageNumber: nextStageIndex + 1,
    submissions,
    chain
  };
};

function applyLocalDrawNGuessAction(session, action) {
  if (action.type === 'submit-drawing') {
    if (session.stage !== 'draw') {
      return { error: 'The current stage is not a drawing stage' };
    }

    const imageData = String(action.payload?.imageData ?? '');
    if (!imageData.startsWith('data:image/')) {
      return { error: 'Submit a drawing before continuing' };
    }

    if (imageData.length > MAX_LOCAL_DRAWING_DATA_URL_LENGTH) {
      return { error: 'That drawing is too large to keep on this device' };
    }

    return advanceDrawNGuessState(session, [
      ...session.chain,
      { type: 'drawing', imageData, submittedBy: session.activePlayerId }
    ]);
  }

  if (action.type === 'submit-guess') {
    if (session.stage !== 'guess') {
      return { error: 'The current stage is not a guessing stage' };
    }

    const text = sanitizeText(action.payload?.text);
    if (!text) {
      return { error: 'Enter a guess before continuing' };
    }

    if (text.length > MAX_LOCAL_GUESS_LENGTH) {
      return { error: `Guesses must be ${MAX_LOCAL_GUESS_LENGTH} characters or fewer` };
    }

    return advanceDrawNGuessState(session, [
      ...session.chain,
      { type: 'guess', text, submittedBy: session.activePlayerId }
    ]);
  }

  return { error: 'Unknown action for local DrawNGuess' };
}

export function applyLocalAction(session, action) {
  if (session.gameId === 'imposter') {
    return applyLocalImposterAction(session, action);
  }

  if (session.gameId === 'whowhatwhere') {
    return applyLocalWhoWhatWhereAction(session, action);
  }

  if (session.gameId === 'drawnguess') {
    return applyLocalDrawNGuessAction(session, action);
  }

  return { error: 'Unsupported local game' };
}

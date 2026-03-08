const GAME_WORD_TYPE = {
  imposter: 'describing',
  whowhatwhere: 'guessing',
  drawnguess: 'describing'
};

const GAME_MIN_PLAYERS = {
  imposter: 2,
  whowhatwhere: 4,
  drawnguess: 2
};

export const DEFAULT_WHOWHATWHERE_SETTINGS = {
  teamCount: 2,
  turnDurationSeconds: 45,
  totalRounds: 3,
  freeSkips: 1,
  skipPenalty: 1
};

const TEAM_LABELS = ['A', 'B', 'C', 'D'];

export const buildWhoWhatWhereTeams = (teamCount = DEFAULT_WHOWHATWHERE_SETTINGS.teamCount) =>
  TEAM_LABELS.slice(0, Math.min(Math.max(teamCount, 2), 4)).map((label, index) => ({
    id: `team-${String.fromCharCode(97 + index)}`,
    name: `Team ${label}`,
    score: 0
  }));

export const DEFAULT_WHOWHATWHERE_TEAMS = buildWhoWhatWhereTeams();

const MAX_CLUE_LENGTH = 120;
const MAX_GUESS_LENGTH = 100;
const MAX_DRAWING_DATA_URL_LENGTH = 800_000;

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const buildPrivateState = (players, mapper) => new Map(players.map((player) => [player.id, mapper(player)]));
const normalizeText = (value) => String(value ?? '').trim();
const getPlayerIds = (players) => players.map((player) => player.id);
const hasPlayer = (players, playerId) => players.some((player) => player.id === playerId);
const sortPlayersBySeat = (players) => [...players].sort((left, right) => left.seat - right.seat);
const cloneTeams = (teams = []) => teams.map((team) => ({ ...team }));
const shuffleArray = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const sanitizeWhoWhatWhereSettings = (settings = {}) => ({
  teamCount: Number.isFinite(settings.teamCount) ? Math.min(Math.max(settings.teamCount, 2), 4) : DEFAULT_WHOWHATWHERE_SETTINGS.teamCount,
  turnDurationSeconds: Number.isFinite(settings.turnDurationSeconds) ? settings.turnDurationSeconds : DEFAULT_WHOWHATWHERE_SETTINGS.turnDurationSeconds,
  totalRounds: Number.isFinite(settings.totalRounds) ? settings.totalRounds : DEFAULT_WHOWHATWHERE_SETTINGS.totalRounds,
  freeSkips: Number.isFinite(settings.freeSkips) ? settings.freeSkips : DEFAULT_WHOWHATWHERE_SETTINGS.freeSkips,
  skipPenalty: Number.isFinite(settings.skipPenalty) ? settings.skipPenalty : DEFAULT_WHOWHATWHERE_SETTINGS.skipPenalty
});

const getTeamMap = (teams = []) => new Map(teams.map((team) => [team.id, team]));
const getTeamPlayers = (players, teamId) => sortPlayersBySeat(players.filter((player) => player.teamId === teamId));
const nowIso = () => new Date().toISOString();
const isPast = (timestamp) => new Date(timestamp).getTime() <= Date.now();

const buildImposterPrivateState = (players, publicState, internalState) =>
  buildPrivateState(players, (player) => ({
    role: player.id === internalState.imposterId ? 'imposter' : 'crew',
    word: player.id === internalState.imposterId ? null : internalState.word,
    canClue: publicState.stage === 'clues' && publicState.currentTurnPlayerId === player.id,
    canVote: publicState.stage === 'voting' && !internalState.votes[player.id],
    hasVoted: Boolean(internalState.votes[player.id]),
    votedForPlayerId: internalState.votes[player.id] ?? null
  }));

const buildWhoWhatWhereTurnSnapshot = (activeTurn) => {
  const currentWord = activeTurn.wordQueue[activeTurn.queueIndex] ?? null;

  return {
    startedAt: activeTurn.startedAt,
    endsAt: activeTurn.endsAt,
    durationSeconds: activeTurn.durationSeconds,
    category: activeTurn.category,
    score: activeTurn.score,
    correctCount: activeTurn.correctCount,
    skippedCount: activeTurn.skippedCount,
    freeSkipsRemaining: activeTurn.freeSkipsRemaining,
    currentWordLength: currentWord?.length ?? 0,
    wordHistory: activeTurn.wordHistory
  };
};

const getWhoWhatWhereActiveTeamId = (internalState) => internalState.teamOrder[internalState.teamIndex] ?? null;

const getWhoWhatWhereActiveContext = (players, teams, internalState) => {
  const activeTeamId = getWhoWhatWhereActiveTeamId(internalState);
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;
  const activeTeamPlayers = getTeamPlayers(players, activeTeamId);
  const describerIndex = activeTeamPlayers.length === 0 ? 0 : (internalState.describerIndexes[activeTeamId] ?? 0) % activeTeamPlayers.length;
  const activeDescriber = activeTeamPlayers[describerIndex] ?? null;

  return {
    activeTeamId,
    activeTeam,
    activeTeamPlayers,
    activeDescriberId: activeDescriber?.id ?? null,
    activeDescriberName: activeDescriber?.name ?? 'Waiting'
  };
};

const buildWhoWhatWhereReadyPublicState = ({ players, teams, internalState, lastTurnSummary = null }) => {
  const activeContext = getWhoWhatWhereActiveContext(players, teams, internalState);

  return {
    status: 'round-active',
    stage: 'ready',
    roundNumber: internalState.roundNumber,
    totalRounds: internalState.settings.totalRounds,
    activeTeamId: activeContext.activeTeamId,
    activeTeamName: activeContext.activeTeam?.name ?? 'Team',
    activeDescriberId: activeContext.activeDescriberId,
    activeDescriberName: activeContext.activeDescriberName,
    turn: null,
    lastTurnSummary,
    results: null
  };
};

const buildWhoWhatWhereGameOverPublicState = ({ teams, internalState, lastTurnSummary = null }) => {
  const leaderboard = cloneTeams(teams)
    .sort((left, right) => right.score - left.score)
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      score: team.score
    }));
  const topScore = leaderboard[0]?.score ?? 0;
  const winnerTeamIds = leaderboard.filter((team) => team.score === topScore).map((team) => team.teamId);

  return {
    status: 'game-complete',
    stage: 'game-over',
    roundNumber: internalState.settings.totalRounds,
    totalRounds: internalState.settings.totalRounds,
    activeTeamId: null,
    activeTeamName: null,
    activeDescriberId: null,
    activeDescriberName: null,
    turn: null,
    lastTurnSummary,
    results: {
      leaderboard,
      winnerTeamIds,
      isTie: winnerTeamIds.length > 1
    }
  };
};

const buildWhoWhatWherePrivateState = (players, publicState, internalState, teams) => {
  const teamMap = getTeamMap(teams);
  const activeTurn = internalState.activeTurn;
  const currentWord = activeTurn ? activeTurn.wordQueue[activeTurn.queueIndex] ?? null : null;

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
      canSkip: publicState.stage === 'turn' && isDescriber,
      canEndTurn: publicState.stage === 'turn' && isDescriber,
      category: publicState.stage === 'turn' ? activeTurn?.category ?? null : null,
      word: publicState.stage === 'turn' && isDescriber ? currentWord : null
    };
  });
};

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
        prompt: previousEntry?.type === 'prompt' || previousEntry?.type === 'guess' ? previousEntry.text : null,
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

const buildImposterState = ({ players, word }) => {
  const turnOrder = getPlayerIds(players);
  const imposter = randomItem(players);
  const publicState = {
    status: 'round-active',
    stage: 'clues',
    clueCount: 0,
    clues: [],
    currentTurnPlayerId: turnOrder[0] ?? null,
    turnIndex: 0,
    totalTurns: turnOrder.length,
    votesSubmitted: 0,
    results: null
  };
  const internalState = {
    word,
    imposterId: imposter.id,
    turnOrder,
    votes: {}
  };

  return {
    publicState,
    privateState: buildImposterPrivateState(players, publicState, internalState),
    internalState
  };
};

const pickWhoWhatWhereCategory = (wordStore) => {
  const categories = wordStore.getCategories(GAME_WORD_TYPE.whowhatwhere);
  if (categories.length === 0) {
    return null;
  }

  return randomItem(categories);
};

const collectWhoWhatWhereWordQueue = (wordStore, category) => {
  const words = wordStore.getWordsForCategory(GAME_WORD_TYPE.whowhatwhere, category);
  return shuffleArray(words.map((word) => normalizeText(word)).filter(Boolean));
};

const buildWhoWhatWhereState = ({ players, teams, settings }) => {
  const sanitizedSettings = sanitizeWhoWhatWhereSettings(settings);
  const nextTeams = cloneTeams(teams).map((team) => ({ ...team, score: 0 }));
  const teamOrder = nextTeams.map((team) => team.id);
  const describerIndexes = Object.fromEntries(teamOrder.map((teamId) => [teamId, 0]));
  const internalState = {
    settings: sanitizedSettings,
    teamOrder,
    teamIndex: 0,
    roundNumber: 1,
    describerIndexes,
    activeTurn: null
  };
  const publicState = buildWhoWhatWhereReadyPublicState({
    players,
    teams: nextTeams,
    internalState,
    lastTurnSummary: null
  });

  return {
    publicState,
    privateState: buildWhoWhatWherePrivateState(players, publicState, internalState, nextTeams),
    internalState,
    teams: nextTeams
  };
};

const buildDrawNGuessState = ({ players, word }) => {
  const turnOrder = getPlayerIds(players);
  const publicState = {
    status: 'round-active',
    stage: 'draw',
    activePlayerId: turnOrder[0] ?? null,
    stageNumber: 1,
    totalStages: turnOrder.length,
    submissions: 0,
    promptLength: word.length,
    results: null
  };
  const internalState = {
    turnOrder,
    stageIndex: 0,
    chain: [{ type: 'prompt', text: word, submittedBy: null }]
  };

  return {
    publicState,
    privateState: buildDrawNGuessPrivateState(players, publicState, internalState),
    internalState
  };
};

const GAME_BUILDERS = {
  imposter: buildImposterState,
  whowhatwhere: buildWhoWhatWhereState,
  drawnguess: buildDrawNGuessState
};

function applyImposterAction({ players, playerId, action, publicState, internalState }) {
  if (action.type === 'submit-clue') {
    if (publicState.stage !== 'clues') {
      return { error: 'Clues are no longer being collected' };
    }

    if (publicState.currentTurnPlayerId !== playerId) {
      return { error: 'It is not your turn to submit a clue' };
    }

    const clue = normalizeText(action.payload?.text);
    if (!clue) {
      return { error: 'Enter a clue before submitting' };
    }

    if (clue.length > MAX_CLUE_LENGTH) {
      return { error: `Clues must be ${MAX_CLUE_LENGTH} characters or fewer` };
    }

    const nextTurnIndex = publicState.turnIndex + 1;
    const clues = [...publicState.clues, { playerId, text: clue }];
    const nextPublicState =
      nextTurnIndex < internalState.turnOrder.length
        ? {
            ...publicState,
            clueCount: clues.length,
            clues,
            currentTurnPlayerId: internalState.turnOrder[nextTurnIndex],
            turnIndex: nextTurnIndex
          }
        : {
            ...publicState,
            clueCount: clues.length,
            clues,
            stage: 'voting',
            currentTurnPlayerId: null,
            turnIndex: nextTurnIndex,
            votesSubmitted: 0
          };

    return {
      publicState: nextPublicState,
      privateState: buildImposterPrivateState(players, nextPublicState, internalState),
      internalState
    };
  }

  if (action.type === 'cast-vote') {
    if (publicState.stage !== 'voting') {
      return { error: 'Voting is not active right now' };
    }

    if (internalState.votes[playerId]) {
      return { error: 'You have already voted' };
    }

    const targetPlayerId = action.payload?.targetPlayerId;
    if (!hasPlayer(players, targetPlayerId)) {
      return { error: 'Select a valid player to accuse' };
    }

    if (targetPlayerId === playerId) {
      return { error: 'You cannot vote for yourself' };
    }

    const votes = { ...internalState.votes, [playerId]: targetPlayerId };
    const votesSubmitted = Object.keys(votes).length;
    const nextInternalState = { ...internalState, votes };

    if (votesSubmitted < players.length) {
      const nextPublicState = {
        ...publicState,
        votesSubmitted
      };

      return {
        publicState: nextPublicState,
        privateState: buildImposterPrivateState(players, nextPublicState, nextInternalState),
        internalState: nextInternalState
      };
    }

    const voteCounts = players.reduce((counts, player) => {
      counts[player.id] = 0;
      return counts;
    }, {});

    for (const targetId of Object.values(votes)) {
      voteCounts[targetId] += 1;
    }

    const highestVoteCount = Math.max(...Object.values(voteCounts));
    const leadingPlayers = Object.entries(voteCounts)
      .filter(([, count]) => count === highestVoteCount)
      .map(([targetId]) => targetId);
    const accusedPlayerId = leadingPlayers.length === 1 ? leadingPlayers[0] : null;
    const crewWon = accusedPlayerId === internalState.imposterId;
    const nextPublicState = {
      ...publicState,
      stage: 'results',
      status: 'round-complete',
      votesSubmitted,
      results: {
        outcome: crewWon ? 'crew' : 'imposter',
        reason:
          accusedPlayerId === null
            ? 'The room tied its vote, so the imposter escaped.'
            : crewWon
              ? 'The room identified the imposter.'
              : 'The room accused the wrong player.',
        imposterId: internalState.imposterId,
        secretWord: internalState.word,
        accusedPlayerId,
        voteTally: players.map((player) => ({
          playerId: player.id,
          votes: voteCounts[player.id] ?? 0
        })),
        votes: Object.entries(votes).map(([voterId, targetId]) => ({
          voterId,
          targetId
        }))
      }
    };

    return {
      publicState: nextPublicState,
      privateState: buildImposterPrivateState(players, nextPublicState, nextInternalState),
      internalState: nextInternalState
    };
  }

  return { error: 'Unknown action for Imposter' };
}

function finishWhoWhatWhereTurn({ players, teams, internalState }) {
  const activeContext = getWhoWhatWhereActiveContext(players, teams, internalState);
  const activeTurn = internalState.activeTurn;

  if (!activeTurn || !activeContext.activeTeamId) {
    return { error: 'The turn is not active right now' };
  }

  const nextTeams = cloneTeams(teams).map((team) =>
    team.id === activeContext.activeTeamId
      ? { ...team, score: team.score + activeTurn.score }
      : team
  );

  const lastTurnSummary = {
    teamId: activeContext.activeTeamId,
    teamName: activeContext.activeTeam?.name ?? 'Team',
    describerId: activeContext.activeDescriberId,
    describerName: activeContext.activeDescriberName,
    scoreDelta: activeTurn.score,
    correctCount: activeTurn.correctCount,
    skippedCount: activeTurn.skippedCount,
    freeSkipsRemaining: activeTurn.freeSkipsRemaining,
    words: activeTurn.wordHistory
  };

  const currentTeamPlayers = activeContext.activeTeamPlayers;
  const currentDescriberIndex = internalState.describerIndexes[activeContext.activeTeamId] ?? 0;
  const nextDescriberIndexes = {
    ...internalState.describerIndexes,
    [activeContext.activeTeamId]:
      currentTeamPlayers.length === 0 ? 0 : (currentDescriberIndex + 1) % currentTeamPlayers.length
  };

  let nextTeamIndex = internalState.teamIndex + 1;
  let nextRoundNumber = internalState.roundNumber;

  if (nextTeamIndex >= internalState.teamOrder.length) {
    nextTeamIndex = 0;
    nextRoundNumber += 1;
  }

  const nextInternalState = {
    ...internalState,
    describerIndexes: nextDescriberIndexes,
    teamIndex: nextTeamIndex,
    roundNumber: nextRoundNumber,
    activeTurn: null
  };

  if (nextRoundNumber > internalState.settings.totalRounds) {
    const nextPublicState = buildWhoWhatWhereGameOverPublicState({
      teams: nextTeams,
      internalState: nextInternalState,
      lastTurnSummary
    });

    return {
      publicState: nextPublicState,
      privateState: buildWhoWhatWherePrivateState(players, nextPublicState, nextInternalState, nextTeams),
      internalState: nextInternalState,
      teams: nextTeams
    };
  }

  const nextPublicState = buildWhoWhatWhereReadyPublicState({
    players,
    teams: nextTeams,
    internalState: nextInternalState,
    lastTurnSummary
  });

  return {
    publicState: nextPublicState,
    privateState: buildWhoWhatWherePrivateState(players, nextPublicState, nextInternalState, nextTeams),
    internalState: nextInternalState,
    teams: nextTeams
  };
}

function applyWhoWhatWhereAction({ players, teams, playerId, action, publicState, internalState, wordStore }) {
  const safeTeams = cloneTeams(teams);

  if (action.type === 'start-turn') {
    const activeContext = getWhoWhatWhereActiveContext(players, safeTeams, internalState);

    if (publicState.stage !== 'ready') {
      return { error: 'The room is already in a live turn' };
    }

    if (playerId !== activeContext.activeDescriberId) {
      return { error: 'Only the active describer can start this turn' };
    }

    const category = pickWhoWhatWhereCategory(wordStore);
    if (!category) {
      return { error: 'Unable to load categories for this turn right now' };
    }

    const wordQueue = collectWhoWhatWhereWordQueue(wordStore, category);
    if (wordQueue.length === 0) {
      return { error: 'Unable to load words for the selected category right now' };
    }

    const startedAt = Date.now();
    const activeTurn = {
      startedAt: new Date(startedAt).toISOString(),
      endsAt: new Date(startedAt + internalState.settings.turnDurationSeconds * 1000).toISOString(),
      durationSeconds: internalState.settings.turnDurationSeconds,
      category,
      wordQueue,
      queueIndex: 0,
      score: 0,
      correctCount: 0,
      skippedCount: 0,
      freeSkipsRemaining: internalState.settings.freeSkips,
      wordHistory: []
    };
    const nextInternalState = {
      ...internalState,
      activeTurn
    };
    const nextPublicState = {
      ...publicState,
      stage: 'turn',
      turn: buildWhoWhatWhereTurnSnapshot(activeTurn)
    };

    return {
      publicState: nextPublicState,
      privateState: buildWhoWhatWherePrivateState(players, nextPublicState, nextInternalState, safeTeams),
      internalState: nextInternalState,
      teams: safeTeams
    };
  }

  if (action.type === 'end-turn') {
    const activeContext = getWhoWhatWhereActiveContext(players, safeTeams, internalState);
    const activeTurn = internalState.activeTurn;

    if (publicState.stage !== 'turn' || !activeTurn) {
      return { error: 'There is no active turn to end' };
    }

    const isExpired = isPast(activeTurn.endsAt);
    if (playerId !== activeContext.activeDescriberId && !isExpired) {
      return { error: 'Only the active describer can end the turn early' };
    }

    return finishWhoWhatWhereTurn({
      players,
      teams: safeTeams,
      publicState,
      internalState
    });
  }

  if (!['mark-correct', 'skip-word'].includes(action.type)) {
    return { error: 'Unknown action for WhoWhatWhere' };
  }

  if (publicState.stage !== 'turn' || !internalState.activeTurn) {
    return { error: 'The round is not in an active turn' };
  }

  const activeContext = getWhoWhatWhereActiveContext(players, safeTeams, internalState);
  if (playerId !== activeContext.activeDescriberId) {
    return { error: 'Only the active describer can control the turn' };
  }

  if (isPast(internalState.activeTurn.endsAt)) {
    return finishWhoWhatWhereTurn({
      players,
      teams: safeTeams,
      publicState,
      internalState
    });
  }

  const currentWord = internalState.activeTurn.wordQueue[internalState.activeTurn.queueIndex];
  if (!currentWord) {
    return finishWhoWhatWhereTurn({
      players,
      teams: safeTeams,
      publicState,
      internalState
    });
  }

  const nextActiveTurn = {
    ...internalState.activeTurn,
    wordHistory: [...internalState.activeTurn.wordHistory]
  };

  if (action.type === 'mark-correct') {
    nextActiveTurn.score += 1;
    nextActiveTurn.correctCount += 1;
    nextActiveTurn.wordHistory.push({
      word: currentWord,
      status: 'correct',
      timestamp: nowIso()
    });
  }

  if (action.type === 'skip-word') {
    nextActiveTurn.skippedCount += 1;
    nextActiveTurn.wordHistory.push({
      word: currentWord,
      status: 'skipped',
      timestamp: nowIso()
    });

    if (nextActiveTurn.freeSkipsRemaining > 0) {
      nextActiveTurn.freeSkipsRemaining -= 1;
    } else {
      nextActiveTurn.score -= internalState.settings.skipPenalty;
    }
  }

  nextActiveTurn.queueIndex += 1;

  if (!nextActiveTurn.wordQueue[nextActiveTurn.queueIndex]) {
    nextActiveTurn.wordQueue = [
      ...nextActiveTurn.wordQueue,
      ...collectWhoWhatWhereWordQueue(wordStore, nextActiveTurn.category)
    ];
  }

  if (!nextActiveTurn.wordQueue[nextActiveTurn.queueIndex]) {
    return finishWhoWhatWhereTurn({
      players,
      teams: safeTeams,
      publicState,
      internalState: {
        ...internalState,
        activeTurn: nextActiveTurn
      }
    });
  }

  const nextInternalState = {
    ...internalState,
    activeTurn: nextActiveTurn
  };
  const nextPublicState = {
    ...publicState,
    turn: buildWhoWhatWhereTurnSnapshot(nextActiveTurn)
  };

  return {
    publicState: nextPublicState,
    privateState: buildWhoWhatWherePrivateState(players, nextPublicState, nextInternalState, safeTeams),
    internalState: nextInternalState,
    teams: safeTeams
  };
}

function applyDrawNGuessAction({ players, playerId, action, publicState, internalState }) {
  const isActivePlayer = publicState.activePlayerId === playerId;
  if (!isActivePlayer) {
    return { error: 'Only the active player can submit for this stage' };
  }

  if (action.type === 'submit-drawing') {
    if (publicState.stage !== 'draw') {
      return { error: 'The current stage is not a drawing stage' };
    }

    const imageData = String(action.payload?.imageData ?? '');
    if (!imageData.startsWith('data:image/')) {
      return { error: 'Submit a drawing before continuing' };
    }

    if (imageData.length > MAX_DRAWING_DATA_URL_LENGTH) {
      return { error: 'That drawing is too large to send' };
    }

    const chain = [...internalState.chain, { type: 'drawing', imageData, submittedBy: playerId }];
    return advanceDrawNGuessState({ players, publicState, internalState, chain });
  }

  if (action.type === 'submit-guess') {
    if (publicState.stage !== 'guess') {
      return { error: 'The current stage is not a guessing stage' };
    }

    const text = normalizeText(action.payload?.text);
    if (!text) {
      return { error: 'Enter a guess before continuing' };
    }

    if (text.length > MAX_GUESS_LENGTH) {
      return { error: `Guesses must be ${MAX_GUESS_LENGTH} characters or fewer` };
    }

    const chain = [...internalState.chain, { type: 'guess', text, submittedBy: playerId }];
    return advanceDrawNGuessState({ players, publicState, internalState, chain });
  }

  return { error: 'Unknown action for DrawNGuess' };
}

function advanceDrawNGuessState({ players, publicState, internalState, chain }) {
  const nextStageIndex = internalState.stageIndex + 1;
  const submissions = publicState.submissions + 1;

  if (nextStageIndex >= internalState.turnOrder.length) {
    const nextPublicState = {
      ...publicState,
      status: 'round-complete',
      stage: 'results',
      submissions,
      activePlayerId: null,
      results: {
        chain
      }
    };
    const nextInternalState = {
      ...internalState,
      stageIndex: nextStageIndex,
      chain
    };

    return {
      publicState: nextPublicState,
      privateState: buildDrawNGuessPrivateState(players, nextPublicState, nextInternalState),
      internalState: nextInternalState
    };
  }

  const nextStage = nextStageIndex % 2 === 0 ? 'draw' : 'guess';
  const nextPublicState = {
    ...publicState,
    stage: nextStage,
    activePlayerId: internalState.turnOrder[nextStageIndex],
    stageNumber: nextStageIndex + 1,
    submissions
  };
  const nextInternalState = {
    ...internalState,
    stageIndex: nextStageIndex,
    chain
  };

  return {
    publicState: nextPublicState,
    privateState: buildDrawNGuessPrivateState(players, nextPublicState, nextInternalState),
    internalState: nextInternalState
  };
}

const GAME_ACTION_HANDLERS = {
  imposter: applyImposterAction,
  whowhatwhere: applyWhoWhatWhereAction,
  drawnguess: applyDrawNGuessAction
};

export function getWordTypeForGame(gameId) {
  return GAME_WORD_TYPE[gameId] ?? 'describing';
}

export function getMinPlayersForGame(gameId) {
  return GAME_MIN_PLAYERS[gameId] ?? 2;
}

export function buildGameStartState({ gameId, players, word, teams = [], settings = {}, wordStore }) {
  const builder = GAME_BUILDERS[gameId];
  if (!builder) {
    return {
      publicState: { status: 'not-configured' },
      privateState: new Map(),
      internalState: {}
    };
  }

  return builder({ players, word, teams, settings, wordStore });
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

const buildPrivateState = (players, mapper) =>
  new Map(players.map((player) => [player.id, mapper(player)]));

const DEFAULT_IMPOSTER_SETTINGS = {
  rounds: 2,
  imposterCount: 1
};

const shufflePlayers = (players) =>
  [...players]
    .map((player) => ({ player, sortKey: Math.random() }))
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((entry) => entry.player);

const getVoteTargetCount = (players, settings) =>
  Math.min(settings.imposterCount, Math.max(players.length - 1, 1));

const buildImposterPrivateState = (players, publicState, internalState) =>
  buildPrivateState(players, (player) => ({
    role: internalState.imposterIds.includes(player.id) ? 'imposter' : 'crew',
    word: internalState.imposterIds.includes(player.id) ? null : internalState.word,
    canAdvanceClueTurn:
      publicState.stage === 'clues' && publicState.currentTurnPlayerId === player.id,
    canStartVoting: publicState.stage === 'discussion' && player.id === internalState.hostId,
    canVote: publicState.stage === 'voting' && !internalState.votes[player.id],
    hasVoted: Boolean(internalState.votes[player.id]),
    voteTargetCount: getVoteTargetCount(players, internalState.settings),
    votedForPlayerIds: internalState.votes[player.id] ?? []
  }));

const buildResults = (players, internalState) => {
  const voteCounts = players.reduce((counts, player) => {
    counts[player.id] = 0;
    return counts;
  }, {});

  for (const selections of Object.values(internalState.votes)) {
    for (const targetId of selections) {
      voteCounts[targetId] += 1;
    }
  }

  const rankedPlayers = Object.entries(voteCounts)
    .sort((left, right) => right[1] - left[1])
    .map(([playerId, votes]) => ({ playerId, votes }));
  const accusedPlayerIds = rankedPlayers
    .slice(0, getVoteTargetCount(players, internalState.settings))
    .map((entry) => entry.playerId);
  const crewWon =
    accusedPlayerIds.length === internalState.imposterIds.length &&
    accusedPlayerIds.every((playerId) => internalState.imposterIds.includes(playerId));

  return {
    outcome: crewWon ? 'crew' : 'imposter',
    reason: crewWon
      ? 'The room found every imposter.'
      : 'The room let at least one imposter slip through.',
    imposterIds: internalState.imposterIds,
    imposterId: internalState.imposterIds[0] ?? null,
    secretWord: internalState.word,
    accusedPlayerIds,
    accusedPlayerId: accusedPlayerIds[0] ?? null,
    voteTally: rankedPlayers,
    votes: Object.entries(internalState.votes).map(([voterId, targetPlayerIds]) => ({
      voterId,
      targetPlayerIds
    }))
  };
};

export const buildImposterState = ({ players, word, settings = {}, hostId = null }) => {
  const turnOrder = players.map((player) => player.id);
  const normalizedSettings = {
    ...DEFAULT_IMPOSTER_SETTINGS,
    ...settings
  };
  const imposterIds = shufflePlayers(players)
    .slice(0, Math.min(normalizedSettings.imposterCount, Math.max(players.length - 1, 1)))
    .map((player) => player.id);
  const publicState = {
    status: 'round-active',
    stage: 'clues',
    clueCount: 0,
    clueTurns: [],
    clueRound: 1,
    totalClueRounds: normalizedSettings.rounds,
    currentTurnPlayerId: turnOrder[0] ?? null,
    turnIndex: 0,
    totalTurns: turnOrder.length * normalizedSettings.rounds,
    votesSubmitted: 0,
    results: null
  };
  const internalState = {
    word,
    imposterIds,
    turnOrder,
    settings: normalizedSettings,
    hostId,
    votes: {}
  };

  return {
    publicState,
    privateState: buildImposterPrivateState(players, publicState, internalState),
    internalState
  };
};

export function applyImposterAction({ players, playerId, action, publicState, internalState }) {
  if (action.type === 'advance-clue-turn') {
    if (publicState.stage !== 'clues') {
      return { error: 'Clue turns are no longer active' };
    }

    if (publicState.currentTurnPlayerId !== playerId) {
      return { error: 'It is not your turn yet' };
    }

    const nextTurnIndex = publicState.turnIndex + 1;
    const clueTurns = [
      ...publicState.clueTurns,
      { playerId, roundNumber: publicState.clueRound }
    ];

    const nextPublicState =
      nextTurnIndex < internalState.turnOrder.length
        ? {
            ...publicState,
            clueCount: clueTurns.length,
            clueTurns,
            currentTurnPlayerId: internalState.turnOrder[nextTurnIndex],
            turnIndex: nextTurnIndex
          }
        : publicState.clueRound < internalState.settings.rounds
          ? {
              ...publicState,
              clueCount: clueTurns.length,
              clueTurns,
              clueRound: publicState.clueRound + 1,
              currentTurnPlayerId: internalState.turnOrder[0] ?? null,
              turnIndex: 0
            }
          : {
              ...publicState,
              clueCount: clueTurns.length,
              clueTurns,
              stage: 'discussion',
              currentTurnPlayerId: null,
              turnIndex: nextTurnIndex
            };

    return {
      publicState: nextPublicState,
      privateState: buildImposterPrivateState(players, nextPublicState, internalState),
      internalState
    };
  }

  if (action.type === 'start-voting') {
    if (publicState.stage !== 'discussion') {
      return { error: 'Discussion is not active right now' };
    }

    if (playerId !== internalState.hostId) {
      return { error: 'Only the host can open voting' };
    }

    const nextPublicState = {
      ...publicState,
      stage: 'voting',
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
      return { error: 'You have already voted this round' };
    }

    const submittedTargets = Array.isArray(action.payload?.targetPlayerIds)
      ? action.payload.targetPlayerIds
      : [action.payload?.targetPlayerId].filter(Boolean);
    const targetPlayerIds = [...new Set(submittedTargets)];
    const expectedVotes = getVoteTargetCount(players, internalState.settings);

    if (targetPlayerIds.length !== expectedVotes) {
      return {
        error: `Select ${expectedVotes} player${expectedVotes === 1 ? '' : 's'} to accuse`
      };
    }

    if (
      targetPlayerIds.some((targetPlayerId) => !players.some((player) => player.id === targetPlayerId))
    ) {
      return { error: 'Select valid players to accuse' };
    }

    if (targetPlayerIds.includes(playerId)) {
      return { error: 'You cannot vote for yourself' };
    }

    const votes = {
      ...internalState.votes,
      [playerId]: targetPlayerIds
    };
    const votesSubmitted = Object.keys(votes).length;
    const nextInternalState = {
      ...internalState,
      votes
    };
    const results = votesSubmitted >= players.length ? buildResults(players, nextInternalState) : null;
    const nextPublicState = results
      ? {
          ...publicState,
          stage: 'results',
          votesSubmitted,
          results,
          status: 'round-complete'
        }
      : {
          ...publicState,
          votesSubmitted
        };

    return {
      publicState: nextPublicState,
      privateState: buildImposterPrivateState(players, nextPublicState, nextInternalState),
      internalState: nextInternalState
    };
  }

  return { error: 'Unknown action for Imposter' };
}

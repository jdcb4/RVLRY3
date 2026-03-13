import { normalizeText } from '../../../../shared/src/gameCore/teamUtils.js';

const MAX_CLUE_LENGTH = 120;

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const buildPrivateState = (players, mapper) =>
  new Map(players.map((player) => [player.id, mapper(player)]));
const getPlayerIds = (players) => players.map((player) => player.id);

const buildImposterPrivateState = (players, publicState, internalState) =>
  buildPrivateState(players, (player) => ({
    role: player.id === internalState.imposterId ? 'imposter' : 'crew',
    word: player.id === internalState.imposterId ? null : internalState.word,
    canClue: publicState.stage === 'clues' && publicState.currentTurnPlayerId === player.id,
    canVote: publicState.stage === 'voting' && !internalState.votes[player.id],
    hasVoted: Boolean(internalState.votes[player.id]),
    votedForPlayerId: internalState.votes[player.id] ?? null
  }));

const buildResults = (players, internalState) => {
  const voteCounts = players.reduce((counts, player) => {
    counts[player.id] = 0;
    return counts;
  }, {});

  for (const targetId of Object.values(internalState.votes)) {
    voteCounts[targetId] += 1;
  }

  const highestVoteCount = Math.max(...Object.values(voteCounts));
  const leadingPlayers = Object.entries(voteCounts)
    .filter(([, count]) => count === highestVoteCount)
    .map(([playerId]) => playerId);
  const accusedPlayerId = leadingPlayers.length === 1 ? leadingPlayers[0] : null;
  const crewWon = accusedPlayerId === internalState.imposterId;

  return {
    outcome: crewWon ? 'crew' : 'imposter',
    reason:
      accusedPlayerId === null
        ? 'The room tied its vote, so the imposter slipped away.'
        : crewWon
          ? 'The room found the imposter.'
          : 'The room accused the wrong player.',
    imposterId: internalState.imposterId,
    secretWord: internalState.word,
    accusedPlayerId,
    voteTally: players.map((player) => ({
      playerId: player.id,
      votes: voteCounts[player.id] ?? 0
    })),
    votes: Object.entries(internalState.votes).map(([voterId, targetPlayerId]) => ({
      voterId,
      targetPlayerId
    }))
  };
};

export const buildImposterState = ({ players, word }) => {
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

export function applyImposterAction({ players, playerId, action, publicState, internalState }) {
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
      return { error: 'You have already voted this round' };
    }

    const targetPlayerId = action.payload?.targetPlayerId;
    if (!players.some((player) => player.id === targetPlayerId)) {
      return { error: 'Select a valid player to accuse' };
    }

    if (targetPlayerId === playerId) {
      return { error: 'You cannot vote for yourself' };
    }

    const votes = {
      ...internalState.votes,
      [playerId]: targetPlayerId
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

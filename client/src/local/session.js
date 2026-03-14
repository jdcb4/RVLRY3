import {
  applyDrawNGuessAction as applyCoreDrawNGuessAction,
  createDrawNGuessGame
} from '../../../shared/src/gameCore/drawNGuess.js';
import {
  applyHatGameAction as applyCoreHatGameAction,
  buildHatGameCluePool,
  createHatGame,
  getHatGamePhaseMeta
} from '../../../shared/src/gameCore/hatGame.js';
import {
  buildTeams,
  normalizeText,
  sortPlayersBySeat
} from '../../../shared/src/gameCore/teamUtils.js';
import {
  applyWhoWhatWhereAction as applyCoreWhoWhatWhereAction,
  createWhoWhatWhereGame,
  getWhoWhatWhereContext as getCoreWhoWhatWhereContext
} from '../../../shared/src/gameCore/whoWhatWhere.js';

export const MIN_LOCAL_PLAYERS = 2;
export const MAX_LOCAL_PLAYERS = 8;
export const MAX_LOCAL_CLUE_LENGTH = 120;
export const MAX_LOCAL_GUESS_LENGTH = 100;
export const MAX_LOCAL_DRAWING_DATA_URL_LENGTH = 800_000;
export const MAX_LOCAL_HATGAME_CLUE_LENGTH = 80;

export const DEFAULT_LOCAL_PLAYER_COUNT = {
  imposter: 4,
  whowhatwhere: 4,
  drawnguess: 4,
  hatgame: 4
};

export const LOCAL_MIN_PLAYERS_BY_GAME = {
  imposter: 3,
  whowhatwhere: 4,
  drawnguess: 2,
  hatgame: 4
};

export const DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS = {
  teamCount: 2,
  turnDurationSeconds: 45,
  totalRounds: 2,
  skipLimit: 1
};

export const DEFAULT_LOCAL_HATGAME_SETTINGS = {
  teamCount: 2,
  turnDurationSeconds: 45,
  cluesPerPlayer: 6,
  skipsPerTurn: 1
};

export const DEFAULT_LOCAL_IMPOSTER_SETTINGS = {
  rounds: 2,
  imposterCount: 1
};

export const DEFAULT_LOCAL_DRAWNGUESS_SETTINGS = {
  roundDurationSeconds: 45
};

const clampInteger = (value, minimum, maximum, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
};

const sanitizeText = (value, fallback = '') => normalizeText(value, fallback);

const normalizeLocalPlayer = (player, index) => ({
  id: player.id ?? `player-${index + 1}`,
  seat: Number.isFinite(player.seat) ? player.seat : index,
  name: sanitizeText(player.name, `Player ${index + 1}`),
  teamId: player.teamId ?? null
});

export const buildLocalTeams = (teamCount = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.teamCount) =>
  buildTeams(teamCount);

export function rebalanceWhoWhatWherePlayers(players, teamCount) {
  const teamIds = buildLocalTeams(teamCount).map((team) => team.id);
  return sortPlayersBySeat(players).map((player, index) => ({
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
  gameId === 'whowhatwhere' || gameId === 'hatgame' ? 'guessing' : 'describing';

export function getLocalStartError({
  gameId,
  players,
  settings = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS,
  lobbyState = {}
}) {
  const normalizedPlayers = sortPlayersBySeat(players).map(normalizeLocalPlayer);
  const minimumPlayers =
    gameId === 'imposter'
      ? Math.max(LOCAL_MIN_PLAYERS_BY_GAME.imposter, (settings.imposterCount ?? 1) + 2)
      : gameId === 'whowhatwhere' || gameId === 'hatgame'
      ? Math.max(LOCAL_MIN_PLAYERS_BY_GAME[gameId] ?? 4, settings.teamCount * 2)
      : LOCAL_MIN_PLAYERS_BY_GAME[gameId] ?? MIN_LOCAL_PLAYERS;

  if (normalizedPlayers.length < minimumPlayers) {
    return `Need at least ${minimumPlayers} players`;
  }

  if (gameId === 'whowhatwhere' || gameId === 'hatgame') {
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
  skipLimit:
    String(settings.skipLimit ?? DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.skipLimit).toLowerCase() ===
    'unlimited'
      ? -1
      : clampInteger(
          settings.skipLimit,
          1,
          3,
          DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS.skipLimit
        )
});

const sanitizeHatGameSettings = (settings = {}) => ({
  teamCount: clampInteger(settings.teamCount, 2, 4, DEFAULT_LOCAL_HATGAME_SETTINGS.teamCount),
  turnDurationSeconds: clampInteger(
    settings.turnDurationSeconds,
    15,
    120,
    DEFAULT_LOCAL_HATGAME_SETTINGS.turnDurationSeconds
  ),
  cluesPerPlayer: clampInteger(
    settings.cluesPerPlayer,
    3,
    10,
    DEFAULT_LOCAL_HATGAME_SETTINGS.cluesPerPlayer
  ),
  skipsPerTurn: clampInteger(
    settings.skipsPerTurn,
    0,
    5,
    DEFAULT_LOCAL_HATGAME_SETTINGS.skipsPerTurn
  )
});

const sanitizeImposterSettings = (settings = {}) => ({
  rounds: clampInteger(settings.rounds, 1, 4, DEFAULT_LOCAL_IMPOSTER_SETTINGS.rounds),
  imposterCount: clampInteger(
    settings.imposterCount,
    1,
    3,
    DEFAULT_LOCAL_IMPOSTER_SETTINGS.imposterCount
  )
});

const sanitizeDrawNGuessSettings = (settings = {}) => ({
  roundDurationSeconds: clampInteger(
    settings.roundDurationSeconds,
    30,
    60,
    DEFAULT_LOCAL_DRAWNGUESS_SETTINGS.roundDurationSeconds
  )
});

function buildImposterSession({
  players,
  prompt,
  settings = DEFAULT_LOCAL_IMPOSTER_SETTINGS,
  rng = Math.random
}) {
  const orderedPlayers = sortPlayersBySeat(players).map(normalizeLocalPlayer);
  const normalizedSettings = sanitizeImposterSettings(settings);
  const shuffledPlayers = [...orderedPlayers]
    .map((player) => ({ player, sortKey: rng() }))
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((entry) => entry.player);
  const imposterIds = shuffledPlayers
    .slice(0, Math.min(normalizedSettings.imposterCount, Math.max(orderedPlayers.length - 1, 1)))
    .map((player) => player.id);

  return {
    gameId: 'imposter',
    players: orderedPlayers,
    settings: normalizedSettings,
    prompt,
    stage: 'reveal',
    imposterIds,
    revealIndex: 0,
    clueRound: 1,
    clueIndex: 0,
    votingIndex: 0,
    discussionReady: false,
    clueTurns: [],
    votes: {},
    results: null
  };
}

function buildWhoWhatWhereSession({ players, settings = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS }) {
  const normalizedSettings = sanitizeWhoWhatWhereSettings(settings);
  const orderedPlayers = rebalanceWhoWhatWherePlayers(players, normalizedSettings.teamCount);

  return {
    gameId: 'whowhatwhere',
    players: orderedPlayers,
    wordReserves: {},
    ...createWhoWhatWhereGame({
      players: orderedPlayers,
      teams: buildLocalTeams(normalizedSettings.teamCount),
      settings: normalizedSettings
    })
  };
}

function buildHatGameSession({
  players,
  settings = DEFAULT_LOCAL_HATGAME_SETTINGS,
  lobbyState = {},
  rng = Math.random
}) {
  const normalizedSettings = sanitizeHatGameSettings(settings);
  const orderedPlayers = rebalanceWhoWhatWherePlayers(players, normalizedSettings.teamCount);

  return {
    gameId: 'hatgame',
    players: orderedPlayers,
    rng,
    ...createHatGame({
      teams: buildLocalTeams(normalizedSettings.teamCount),
      settings: normalizedSettings,
      cluePool: buildHatGameCluePool(orderedPlayers, lobbyState.clueSubmissions ?? {})
    })
  };
}

function buildDrawNGuessSession({
  players,
  prompt,
  settings = DEFAULT_LOCAL_DRAWNGUESS_SETTINGS
}) {
  const orderedPlayers = sortPlayersBySeat(players).map(normalizeLocalPlayer);
  const normalizedSettings = sanitizeDrawNGuessSettings(settings);

  return {
    gameId: 'drawnguess',
    players: orderedPlayers,
    settings: normalizedSettings,
    ...createDrawNGuessGame({
      players: orderedPlayers,
      prompt,
      settings: normalizedSettings
    })
  };
}

export function buildLocalSession({
  gameId,
  players,
  prompt = '',
  settings = {},
  lobbyState = {},
  rng = Math.random
}) {
  if (gameId === 'imposter') {
    return buildImposterSession({ players, prompt, settings, rng });
  }

  if (gameId === 'whowhatwhere') {
    return buildWhoWhatWhereSession({ players, settings });
  }

  if (gameId === 'drawnguess') {
    return buildDrawNGuessSession({ players, prompt, settings });
  }

  if (gameId === 'hatgame') {
    return buildHatGameSession({ players, settings, lobbyState, rng });
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
  role: session.imposterIds.includes(playerId) ? 'imposter' : 'crew',
  word: session.imposterIds.includes(playerId) ? null : session.prompt
});

const buildImposterResults = (session, votes) => {
  const voteCounts = session.players.reduce((counts, player) => {
    counts[player.id] = 0;
    return counts;
  }, {});

  for (const selections of Object.values(votes)) {
    for (const targetId of selections) {
      voteCounts[targetId] += 1;
    }
  }

  const highestVoteCount = Math.max(...Object.values(voteCounts));
  const leadingPlayers = Object.entries(voteCounts)
    .filter(([, count]) => count === highestVoteCount)
    .map(([playerId]) => playerId);
  const accusedPlayerIds = leadingPlayers.slice(
    0,
    Math.min(session.settings.imposterCount, leadingPlayers.length)
  );
  const imposterIds = session.imposterIds ?? [];
  const crewWon =
    accusedPlayerIds.length === imposterIds.length &&
    accusedPlayerIds.every((playerId) => imposterIds.includes(playerId));

  return {
    outcome: crewWon ? 'crew' : 'imposter',
    reason:
      accusedPlayerIds.length !== imposterIds.length
        ? 'The room split its vote, so the imposters slipped away.'
        : crewWon
          ? 'The room found every imposter.'
          : 'The room accused the wrong player.',
    imposterIds,
    imposterId: imposterIds[0] ?? null,
    secretWord: session.prompt,
    accusedPlayerId: accusedPlayerIds[0] ?? null,
    accusedPlayerIds,
    voteTally: session.players.map((player) => ({
      playerId: player.id,
      votes: voteCounts[player.id] ?? 0
    })),
    votes: Object.entries(votes).map(([voterId, targetPlayerIds]) => ({
      voterId,
      targetPlayerIds
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

  if (action.type === 'advance-clue-turn') {
    if (session.stage !== 'clues') {
      return { error: 'Clue turns are not active right now' };
    }

    const activePlayer = session.players[session.clueIndex];
    const clueTurns = [
      ...session.clueTurns,
      { playerId: activePlayer.id, roundNumber: session.clueRound }
    ];
    const nextClueIndex = session.clueIndex + 1;

    if (nextClueIndex >= session.players.length) {
      if (session.clueRound >= session.settings.rounds) {
        return {
          ...session,
          stage: 'discussion',
          clueTurns,
          discussionReady: false
        };
      }

      return {
        ...session,
        clueTurns,
        clueRound: session.clueRound + 1,
        clueIndex: 0
      };
    }

    return {
      ...session,
      clueTurns,
      clueIndex: nextClueIndex
    };
  }

  if (action.type === 'start-voting') {
    if (session.stage !== 'discussion') {
      return { error: 'Discussion is not active right now' };
    }

    return {
      ...session,
      stage: 'voting',
      votingIndex: 0
    };
  }

  if (action.type === 'submit-vote') {
    if (session.stage !== 'voting') {
      return { error: 'Voting is not active right now' };
    }

    const activePlayer = session.players[session.votingIndex];
    const rawSelections = Array.isArray(action.payload?.targetPlayerIds)
      ? action.payload.targetPlayerIds
      : [action.payload?.targetPlayerId].filter(Boolean);
    const targetPlayerIds = [...new Set(rawSelections)];
    const expectedVotes = Math.min(session.settings.imposterCount, session.players.length - 1);

    if (targetPlayerIds.length !== expectedVotes) {
      return { error: `Choose ${expectedVotes} player${expectedVotes === 1 ? '' : 's'} to accuse` };
    }

    if (
      targetPlayerIds.some(
        (targetPlayerId) => !session.players.some((player) => player.id === targetPlayerId)
      )
    ) {
      return { error: 'Choose valid players to accuse' };
    }

    if (targetPlayerIds.includes(activePlayer.id)) {
      return { error: 'Players cannot vote for themselves' };
    }

    const votes = {
      ...session.votes,
      [activePlayer.id]: targetPlayerIds
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

export function getWhoWhatWhereContext(session) {
  return getCoreWhoWhatWhereContext(session, session.players);
}

function applyLocalWhoWhatWhereAction(session, action) {
  const nextWordReserves = {
    ...(session.wordReserves ?? {})
  };
  const actionPayload =
    action.type === 'start-turn'
      ? {
          ...action.payload,
          words: action.payload?.words ?? [],
          reserveWords: undefined
        }
      : action.payload;

  if (action.type === 'start-turn' && Array.isArray(action.payload?.reserveWords)) {
    nextWordReserves[action.payload.category] = [...action.payload.reserveWords];
  }

  const result = applyCoreWhoWhatWhereAction(session, {
    players: session.players,
    action: {
      ...action,
      payload: actionPayload
    },
    buildMoreWords: (category) => {
      const reserve = nextWordReserves[category] ?? [];
      if (reserve.length === 0) {
        return [];
      }

      const nextWords = reserve.splice(0, 30);
      nextWordReserves[category] = reserve;
      return nextWords;
    }
  });

  return result?.error ? result : { ...session, ...result, wordReserves: nextWordReserves };
}

function applyLocalHatGameAction(session, action) {
  const result = applyCoreHatGameAction(session, {
    players: session.players,
    action,
    rng: session.rng
  });

  return result?.error ? result : { ...session, ...result };
}

function applyLocalDrawNGuessAction(session, action) {
  const result = applyCoreDrawNGuessAction(session, {
    players: session.players,
    action,
    maxGuessLength: MAX_LOCAL_GUESS_LENGTH,
    maxDrawingLength: MAX_LOCAL_DRAWING_DATA_URL_LENGTH
  });

  if (result?.error === 'That drawing is too large to send') {
    return { error: 'That drawing is too large to keep on this device' };
  }

  return result?.error ? result : { ...session, ...result };
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

  if (session.gameId === 'hatgame') {
    return applyLocalHatGameAction(session, action);
  }

  return { error: 'Unsupported local game' };
}

export { getHatGamePhaseMeta };

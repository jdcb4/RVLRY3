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

export const DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS = {
  teamCount: 2,
  turnDurationSeconds: 45,
  totalRounds: 2,
  freeSkips: 1,
  skipPenalty: 1
};

export const DEFAULT_LOCAL_HATGAME_SETTINGS = {
  teamCount: 2,
  turnDurationSeconds: 45,
  cluesPerPlayer: 6,
  skipsPerTurn: 1
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
    gameId === 'whowhatwhere' || gameId === 'hatgame'
      ? Math.max(4, settings.teamCount * 2)
      : 2;

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

  if (gameId === 'hatgame') {
    const requiredClues = settings.cluesPerPlayer ?? DEFAULT_LOCAL_HATGAME_SETTINGS.cluesPerPlayer;
    const clueSubmissions = lobbyState.clueSubmissions ?? {};
    for (const player of normalizedPlayers) {
      const submittedClues = clueSubmissions[player.id]?.clues ?? [];
      const validClueCount = submittedClues.map((clue) => sanitizeText(clue)).filter(Boolean).length;

      if (validClueCount !== requiredClues) {
        return `Each player needs ${requiredClues} saved clues`;
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

function buildImposterSession({ players, prompt, rng = Math.random }) {
  const orderedPlayers = sortPlayersBySeat(players).map(normalizeLocalPlayer);
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

  return {
    gameId: 'whowhatwhere',
    players: orderedPlayers,
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

function buildDrawNGuessSession({ players, prompt }) {
  const orderedPlayers = sortPlayersBySeat(players).map(normalizeLocalPlayer);

  return {
    gameId: 'drawnguess',
    players: orderedPlayers,
    ...createDrawNGuessGame({
      players: orderedPlayers,
      prompt
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
    return buildImposterSession({ players, prompt, rng });
  }

  if (gameId === 'whowhatwhere') {
    return buildWhoWhatWhereSession({ players, settings });
  }

  if (gameId === 'drawnguess') {
    return buildDrawNGuessSession({ players, prompt });
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

export function getWhoWhatWhereContext(session) {
  return getCoreWhoWhatWhereContext(session, session.players);
}

function applyLocalWhoWhatWhereAction(session, action) {
  const result = applyCoreWhoWhatWhereAction(session, {
    players: session.players,
    action
  });

  return result?.error ? result : { ...session, ...result };
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

import {
  buildWhoWhatWhereTeams,
  DEFAULT_HATGAME_SETTINGS,
  DEFAULT_WHOWHATWHERE_SETTINGS
} from './gameEngines/index.js';

export const MAX_HATGAME_CLUE_LENGTH = 80;

const clampInteger = (value, minimum, maximum, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
};

const sanitizeWhoWhatWhereSettings = (settings = {}) => ({
  teamCount: clampInteger(
    settings.teamCount,
    2,
    4,
    DEFAULT_WHOWHATWHERE_SETTINGS.teamCount
  ),
  turnDurationSeconds: clampInteger(
    settings.turnDurationSeconds,
    15,
    90,
    DEFAULT_WHOWHATWHERE_SETTINGS.turnDurationSeconds
  ),
  totalRounds: clampInteger(
    settings.totalRounds,
    1,
    8,
    DEFAULT_WHOWHATWHERE_SETTINGS.totalRounds
  ),
  freeSkips: clampInteger(
    settings.freeSkips,
    0,
    4,
    DEFAULT_WHOWHATWHERE_SETTINGS.freeSkips
  ),
  skipPenalty: clampInteger(
    settings.skipPenalty,
    0,
    3,
    DEFAULT_WHOWHATWHERE_SETTINGS.skipPenalty
  )
});

const sanitizeHatGameSettings = (settings = {}) => ({
  teamCount: clampInteger(settings.teamCount, 2, 4, DEFAULT_HATGAME_SETTINGS.teamCount),
  turnDurationSeconds: clampInteger(
    settings.turnDurationSeconds,
    15,
    120,
    DEFAULT_HATGAME_SETTINGS.turnDurationSeconds
  ),
  cluesPerPlayer: clampInteger(
    settings.cluesPerPlayer,
    3,
    10,
    DEFAULT_HATGAME_SETTINGS.cluesPerPlayer
  ),
  skipsPerTurn: clampInteger(
    settings.skipsPerTurn,
    0,
    5,
    DEFAULT_HATGAME_SETTINGS.skipsPerTurn
  )
});

const getTeamRosterSize = (room, teamId) =>
  room.players.filter((player) => player.teamId === teamId).length;

const validateTeamReady = ({ player, ready }) => {
  if (Boolean(ready) && !player.teamId) {
    return 'Join a team before marking ready';
  }

  return null;
};

const validateTeamStart = (room) => {
  if (room.players.some((player) => !player.teamId)) {
    return 'Every player must join a team before the game starts';
  }

  if (room.teams.some((team) => getTeamRosterSize(room, team.id) < 2)) {
    return 'Each team needs at least 2 players';
  }

  return null;
};

const getHatGameSubmittedClueCount = (room, playerId) =>
  room.lobbyState?.clueSubmissions?.[playerId]?.clues?.length ?? 0;

const getHatGameRequiredClues = (room) =>
  room.settings?.cluesPerPlayer ?? DEFAULT_HATGAME_SETTINGS.cluesPerPlayer;

const sanitizeHatGameLobbyState = (room) => {
  const clueSubmissions = room.lobbyState?.clueSubmissions ?? {};
  const requiredCluesPerPlayer = getHatGameRequiredClues(room);
  const clueCountsByPlayerId = room.players.reduce((counts, player) => {
    counts[player.id] = clueSubmissions[player.id]?.clues?.length ?? 0;
    return counts;
  }, {});

  return {
    requiredCluesPerPlayer,
    clueCountsByPlayerId
  };
};

const getHatGameLobbyPrivateState = (room, player) => {
  const submittedClues = room.lobbyState?.clueSubmissions?.[player.id]?.clues ?? [];
  const requiredCluesPerPlayer = getHatGameRequiredClues(room);

  return {
    clues: [...submittedClues],
    submittedCount: submittedClues.length,
    requiredCluesPerPlayer,
    hasSubmitted: submittedClues.length === requiredCluesPerPlayer
  };
};

const validateHatGameReady = ({ room, player, ready }) => {
  const teamError = validateTeamReady({ player, ready });
  if (teamError) {
    return teamError;
  }

  if (Boolean(ready) && getHatGameSubmittedClueCount(room, player.id) !== getHatGameRequiredClues(room)) {
    return 'Submit all of your clues before marking ready';
  }

  return null;
};

const validateHatGameStart = (room) => {
  const teamError = validateTeamStart(room);
  if (teamError) {
    return teamError;
  }

  const requiredCluesPerPlayer = getHatGameRequiredClues(room);
  if (
    room.players.some(
      (player) => getHatGameSubmittedClueCount(room, player.id) !== requiredCluesPerPlayer
    )
  ) {
    return `Every player must submit ${requiredCluesPerPlayer} clues before the game starts`;
  }

  return null;
};

const normalizeHatGameClues = (room, clues) => {
  const requiredCluesPerPlayer = getHatGameRequiredClues(room);
  const normalizedClues = Array.isArray(clues)
    ? clues.map((clue) => String(clue ?? '').trim())
    : [];

  if (normalizedClues.length !== requiredCluesPerPlayer) {
    return { error: `Submit exactly ${requiredCluesPerPlayer} clues` };
  }

  if (normalizedClues.some((clue) => clue.length === 0)) {
    return { error: 'Fill in every clue before submitting' };
  }

  if (normalizedClues.some((clue) => clue.length > MAX_HATGAME_CLUE_LENGTH)) {
    return {
      error: `Each clue must be ${MAX_HATGAME_CLUE_LENGTH} characters or fewer`
    };
  }

  return { clues: normalizedClues };
};

const BASE_ROOM_GAME = {
  usesTeams: false,
  usesTimedTurns: false,
  needsStartWord: false,
  getDefaultSettings: () => null,
  sanitizeSettings: () => null,
  createTeams: () => null,
  createLobbyState: () => null,
  sanitizeLobbyState: () => undefined,
  getLobbyPrivateState: () => null,
  getRequiredPlayerCount: (minimumPlayers) => minimumPlayers,
  validateReady: () => null,
  validateStart: () => null,
  applySettingsSideEffects: () => {},
  normalizeLobbyClues: null
};

const TEAM_ROOM_GAME = {
  ...BASE_ROOM_GAME,
  usesTeams: true,
  usesTimedTurns: true,
  createTeams: (settings) => buildWhoWhatWhereTeams(settings.teamCount),
  getRequiredPlayerCount: (minimumPlayers, settings) =>
    Math.max(minimumPlayers, (settings?.teamCount ?? 2) * 2),
  validateReady: ({ player, ready }) => validateTeamReady({ player, ready }),
  validateStart: (room) => validateTeamStart(room)
};

const ROOM_GAME_REGISTRY = {
  imposter: {
    ...BASE_ROOM_GAME,
    needsStartWord: true
  },
  drawnguess: {
    ...BASE_ROOM_GAME,
    needsStartWord: true
  },
  whowhatwhere: {
    ...TEAM_ROOM_GAME,
    getDefaultSettings: () => ({ ...DEFAULT_WHOWHATWHERE_SETTINGS }),
    sanitizeSettings: sanitizeWhoWhatWhereSettings
  },
  hatgame: {
    ...TEAM_ROOM_GAME,
    getDefaultSettings: () => ({ ...DEFAULT_HATGAME_SETTINGS }),
    sanitizeSettings: sanitizeHatGameSettings,
    createLobbyState: () => ({ clueSubmissions: {} }),
    sanitizeLobbyState: sanitizeHatGameLobbyState,
    getLobbyPrivateState: getHatGameLobbyPrivateState,
    validateReady: ({ room, player, ready }) =>
      validateHatGameReady({ room, player, ready }),
    validateStart: (room) => validateHatGameStart(room),
    applySettingsSideEffects: (room, previousSettings, nextSettings) => {
      if (nextSettings.cluesPerPlayer === previousSettings.cluesPerPlayer) {
        return;
      }

      room.lobbyState = {
        ...(room.lobbyState ?? {}),
        clueSubmissions: {}
      };

      for (const player of room.players) {
        player.ready = false;
      }
    },
    normalizeLobbyClues: normalizeHatGameClues
  }
};

export const getRoomGameModule = (gameId) =>
  ROOM_GAME_REGISTRY[gameId] ?? BASE_ROOM_GAME;

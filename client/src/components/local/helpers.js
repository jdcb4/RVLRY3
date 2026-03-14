import {
  createLocalPlayers,
  DEFAULT_LOCAL_DRAWNGUESS_SETTINGS,
  DEFAULT_LOCAL_HATGAME_SETTINGS,
  DEFAULT_LOCAL_IMPOSTER_SETTINGS,
  DEFAULT_LOCAL_PLAYER_COUNT,
  DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS
} from '../../local/session';

export const LOCAL_PLAYER_LIMIT = 8;
export const EMPTY_TEAMS = [];

export const createLocalPlayerId = () =>
  window.crypto?.randomUUID?.() ?? `local-${Math.random().toString(36).slice(2, 10)}`;

export const getInitialPlayers = (
  gameId,
  settings = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS
) =>
  createLocalPlayers(DEFAULT_LOCAL_PLAYER_COUNT[gameId] ?? 4, {
    teamCount:
      gameId === 'whowhatwhere' || gameId === 'hatgame' ? settings.teamCount : null
  });

export const getInitialSettingsForGame = (gameId) =>
  gameId === 'hatgame'
    ? DEFAULT_LOCAL_HATGAME_SETTINGS
    : gameId === 'imposter'
      ? DEFAULT_LOCAL_IMPOSTER_SETTINGS
      : gameId === 'drawnguess'
        ? DEFAULT_LOCAL_DRAWNGUESS_SETTINGS
        : DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS;

export const buildEmptyHatGameClues = (count) =>
  Array.from({ length: count }, () => '');

export const getNextLocalPlayerName = (players) => {
  const usedNumbers = new Set(
    players
      .map((player) => /^Player (\d+)$/.exec(String(player.name ?? '').trim())?.[1])
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10))
      .filter(Number.isFinite)
  );

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }

  return `Player ${nextNumber}`;
};

export const rotateLocalRoundPlayers = (players) => {
  if (players.length <= 1) {
    return players;
  }

  return [...players.slice(1), players[0]].map((player, index) => ({
    ...player,
    seat: index
  }));
};

export const syncHatGameClueSubmissions = (
  currentSubmissions,
  players,
  cluesPerPlayer
) =>
  players.reduce((nextSubmissions, player) => {
    const currentClues = currentSubmissions[player.id]?.clues ?? [];
    nextSubmissions[player.id] = {
      clues: Array.from(
        { length: cluesPerPlayer },
        (_, index) => currentClues[index] ?? ''
      )
    };
    return nextSubmissions;
  }, {});

export const buildWhoWhatWhereRosters = (players, teams) =>
  (teams ?? []).map((team) => ({
    ...team,
    players: players.filter((player) => player.teamId === team.id)
  }));

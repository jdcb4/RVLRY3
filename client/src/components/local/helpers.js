import {
  createLocalPlayers,
  DEFAULT_LOCAL_HATGAME_SETTINGS,
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
    : DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS;

export const buildEmptyHatGameClues = (count) =>
  Array.from({ length: count }, () => '');

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

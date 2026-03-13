export const EMPTY_TEAMS = [];

export const getTeamById = (teams, teamId) =>
  teams.find((team) => team.id === teamId) ?? null;

export const buildTeamRosters = (teams, players) =>
  (teams ?? []).map((team) => ({
    ...team,
    players: players.filter((player) => player.teamId === team.id)
  }));

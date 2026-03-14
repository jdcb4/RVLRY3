export const EMPTY_TEAMS = [];

export const getTeamById = (teams, teamId) =>
  teams.find((team) => team.id === teamId) ?? null;

export const buildTeamRosters = (teams, players) =>
  (teams ?? []).map((team) => ({
    ...team,
    players: players.filter((player) => player.teamId === team.id)
  }));

export const buildActiveTeamOrder = (teams, activeTeamId) => {
  if (!teams?.length) {
    return [];
  }

  const activeIndex = teams.findIndex((team) => team.id === activeTeamId);
  if (activeIndex <= 0) {
    return [...teams];
  }

  return [...teams.slice(activeIndex), ...teams.slice(0, activeIndex)];
};

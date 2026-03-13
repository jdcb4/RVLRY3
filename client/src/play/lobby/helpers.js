export const HATGAME_MAX_CLUE_LENGTH = 80;

export const buildInviteLink = (gameId, roomCode) =>
  `${window.location.origin}/play/${gameId}/join/${roomCode}`;

export const buildTeamRosters = (roomState) =>
  (roomState?.teams ?? []).map((team) => ({
    ...team,
    players: roomState.players.filter((player) => player.teamId === team.id)
  }));

export const getStartHint = ({
  roomState,
  game,
  gameModule,
  isHost,
  allPlayersReady
}) => {
  if (!roomState) {
    return 'Lobby is still loading';
  }

  if (!isHost) {
    return 'Only the host can start the game';
  }

  if (gameModule.requiresTeams) {
    const teamCount = roomState.settings?.teamCount ?? 2;
    const requiredPlayers = Math.max(game.minPlayers, teamCount * 2);

    if (roomState.players.length < requiredPlayers) {
      return `Need at least ${requiredPlayers} players to start`;
    }

    const teamRosters = buildTeamRosters(roomState);

    if (roomState.players.some((player) => !player.teamId)) {
      return 'Wait for team assignment to finish';
    }

    if (teamRosters.some((team) => team.players.length < 2)) {
      return 'Each team needs at least 2 players';
    }

    if (gameModule.requiresHatClues) {
      const requiredClues =
        roomState.lobbyState?.requiredCluesPerPlayer ??
        roomState.settings?.cluesPerPlayer ??
        6;
      const clueCountsByPlayerId = roomState.lobbyState?.clueCountsByPlayerId ?? {};

      if (
        roomState.players.some(
          (player) => (clueCountsByPlayerId[player.id] ?? 0) !== requiredClues
        )
      ) {
        return `Every player must submit ${requiredClues} clues`;
      }
    }
  } else if (roomState.players.length < game.minPlayers) {
    return `Need at least ${game.minPlayers} players to start`;
  }

  if (!allPlayersReady) {
    return 'Everyone needs to be ready before the game can start';
  }

  return null;
};

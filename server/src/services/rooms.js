import { randomUUID } from 'node:crypto';
import {
  applyGameAction,
  buildGameStartState,
  getMinPlayersForGame,
  getWordTypeForGame
} from './gameEngines/index.js';
import {
  getRoomGameModule
} from './roomGameRegistry.js';

const ROOM_REJOIN_WINDOW_MS = 2 * 60 * 1000;

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const normalizeCode = (code) => String(code ?? '').trim().toUpperCase();
const normalizePlayerName = (playerName) => String(playerName ?? '').trim() || 'Player';
const normalizeTeamName = (teamName, fallback) => String(teamName ?? '').trim() || fallback;
const getRoomModule = (roomOrGameId) =>
  getRoomGameModule(
    typeof roomOrGameId === 'string' ? roomOrGameId : roomOrGameId?.gameId
  );

const createPlayer = ({
  playerToken,
  playerName,
  socketId,
  seat,
  ready = false,
  teamId = null,
  id = randomUUID()
}) => ({
  id,
  playerToken,
  socketId,
  seat,
  name: normalizePlayerName(playerName),
  ready,
  teamId
});

const sortPlayers = (room) => {
  room.players.sort((left, right) => left.seat - right.seat);
};

const clearRoomExpiry = (room) => {
  if (room.expiryTimer) {
    clearTimeout(room.expiryTimer);
    room.expiryTimer = null;
  }
};

const clearRoomGameTimer = (room) => {
  if (room.gameTimer) {
    clearTimeout(room.gameTimer);
    room.gameTimer = null;
  }
};

const scheduleRoomExpiry = (rooms, room) => {
  clearRoomExpiry(room);
  room.expiryTimer = setTimeout(() => {
    clearRoomGameTimer(room);
    rooms.delete(room.code);
  }, ROOM_REJOIN_WINDOW_MS);
};

const sanitizeRoom = (room) => {
  const roomModule = getRoomModule(room);

  return {
    code: room.code,
    gameId: room.gameId,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      ready: player.ready,
      teamId: player.teamId ?? null
    })),
    teams: room.teams ? room.teams.map((team) => ({ ...team })) : undefined,
    settings: room.settings ? { ...room.settings } : undefined,
    lobbyState: roomModule.sanitizeLobbyState(room),
    gamePublicState: room.gamePublicState
  };
};

const emitRoomUpdate = (io, room) => {
  io.to(room.code).emit('room:update', sanitizeRoom(room));
};

const ensureUniqueCode = (rooms) => {
  let code = randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }
  return code;
};

const getPlayerBySocketId = (room, socketId) =>
  room.players.find((player) => player.socketId === socketId) ?? null;

const movePlayerToRejoinSlots = (room, player) => {
  room.rejoinSlots.set(player.playerToken, {
    id: player.id,
    playerToken: player.playerToken,
    name: player.name,
    seat: player.seat,
    ready: player.ready,
    teamId: player.teamId ?? null
  });
};

const restorePlayerFromRejoinSlot = (room, playerToken, playerName, socketId) => {
  const slot = room.rejoinSlots.get(playerToken);
  if (!slot) {
    return null;
  }

  room.rejoinSlots.delete(playerToken);
  return createPlayer({
    id: slot.id,
    playerToken: slot.playerToken,
    playerName: playerName || slot.name,
    socketId,
    seat: slot.seat,
    ready: room.phase === 'lobby' ? false : slot.ready,
    teamId: slot.teamId ?? null
  });
};

const syncHost = (room) => {
  sortPlayers(room);

  if (room.players.some((player) => player.id === room.hostId)) {
    return;
  }

  room.hostId = room.players[0]?.id ?? room.hostId;
};

const maybeDeleteRoom = (rooms, room) => {
  if (room.players.length > 0) {
    clearRoomExpiry(room);
    return;
  }

  if (room.rejoinSlots.size > 0) {
    scheduleRoomExpiry(rooms, room);
    return;
  }

  clearRoomExpiry(room);
  clearRoomGameTimer(room);
  rooms.delete(room.code);
};

const emitPrivateState = (io, room, player) => {
  const playerPrivate = room.gamePrivateState.get(player.id);
  if (!playerPrivate) {
    return;
  }

  io.to(player.socketId).emit('game:private', {
    gameId: room.gameId,
    phase: room.phase,
    ...playerPrivate
  });
};

const emitLobbyPrivateState = (io, room, player) => {
  if (room.phase !== 'lobby') {
    return;
  }

  const roomModule = getRoomModule(room);
  const privateState = roomModule.getLobbyPrivateState(room, player);
  if (!privateState) {
    return;
  }

  io.to(player.socketId).emit('room:private', {
    gameId: room.gameId,
    phase: room.phase,
    ...privateState
  });
};

const emitAllLobbyPrivateStates = (io, room) => {
  for (const player of room.players) {
    emitLobbyPrivateState(io, room, player);
  }
};

const emitPlayerPrivateState = (io, room, player) => {
  if (room.phase === 'in-progress') {
    emitPrivateState(io, room, player);
    return;
  }

  emitLobbyPrivateState(io, room, player);
};

const getLeastFilledTeamId = (room, teams = room.teams) => {
  const counts = new Map(teams.map((team) => [team.id, 0]));
  for (const player of room.players) {
    if (counts.has(player.teamId)) {
      counts.set(player.teamId, counts.get(player.teamId) + 1);
    }
  }

  let lowestTeamId = teams[0]?.id ?? null;
  let lowestCount = Number.POSITIVE_INFINITY;

  for (const team of teams) {
    const count = counts.get(team.id) ?? 0;
    if (count < lowestCount) {
      lowestCount = count;
      lowestTeamId = team.id;
    }
  }

  return lowestTeamId;
};

const autoAssignTeamPlayer = (room, player) => {
  if (!getRoomModule(room).usesTeams || room.phase !== 'lobby' || room.teams.length === 0) {
    return;
  }

  if (room.teams.some((team) => team.id === player.teamId)) {
    return;
  }

  player.teamId = getLeastFilledTeamId(room);
};

const applyTeamCount = (room, nextTeamCount) => {
  const roomModule = getRoomModule(room);
  if (!roomModule.usesTeams) {
    return;
  }

  const nextSettings = {
    ...(room.settings ?? {}),
    teamCount: nextTeamCount
  };
  const existingTeams = room.teams ?? [];
  const nextTeams = roomModule.createTeams(nextSettings).map((team) => {
    const existing = existingTeams.find((entry) => entry.id === team.id);
    return existing ? { ...team, name: existing.name, score: 0 } : team;
  });

  room.teams = nextTeams;

  for (const player of room.players) {
    player.teamId = null;
    player.ready = false;
  }

  sortPlayers(room);
  for (const player of room.players) {
    autoAssignTeamPlayer(room, player);
  }
};

const scheduleTimedTurnExpiry = (rooms, io, room, wordStore) => {
  clearRoomGameTimer(room);

  if (
    !getRoomModule(room).usesTimedTurns ||
    room.phase !== 'in-progress' ||
    room.gamePublicState?.stage !== 'turn'
  ) {
    return;
  }

  const endsAt = room.gameInternalState?.activeTurn?.endsAt;
  if (!endsAt) {
    return;
  }

  const delay = Math.max(new Date(endsAt).getTime() - Date.now(), 0);
  room.gameTimer = setTimeout(() => {
    if (!rooms.has(room.code)) {
      return;
    }

    if (
      !getRoomModule(room).usesTimedTurns ||
      room.phase !== 'in-progress' ||
      room.gamePublicState?.stage !== 'turn'
    ) {
      clearRoomGameTimer(room);
      return;
    }

    const actingPlayerId = room.gamePublicState.activeDescriberId ?? room.hostId ?? room.players[0]?.id;
    if (!actingPlayerId) {
      clearRoomGameTimer(room);
      return;
    }

    const result = applyGameAction({
      gameId: room.gameId,
      players: room.players,
      teams: room.teams,
      playerId: actingPlayerId,
      action: { type: 'end-turn', payload: {} },
      publicState: room.gamePublicState,
      privateState: room.gamePrivateState,
      internalState: room.gameInternalState,
      wordStore
    });

    if (result.error) {
      clearRoomGameTimer(room);
      return;
    }

    room.gamePublicState = result.publicState;
    room.gamePrivateState = result.privateState;
    room.gameInternalState = result.internalState;
    if (result.teams) {
      room.teams = result.teams;
    }

    for (const roomPlayer of room.players) {
      emitPrivateState(io, room, roomPlayer);
    }

    emitRoomUpdate(io, room);
    scheduleTimedTurnExpiry(rooms, io, room, wordStore);
  }, delay + 25);
};

const createRoomState = ({ code, gameId, hostPlayer }) => {
  const roomModule = getRoomModule(gameId);
  const settings = roomModule.getDefaultSettings();

  return {
    code,
    gameId,
    phase: 'lobby',
    hostId: hostPlayer.id,
    players: [hostPlayer],
    nextSeat: 1,
    rejoinSlots: new Map(),
    gamePublicState: null,
    gamePrivateState: new Map(),
    gameInternalState: null,
    teams: roomModule.usesTeams ? roomModule.createTeams(settings) : null,
    settings,
    lobbyState: roomModule.createLobbyState(settings),
    gameTimer: null,
    expiryTimer: null
  };
};

const resetRoomToLobby = (room) => {
  clearRoomGameTimer(room);
  room.phase = 'lobby';
  room.gamePublicState = null;
  room.gamePrivateState = new Map();
  room.gameInternalState = null;

  for (const player of room.players) {
    player.ready = false;
  }

  if (getRoomModule(room).usesTeams && room.teams) {
    room.teams = room.teams.map((team) => ({
      ...team,
      score: 0
    }));
  }
};

export function registerRoomHandlers(io, wordStore) {
  const rooms = new Map();

  io.on('connection', (socket) => {
    socket.on('room:create', ({ gameId, playerName, playerToken }, callback) => {
      if (!playerToken) {
        callback?.({ error: 'Missing player token' });
        return;
      }

      const code = ensureUniqueCode(rooms);
      const player = createPlayer({
        playerToken,
        playerName,
        socketId: socket.id,
        seat: 0
      });
      const room = createRoomState({ code, gameId, hostPlayer: player });
      autoAssignTeamPlayer(room, player);
      rooms.set(code, room);
      socket.join(code);
      emitRoomUpdate(io, room);
      emitPlayerPrivateState(io, room, player);
      callback?.({ code, playerId: player.id });
    });

    socket.on('room:join', ({ code, playerName, playerToken }, callback) => {
      const normalizedCode = normalizeCode(code);
      const room = rooms.get(normalizedCode);
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      if (!playerToken) {
        callback?.({ error: 'Missing player token' });
        return;
      }

      clearRoomExpiry(room);

      const existingPlayer = room.players.find((player) => player.playerToken === playerToken);
      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        existingPlayer.name = normalizePlayerName(playerName || existingPlayer.name);
        existingPlayer.ready = room.phase === 'lobby' ? false : existingPlayer.ready;
        socket.join(room.code);
        emitRoomUpdate(io, room);
        emitPlayerPrivateState(io, room, existingPlayer);
        callback?.({ ok: true, code: room.code, playerId: existingPlayer.id });
        return;
      }

      const restoredPlayer = restorePlayerFromRejoinSlot(room, playerToken, playerName, socket.id);
      if (restoredPlayer) {
        room.players.push(restoredPlayer);
        autoAssignTeamPlayer(room, restoredPlayer);
        syncHost(room);
        socket.join(room.code);
        emitRoomUpdate(io, room);
        emitPlayerPrivateState(io, room, restoredPlayer);
        callback?.({ ok: true, code: room.code, playerId: restoredPlayer.id });
        return;
      }

      if (room.phase !== 'lobby') {
        callback?.({ error: 'Game already started' });
        return;
      }

      const player = createPlayer({
        playerToken,
        playerName,
        socketId: socket.id,
        seat: room.nextSeat
      });
      room.nextSeat += 1;
      room.players.push(player);
      autoAssignTeamPlayer(room, player);
      syncHost(room);
      socket.join(room.code);
      emitRoomUpdate(io, room);
      emitPlayerPrivateState(io, room, player);
      callback?.({ ok: true, code: room.code, playerId: player.id });
    });

    socket.on('room:assign-team', ({ code, teamId }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      const roomModule = getRoomModule(room);
      if (!roomModule.usesTeams) {
        callback?.({ error: 'Teams are not used in this game' });
        return;
      }

      if (room.phase !== 'lobby') {
        callback?.({ error: 'Teams can only be changed in the lobby' });
        return;
      }

      const player = getPlayerBySocketId(room, socket.id);
      if (!player) {
        callback?.({ error: 'Player not found in room' });
        return;
      }

      if (!room.teams.some((team) => team.id === teamId)) {
        callback?.({ error: 'Select a valid team' });
        return;
      }

      player.teamId = teamId;
      player.ready = false;
      emitRoomUpdate(io, room);
      callback?.({ ok: true });
    });

    socket.on('room:update-team-name', ({ code, teamId, name }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      if (!getRoomModule(room).usesTeams) {
        callback?.({ error: 'Team names are not used in this game' });
        return;
      }

      if (room.phase !== 'lobby') {
        callback?.({ error: 'Team names can only be changed in the lobby' });
        return;
      }

      const player = getPlayerBySocketId(room, socket.id);
      if (!player) {
        callback?.({ error: 'Player not found in room' });
        return;
      }

      if (room.hostId !== player.id) {
        callback?.({ error: 'Only the host can rename teams' });
        return;
      }

      const team = room.teams.find((entry) => entry.id === teamId);
      if (!team) {
        callback?.({ error: 'Select a valid team' });
        return;
      }

      const nextName = normalizeTeamName(name, team.name).slice(0, 24);
      team.name = nextName;
      emitRoomUpdate(io, room);
      callback?.({ ok: true });
    });

    socket.on('room:update-settings', ({ code, settings }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      const roomModule = getRoomModule(room);
      if (!room.settings || !roomModule.sanitizeSettings) {
        callback?.({ error: 'This game does not expose room settings' });
        return;
      }

      if (room.phase !== 'lobby') {
        callback?.({ error: 'Settings can only be changed in the lobby' });
        return;
      }

      const player = getPlayerBySocketId(room, socket.id);
      if (!player) {
        callback?.({ error: 'Player not found in room' });
        return;
      }

      if (room.hostId !== player.id) {
        callback?.({ error: 'Only the host can change room settings' });
        return;
      }

      const previousSettings = room.settings;
      const nextSettings = roomModule.sanitizeSettings(settings);
      const teamCountChanged =
        roomModule.usesTeams && nextSettings.teamCount !== previousSettings.teamCount;
      room.settings = nextSettings;
      if (teamCountChanged) {
        applyTeamCount(room, nextSettings.teamCount);
      }

      roomModule.applySettingsSideEffects(room, previousSettings, nextSettings);

      emitRoomUpdate(io, room);
      if (roomModule.getLobbyPrivateState(room, room.players[0] ?? {}) !== null) {
        emitAllLobbyPrivateStates(io, room);
      }
      callback?.({ ok: true });
    });

    socket.on('room:submit-hat-clues', ({ code, clues }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      const roomModule = getRoomModule(room);
      if (!roomModule.normalizeLobbyClues) {
        callback?.({ error: 'Clue submission is not used in this game' });
        return;
      }

      if (room.phase !== 'lobby') {
        callback?.({ error: 'Clues can only be edited in the lobby' });
        return;
      }

      const player = getPlayerBySocketId(room, socket.id);
      if (!player) {
        callback?.({ error: 'Player not found in room' });
        return;
      }

      const normalizedSubmission = roomModule.normalizeLobbyClues(room, clues);
      if (normalizedSubmission.error) {
        callback?.({ error: normalizedSubmission.error });
        return;
      }

      room.lobbyState = {
        ...(room.lobbyState ?? {}),
        clueSubmissions: {
          ...(room.lobbyState?.clueSubmissions ?? {}),
          [player.id]: {
            clues: normalizedSubmission.clues
          }
        }
      };

      emitRoomUpdate(io, room);
      emitLobbyPrivateState(io, room, player);
      callback?.({ ok: true });
    });

    socket.on('room:ready', ({ code, ready }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      if (room.phase !== 'lobby') {
        callback?.({ error: 'Ready status can only change in the lobby' });
        return;
      }

      const player = getPlayerBySocketId(room, socket.id);
      if (!player) {
        callback?.({ error: 'Player not found in room' });
        return;
      }

      const validationError = getRoomModule(room).validateReady({
        room,
        player,
        ready
      });
      if (validationError) {
        callback?.({ error: validationError });
        return;
      }

      player.ready = Boolean(ready);
      emitRoomUpdate(io, room);
      callback?.({ ok: true });
    });

    socket.on('room:start', ({ code }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      const player = getPlayerBySocketId(room, socket.id);
      if (!player) {
        callback?.({ error: 'Player not found in room' });
        return;
      }

      if (room.hostId !== player.id) {
        callback?.({ error: 'Only the host can start the game' });
        return;
      }

      const roomModule = getRoomModule(room);
      const minimumPlayers = roomModule.getRequiredPlayerCount(
        getMinPlayersForGame(room.gameId),
        room.settings
      );
      if (room.players.length < minimumPlayers) {
        callback?.({ error: `At least ${minimumPlayers} players are required` });
        return;
      }

      if (room.players.some((roomPlayer) => !roomPlayer.ready)) {
        callback?.({ error: 'Everyone must be ready before starting' });
        return;
      }

      const validationError = roomModule.validateStart(room);
      if (validationError) {
        callback?.({ error: validationError });
        return;
      }

      let word = null;
      if (roomModule.needsStartWord) {
        const wordType = getWordTypeForGame(room.gameId);
        word = wordStore.getRandomWord(wordType);

        if (!word) {
          callback?.({ error: 'Words are still syncing. Try again in a moment.' });
          return;
        }
      }

      sortPlayers(room);

      const { publicState, privateState, internalState, teams } = buildGameStartState({
        gameId: room.gameId,
        players: room.players,
        word,
        teams: room.teams,
        settings: room.settings,
        lobbyState: room.lobbyState,
        wordStore
      });

      room.phase = 'in-progress';
      room.gamePublicState = publicState;
      room.gamePrivateState = privateState;
      room.gameInternalState = internalState;
      if (teams) {
        room.teams = teams;
      }

      scheduleTimedTurnExpiry(rooms, io, room, wordStore);

      for (const roomPlayer of room.players) {
        emitPrivateState(io, room, roomPlayer);
      }

      emitRoomUpdate(io, room);
      callback?.({ ok: true });
    });

    socket.on('game:action', ({ code, type, payload }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      if (room.phase !== 'in-progress') {
        callback?.({ error: 'The room is not in an active game' });
        return;
      }

      const player = getPlayerBySocketId(room, socket.id);
      if (!player) {
        callback?.({ error: 'Player not found in room' });
        return;
      }

      const result = applyGameAction({
        gameId: room.gameId,
        players: room.players,
        teams: room.teams,
        playerId: player.id,
        action: { type, payload },
        publicState: room.gamePublicState,
        privateState: room.gamePrivateState,
        internalState: room.gameInternalState,
        wordStore
      });

      if (result.error) {
        callback?.({ error: result.error });
        return;
      }

      room.gamePublicState = result.publicState;
      room.gamePrivateState = result.privateState;
      room.gameInternalState = result.internalState;
      if (result.teams) {
        room.teams = result.teams;
      }

      scheduleTimedTurnExpiry(rooms, io, room, wordStore);

      for (const roomPlayer of room.players) {
        emitPrivateState(io, room, roomPlayer);
      }

      emitRoomUpdate(io, room);
      callback?.({ ok: true });
    });

    socket.on('room:return-to-lobby', ({ code }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      const player = getPlayerBySocketId(room, socket.id);
      if (!player) {
        callback?.({ error: 'Player not found in room' });
        return;
      }

      if (room.hostId !== player.id) {
        callback?.({ error: 'Only the host can return the room to the lobby' });
        return;
      }

      resetRoomToLobby(room);
      emitRoomUpdate(io, room);
      if (getRoomModule(room).getLobbyPrivateState(room, room.players[0] ?? {}) !== null) {
        emitAllLobbyPrivateStates(io, room);
      }
      callback?.({ ok: true });
    });

    socket.on('disconnect', () => {
      for (const room of rooms.values()) {
        const playerIndex = room.players.findIndex((player) => player.socketId === socket.id);
        if (playerIndex === -1) {
          continue;
        }

        const [player] = room.players.splice(playerIndex, 1);
        movePlayerToRejoinSlots(room, player);
        syncHost(room);
        emitRoomUpdate(io, room);
        maybeDeleteRoom(rooms, room);
      }
    });
  });
}

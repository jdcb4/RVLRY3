import { randomUUID } from 'node:crypto';
import {
  applyGameAction,
  buildGameStartState,
  DEFAULT_WHOWHATWHERE_SETTINGS,
  DEFAULT_WHOWHATWHERE_TEAMS,
  getMinPlayersForGame,
  getWordTypeForGame
} from './gameEngines/index.js';

const rooms = new Map();
const ROOM_REJOIN_WINDOW_MS = 2 * 60 * 1000;

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const normalizeCode = (code) => String(code ?? '').trim().toUpperCase();
const normalizePlayerName = (playerName) => String(playerName ?? '').trim() || 'Player';
const normalizeTeamName = (teamName, fallback) => String(teamName ?? '').trim() || fallback;
const cloneTeams = (teams) => teams.map((team) => ({ ...team }));

const clampInteger = (value, minimum, maximum, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
};

const sanitizeWhoWhatWhereSettings = (settings = {}) => ({
  turnDurationSeconds: clampInteger(settings.turnDurationSeconds, 15, 90, DEFAULT_WHOWHATWHERE_SETTINGS.turnDurationSeconds),
  totalRounds: clampInteger(settings.totalRounds, 1, 8, DEFAULT_WHOWHATWHERE_SETTINGS.totalRounds),
  freeSkips: clampInteger(settings.freeSkips, 0, 4, DEFAULT_WHOWHATWHERE_SETTINGS.freeSkips),
  skipPenalty: clampInteger(settings.skipPenalty, 0, 3, DEFAULT_WHOWHATWHERE_SETTINGS.skipPenalty)
});

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

const scheduleRoomExpiry = (room) => {
  clearRoomExpiry(room);
  room.expiryTimer = setTimeout(() => {
    clearRoomGameTimer(room);
    rooms.delete(room.code);
  }, ROOM_REJOIN_WINDOW_MS);
};

const sanitizeRoom = (room) => ({
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
  gamePublicState: room.gamePublicState
});

const emitRoomUpdate = (io, room) => {
  io.to(room.code).emit('room:update', sanitizeRoom(room));
};

const ensureUniqueCode = () => {
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

const maybeDeleteRoom = (room) => {
  if (room.players.length > 0) {
    clearRoomExpiry(room);
    return;
  }

  if (room.rejoinSlots.size > 0) {
    scheduleRoomExpiry(room);
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

const isWhoWhatWhereRoom = (room) => room.gameId === 'whowhatwhere';

const scheduleWhoWhatWhereTurnExpiry = (io, room, wordStore) => {
  clearRoomGameTimer(room);

  if (!isWhoWhatWhereRoom(room) || room.phase !== 'in-progress' || room.gamePublicState?.stage !== 'turn') {
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

    if (!isWhoWhatWhereRoom(room) || room.phase !== 'in-progress' || room.gamePublicState?.stage !== 'turn') {
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
    scheduleWhoWhatWhereTurnExpiry(io, room, wordStore);
  }, delay + 25);
};

const createRoomState = ({ code, gameId, hostPlayer }) => ({
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
  teams: gameId === 'whowhatwhere' ? cloneTeams(DEFAULT_WHOWHATWHERE_TEAMS) : null,
  settings: gameId === 'whowhatwhere' ? { ...DEFAULT_WHOWHATWHERE_SETTINGS } : null,
  gameTimer: null,
  expiryTimer: null
});

const getTeamRosterSize = (room, teamId) => room.players.filter((player) => player.teamId === teamId).length;

const validateWhoWhatWhereRoomForStart = (room) => {
  if (room.players.some((player) => !player.teamId)) {
    return 'Every player must join a team before the game starts';
  }

  const activeTeams = room.teams.filter((team) => getTeamRosterSize(room, team.id) > 0);
  if (activeTeams.length < 2) {
    return 'Both teams need players before you can start';
  }

  if (activeTeams.some((team) => getTeamRosterSize(room, team.id) < 2)) {
    return 'Each team needs at least 2 players';
  }

  return null;
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

  if (isWhoWhatWhereRoom(room) && room.teams) {
    room.teams = room.teams.map((team) => ({
      ...team,
      score: 0
    }));
  }
};

export function registerRoomHandlers(io, wordStore) {
  io.on('connection', (socket) => {
    socket.on('room:create', ({ gameId, playerName, playerToken }, callback) => {
      if (!playerToken) {
        callback?.({ error: 'Missing player token' });
        return;
      }

      const code = ensureUniqueCode();
      const player = createPlayer({
        playerToken,
        playerName,
        socketId: socket.id,
        seat: 0
      });
      const room = createRoomState({ code, gameId, hostPlayer: player });
      rooms.set(code, room);
      socket.join(code);
      emitRoomUpdate(io, room);
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
        if (room.phase === 'in-progress') {
          emitPrivateState(io, room, existingPlayer);
        }
        callback?.({ ok: true, code: room.code, playerId: existingPlayer.id });
        return;
      }

      const restoredPlayer = restorePlayerFromRejoinSlot(room, playerToken, playerName, socket.id);
      if (restoredPlayer) {
        room.players.push(restoredPlayer);
        syncHost(room);
        socket.join(room.code);
        emitRoomUpdate(io, room);
        if (room.phase === 'in-progress') {
          emitPrivateState(io, room, restoredPlayer);
        }
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
      syncHost(room);
      socket.join(room.code);
      emitRoomUpdate(io, room);
      callback?.({ ok: true, code: room.code, playerId: player.id });
    });

    socket.on('room:assign-team', ({ code, teamId }, callback) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      if (!isWhoWhatWhereRoom(room)) {
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

      if (!isWhoWhatWhereRoom(room)) {
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

      if (!isWhoWhatWhereRoom(room)) {
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

      room.settings = sanitizeWhoWhatWhereSettings(settings);
      emitRoomUpdate(io, room);
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

      if (Boolean(ready) && isWhoWhatWhereRoom(room) && !player.teamId) {
        callback?.({ error: 'Join a team before marking ready' });
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

      const minimumPlayers = getMinPlayersForGame(room.gameId);
      if (room.players.length < minimumPlayers) {
        callback?.({ error: `At least ${minimumPlayers} players are required` });
        return;
      }

      if (room.players.some((roomPlayer) => !roomPlayer.ready)) {
        callback?.({ error: 'Everyone must be ready before starting' });
        return;
      }

      if (isWhoWhatWhereRoom(room)) {
        const validationError = validateWhoWhatWhereRoomForStart(room);
        if (validationError) {
          callback?.({ error: validationError });
          return;
        }
      }

      const wordType = getWordTypeForGame(room.gameId);
      const word = wordStore.getRandomWord(wordType);

      if (!word) {
        callback?.({ error: 'Words are still syncing. Try again in a moment.' });
        return;
      }

      sortPlayers(room);

      const { publicState, privateState, internalState, teams } = buildGameStartState({
        gameId: room.gameId,
        players: room.players,
        word,
        teams: room.teams,
        settings: room.settings,
        wordStore
      });

      room.phase = 'in-progress';
      room.gamePublicState = publicState;
      room.gamePrivateState = privateState;
      room.gameInternalState = internalState;
      if (teams) {
        room.teams = teams;
      }

      scheduleWhoWhatWhereTurnExpiry(io, room, wordStore);

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

      scheduleWhoWhatWhereTurnExpiry(io, room, wordStore);

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
        maybeDeleteRoom(room);
      }
    });
  });
}

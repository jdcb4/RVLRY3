import { randomUUID } from 'node:crypto';
import {
  buildGameStartState,
  getMinPlayersForGame,
  getWordTypeForGame
} from './gameEngines/index.js';

const rooms = new Map();
const ROOM_REJOIN_WINDOW_MS = 2 * 60 * 1000;

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const normalizeCode = (code) => String(code ?? '').trim().toUpperCase();
const normalizePlayerName = (playerName) => String(playerName ?? '').trim() || 'Player';

const createPlayer = ({ playerToken, playerName, socketId, id = randomUUID(), ready = false }) => ({
  id,
  playerToken,
  socketId,
  name: normalizePlayerName(playerName),
  ready
});

const clearRoomExpiry = (room) => {
  if (room.expiryTimer) {
    clearTimeout(room.expiryTimer);
    room.expiryTimer = null;
  }
};

const scheduleRoomExpiry = (room) => {
  clearRoomExpiry(room);
  room.expiryTimer = setTimeout(() => {
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
    ready: player.ready
  })),
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
    name: player.name
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
    socketId
  });
};

const syncHost = (room) => {
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
        socketId: socket.id
      });
      const room = {
        code,
        gameId,
        phase: 'lobby',
        hostId: player.id,
        players: [player],
        rejoinSlots: new Map(),
        gamePublicState: null,
        gamePrivateState: new Map(),
        expiryTimer: null
      };
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
        socketId: socket.id
      });
      room.players.push(player);
      socket.join(room.code);
      emitRoomUpdate(io, room);
      callback?.({ ok: true, code: room.code, playerId: player.id });
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

      const wordType = getWordTypeForGame(room.gameId);
      const word = wordStore.getRandomWord(wordType);

      if (!word) {
        callback?.({ error: 'Words are still syncing. Try again in a moment.' });
        return;
      }

      const { publicState, privateState } = buildGameStartState({
        gameId: room.gameId,
        players: room.players,
        word
      });

      room.phase = 'in-progress';
      room.gamePublicState = publicState;
      room.gamePrivateState = privateState;

      for (const player of room.players) {
        emitPrivateState(io, room, player);
      }

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

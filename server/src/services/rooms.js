import { buildGameStartState, getWordTypeForGame } from './gameEngines/index.js';

const rooms = new Map();

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const sanitizeRoom = (room) => ({
  code: room.code,
  gameId: room.gameId,
  phase: room.phase,
  hostId: room.hostId,
  players: room.players.map((player) => ({ id: player.id, name: player.name })),
  gamePublicState: room.gamePublicState
});

const emitRoomUpdate = (io, room) => {
  io.to(room.code).emit('room:update', sanitizeRoom(room));
};

export function registerRoomHandlers(io, wordStore) {
  io.on('connection', (socket) => {
    socket.on('room:create', ({ gameId, playerName }, callback) => {
      const code = randomCode();
      const room = {
        code,
        gameId,
        phase: 'lobby',
        hostId: socket.id,
        players: [{ id: socket.id, name: playerName }],
        gamePublicState: null
      };
      rooms.set(code, room);
      socket.join(code);
      emitRoomUpdate(io, room);
      callback({ code });
    });

    socket.on('room:join', ({ code, playerName }, callback) => {
      const room = rooms.get(code);
      if (!room) {
        callback({ error: 'Room not found' });
        return;
      }
      room.players.push({ id: socket.id, name: playerName });
      socket.join(code);
      emitRoomUpdate(io, room);
      callback({ ok: true });
    });

    socket.on('room:start', ({ code }, callback) => {
      const room = rooms.get(code);
      if (!room) {
        callback({ error: 'Room not found' });
        return;
      }

      if (room.hostId !== socket.id) {
        callback({ error: 'Only the host can start the game' });
        return;
      }

      if (room.players.length < 2) {
        callback({ error: 'At least 2 players are required' });
        return;
      }

      const wordType = getWordTypeForGame(room.gameId);
      const word = wordStore.getRandomWord(wordType);

      if (!word) {
        callback({ error: 'Words are still syncing. Try again in a moment.' });
        return;
      }

      const { publicState, privateState } = buildGameStartState({
        gameId: room.gameId,
        players: room.players,
        word
      });

      room.phase = 'in-progress';
      room.gamePublicState = publicState;

      for (const player of room.players) {
        const playerPrivate = privateState.get(player.id);
        io.to(player.id).emit('game:private', {
          gameId: room.gameId,
          phase: room.phase,
          ...playerPrivate
        });
      }

      emitRoomUpdate(io, room);
      callback({ ok: true });
    });

    socket.on('disconnect', () => {
      for (const room of rooms.values()) {
        const hadPlayer = room.players.some((player) => player.id === socket.id);
        if (!hadPlayer) {
          continue;
        }

        room.players = room.players.filter((player) => player.id !== socket.id);
        if (room.players.length === 0) {
          rooms.delete(room.code);
          continue;
        }

        if (room.hostId === socket.id) {
          room.hostId = room.players[0].id;
        }

        emitRoomUpdate(io, room);
      }
    });
  });
}

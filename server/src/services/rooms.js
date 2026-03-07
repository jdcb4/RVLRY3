const rooms = new Map();

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const sanitizeRoom = (room) => ({
  code: room.code,
  gameId: room.gameId,
  players: room.players.map((player) => ({ id: player.id, name: player.name }))
});

export function registerRoomHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('room:create', ({ gameId, playerName }, callback) => {
      const code = randomCode();
      const room = {
        code,
        gameId,
        players: [{ id: socket.id, name: playerName }]
      };
      rooms.set(code, room);
      socket.join(code);
      io.to(code).emit('room:update', sanitizeRoom(room));
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
      io.to(code).emit('room:update', sanitizeRoom(room));
      callback({ ok: true });
    });

    socket.on('disconnect', () => {
      for (const room of rooms.values()) {
        room.players = room.players.filter((player) => player.id !== socket.id);
        if (room.players.length === 0) {
          rooms.delete(room.code);
          continue;
        }
        io.to(room.code).emit('room:update', sanitizeRoom(room));
      }
    });
  });
}

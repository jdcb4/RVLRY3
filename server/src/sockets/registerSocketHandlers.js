import { getRoom, setRound, updateRoom } from '../rooms/roomStore.js';
import { startRound } from '../services/gameEngine.js';

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('room:subscribe', ({ roomCode }) => {
      socket.join(roomCode);
    });

    socket.on('room:start', ({ roomCode }) => {
      const state = getRoom(roomCode);
      if (!state) {
        return;
      }

      updateRoom(roomCode, { status: 'in-progress' });
      const round = startRound(state.room);
      const updated = setRound(roomCode, round);

      io.to(roomCode).emit('room:update', updated);
    });
  });
}

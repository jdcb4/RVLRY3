import { getWordsForGame } from '../services/wordService.js';

const rooms = new Map();

function getRoom(roomCode, gameType) {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      roomCode,
      gameType,
      players: [],
      promptIndex: 0,
      state: {},
    });
  }
  return rooms.get(roomCode);
}

function broadcastRoom(io, room) {
  io.to(room.roomCode).emit('room:update', {
    players: room.players.map((p) => p.name),
    ...room.state,
  });
}

export function registerGameSocket(io, socket) {
  socket.on('room:join', ({ roomCode, playerName, gameType }) => {
    const room = getRoom(roomCode, gameType);
    if (!room.players.some((player) => player.socketId === socket.id)) {
      room.players.push({ name: playerName, socketId: socket.id });
    }
    socket.join(roomCode);
    broadcastRoom(io, room);
  });

  socket.on('imposter:start-round', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.players.length) return;

    const words = getWordsForGame('imposter').words;
    const prompt = words[Math.floor(Math.random() * words.length)] || 'Mystery';
    const imposterIndex = Math.floor(Math.random() * room.players.length);

    room.players.forEach((player, index) => {
      io.to(player.socketId).emit('room:update', {
        players: room.players.map((p) => p.name),
        role: index === imposterIndex ? 'Imposter' : 'Insider',
        prompt: index === imposterIndex ? '???' : prompt,
      });
    });
  });

  socket.on('drawnguess:next', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const words = getWordsForGame('drawnguess').words;
    room.promptIndex += 1;
    room.state.prompt = words[room.promptIndex % words.length] || 'Sketch this!';
    broadcastRoom(io, room);
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach((roomCode) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.players = room.players.filter((p) => p.socketId !== socket.id);
      broadcastRoom(io, room);
      if (!room.players.length) rooms.delete(roomCode);
    });
  });
}

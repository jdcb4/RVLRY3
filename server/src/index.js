import http from 'node:http';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { addPlayer, createRoom, getRoom } from './rooms/roomStore.js';
import { startRound } from './services/gameEngine.js';
import { getSnapshot } from './services/wordStore.js';
import { startWordSyncJob, syncWordsNow } from './services/wordSyncService.js';
import { registerSocketHandlers } from './sockets/registerSocketHandlers.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'rvlry-server' });
});

app.get('/api/words/status', (_, res) => {
  res.json(getSnapshot());
});

app.post('/api/words/sync', async (_, res) => {
  try {
    await syncWordsNow();
    res.json({ ok: true, ...getSnapshot() });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/rooms', (req, res) => {
  const { gameKey, hostName } = req.body;
  if (!gameKey) {
    res.status(400).json({ message: 'gameKey required' });
    return;
  }

  const state = createRoom(gameKey, hostName || 'Host');
  res.status(201).json(state);
});

app.post('/api/rooms/:roomCode/join', (req, res) => {
  const { roomCode } = req.params;
  const { playerName } = req.body;
  const state = addPlayer(roomCode, playerName || 'Player');

  if (!state) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  res.json(state);
});

app.post('/api/rooms/:roomCode/start', (req, res) => {
  const { roomCode } = req.params;
  const state = getRoom(roomCode);

  if (!state) {
    res.status(404).json({ message: 'Room not found' });
    return;
  }

  state.room.status = 'in-progress';
  state.round = startRound(state.room);

  res.json(state);
});


app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }

  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

registerSocketHandlers(io);

syncWordsNow().catch((error) => {
  console.error('Initial word sync failed:', error.message);
});

startWordSyncJob();

server.listen(env.port, () => {
  console.log(`RVLRY server listening on ${env.port}`);
});

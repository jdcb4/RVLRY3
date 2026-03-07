import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWordsForGame, scheduleWordSync, syncWords } from './services/wordService.js';
import { registerGameSocket } from './sockets/gameSocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'rvlry-server' });
});

app.get('/api/words/:gameType', (req, res) => {
  res.json(getWordsForGame(req.params.gameType));
});

app.post('/api/words/sync', async (_, res) => {
  try {
    const payload = await syncWords();
    res.json({ ok: true, ...payload });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(clientDistPath, 'index.html'));
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
  registerGameSocket(io, socket);
});

const port = process.env.PORT || 3000;
server.listen(port, async () => {
  console.log(`RVLRY server on ${port}`);
  try {
    await syncWords();
  } catch (error) {
    console.warn('Initial word sync failed, using defaults.', error.message);
  }
  scheduleWordSync();
});

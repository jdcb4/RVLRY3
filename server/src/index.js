import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { registerRoomHandlers } from './services/rooms.js';
import { createWordStore } from './services/wordStore.js';
import { wordsRouter } from './routes/words.js';

const app = express();
app.use(cors());
app.use(express.json());

const wordStore = createWordStore();
app.use('/api/words', wordsRouter(wordStore));

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

registerRoomHandlers(io, wordStore);
wordStore.startSchedule();

const port = process.env.PORT ?? 3001;
httpServer.listen(port, () => {
  console.log(`RVLRY server listening on ${port}`);
});

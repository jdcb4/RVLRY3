import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { registerRoomHandlers } from './services/rooms.js';
import { wordsRouter } from './routes/words.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CLIENT_DIST_PATH = path.resolve(__dirname, '../../client/dist');

export function createAppServer({
  wordStore,
  clientDistPath = DEFAULT_CLIENT_DIST_PATH,
  staticFiles = true
}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/words', wordsRouter(wordStore));
  app.get('/api/health', (_, res) => {
    res.json({ ok: true });
  });

  if (staticFiles) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }

      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*'
    }
  });

  registerRoomHandlers(io, wordStore);

  return {
    app,
    httpServer,
    io
  };
}

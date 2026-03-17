import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { lookupRoomSummary, registerRoomHandlers } from './services/rooms.js';
import { adminRouter } from './routes/admin.js';
import { wordsRouter } from './routes/words.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CLIENT_DIST_PATH = path.resolve(__dirname, '../../client/dist');

export function createAppServer({
  wordStore,
  adminPassword = process.env.ADMIN_PASSWORD ?? '',
  clientDistPath = DEFAULT_CLIENT_DIST_PATH,
  staticFiles = true
}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const rooms = new Map();
  const adminSessions = new Map();

  app.use('/api/admin', adminRouter({ wordStore, adminPassword, sessions: adminSessions }));
  app.use('/api/words', wordsRouter(wordStore));
  app.get('/api/rooms/:code', (req, res) => {
    const room = lookupRoomSummary(rooms, req.params.code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    res.json(room);
  });
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

  registerRoomHandlers(io, wordStore, { rooms });

  return {
    app,
    httpServer,
    io
  };
}

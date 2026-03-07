import axios from 'axios';
import cron from 'node-cron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TYPES = ['guessing', 'describing'];
const WORDLIST_BASE_URL = process.env.WORDLIST_BASE_URL ?? 'https://wordlistmanager-production.up.railway.app';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CACHE_PATH = path.resolve(__dirname, '../../data/word-cache.json');

export function createWordStore({ cacheFilePath = DEFAULT_CACHE_PATH } = {}) {
  const wordsByType = new Map();
  let lastSyncAt = null;
  let lastCacheLoadAt = null;

  const persistCache = async () => {
    const payload = {
      lastSyncAt,
      wordsByType: Object.fromEntries(wordsByType.entries())
    };

    await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.writeFile(cacheFilePath, JSON.stringify(payload), 'utf8');
  };

  const loadCache = async () => {
    try {
      const raw = await fs.readFile(cacheFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      const stored = parsed?.wordsByType;
      if (stored && typeof stored === 'object') {
        for (const [type, words] of Object.entries(stored)) {
          if (!Array.isArray(words)) {
            continue;
          }
          wordsByType.set(type, words.filter((word) => typeof word === 'string' && word.trim().length > 0));
        }
      }

      if (typeof parsed?.lastSyncAt === 'string') {
        lastSyncAt = parsed.lastSyncAt;
      }
      lastCacheLoadAt = new Date().toISOString();
    } catch {
      // Cache is optional on first boot or when file is corrupt.
    }
  };

  const syncType = async (type) => {
    const response = await axios.get(`${WORDLIST_BASE_URL}/api/words`, { params: { type } });
    const words = Array.isArray(response.data) ? response.data : response.data.words;

    if (!Array.isArray(words)) {
      throw new Error(`Unexpected payload for type ${type}`);
    }

    const normalized = words
      .map((item) => (typeof item === 'string' ? item : item.word))
      .filter((word) => typeof word === 'string' && word.trim().length > 0);

    wordsByType.set(type, normalized);
  };

  const sync = async () => {
    await Promise.all(DEFAULT_TYPES.map((type) => syncType(type)));
    lastSyncAt = new Date().toISOString();
    await persistCache();
    return { lastSyncAt };
  };

  const initialize = async () => {
    await loadCache();
    try {
      await sync();
    } catch (error) {
      if (wordsByType.size === 0) {
        throw error;
      }
    }
  };

  const getRandomWord = (type) => {
    const words = wordsByType.get(type) ?? [];
    if (words.length === 0) {
      return null;
    }
    return words[Math.floor(Math.random() * words.length)];
  };

  const startSchedule = () => {
    cron.schedule('0 0 * * 0', () => {
      sync().catch(() => undefined);
    });
  };

  return {
    getRandomWord,
    initialize,
    sync,
    startSchedule,
    status: () => ({
      lastSyncAt,
      lastCacheLoadAt,
      loadedTypes: [...wordsByType.keys()],
      cacheFilePath
    })
  };
}

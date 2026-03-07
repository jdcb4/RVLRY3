import axios from 'axios';
import cron from 'node-cron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TYPES = ['guessing', 'describing'];
const WORDLIST_BASE_URL = process.env.WORDLIST_BASE_URL ?? 'https://wordlistmanager-production.up.railway.app';
const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const WORDLIST_REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.WORDLIST_REQUEST_TIMEOUT_MS, 10000);
const WORDLIST_PAGE_SIZE = parsePositiveInt(process.env.WORDLIST_PAGE_SIZE, 1000);
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

  const normalizeWords = (items) =>
    [...new Set(
      items
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          if (item && typeof item === 'object') {
            return item.word ?? item.sanitized_text ?? item.text;
          }
          return null;
        })
        .filter((word) => typeof word === 'string' && word.trim().length > 0)
    )];

  const syncTypeFromV1Api = async (type) => {
    const words = [];
    let offset = 0;
    let totalCount = null;

    while (true) {
      const response = await axios.get(`${WORDLIST_BASE_URL}/api/v1/words/`, {
        params: {
          word_type: type,
          limit: WORDLIST_PAGE_SIZE,
          offset
        },
        timeout: WORDLIST_REQUEST_TIMEOUT_MS
      });

      const payload = response.data ?? {};
      const page = Array.isArray(payload.results) ? payload.results : [];
      const count = Number(payload.count);

      if (Number.isFinite(count) && count >= 0) {
        totalCount = count;
      }

      words.push(...normalizeWords(page));
      offset += page.length;

      if (page.length === 0) {
        break;
      }

      if (totalCount !== null && offset >= totalCount) {
        break;
      }
    }

    return [...new Set(words)];
  };

  const syncTypeFromLegacyApi = async (type) => {
    const response = await axios.get(`${WORDLIST_BASE_URL}/api/words`, {
      params: { type },
      timeout: WORDLIST_REQUEST_TIMEOUT_MS
    });
    const words = Array.isArray(response.data) ? response.data : response.data?.words;

    if (!Array.isArray(words)) {
      throw new Error(`Unexpected legacy payload for type ${type}`);
    }

    return normalizeWords(words);
  };

  const syncType = async (type) => {
    const syncStrategies = [syncTypeFromV1Api, syncTypeFromLegacyApi];
    const errors = [];

    for (const strategy of syncStrategies) {
      try {
        const normalized = await strategy(type);
        if (normalized.length === 0) {
          throw new Error(`No words returned for type ${type}`);
        }
        wordsByType.set(type, normalized);
        return;
      } catch (error) {
        errors.push(error);
      }
    }

    const details = errors
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join(' | ');

    throw new Error(`Unable to sync words for type "${type}" (${details})`);
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

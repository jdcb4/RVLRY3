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
  const recordsByType = new Map();
  const wordsByType = new Map();
  let lastSyncAt = null;
  let lastCacheLoadAt = null;

  const persistCache = async () => {
    const payload = {
      lastSyncAt,
      recordsByType: Object.fromEntries(recordsByType.entries())
    };

    await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
    await fs.writeFile(cacheFilePath, JSON.stringify(payload), 'utf8');
  };

  const loadCache = async () => {
    try {
      const raw = await fs.readFile(cacheFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      const storedRecords = parsed?.recordsByType;
      if (storedRecords && typeof storedRecords === 'object') {
        for (const [type, records] of Object.entries(storedRecords)) {
          if (!Array.isArray(records)) {
            continue;
          }
          const normalizedRecords = normalizeRecords(records);
          recordsByType.set(type, normalizedRecords);
          wordsByType.set(type, normalizedRecords.map((record) => record.word));
        }
      } else {
        const storedWords = parsed?.wordsByType;
        if (storedWords && typeof storedWords === 'object') {
          for (const [type, words] of Object.entries(storedWords)) {
            if (!Array.isArray(words)) {
              continue;
            }
            const normalizedRecords = normalizeRecords(words);
            recordsByType.set(type, normalizedRecords);
            wordsByType.set(type, normalizedRecords.map((record) => record.word));
          }
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

  const normalizeRecords = (items) => {
    const seen = new Set();

    return items
      .map((item) => {
        if (typeof item === 'string') {
          const word = item.trim();
          return word ? { word, category: null, hint: null } : null;
        }

        if (item && typeof item === 'object') {
          const word = String(item.word ?? item.sanitized_text ?? item.text ?? '').trim();
          const category = String(item.category ?? '').trim() || null;
          const hint = String(item.hint ?? '').trim() || null;

          if (!word) {
            return null;
          }

          return { word, category, hint };
        }

        return null;
      })
      .filter(Boolean)
      .filter((record) => {
        const key = `${record.category ?? ''}\u0000${record.word}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  };

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

      words.push(...normalizeRecords(page));
      offset += page.length;

      if (page.length === 0) {
        break;
      }

      if (totalCount !== null && offset >= totalCount) {
        break;
      }
    }

    return words;
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

    return normalizeRecords(words);
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
        recordsByType.set(type, normalized);
        wordsByType.set(type, normalized.map((record) => record.word));
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

  const getWords = (type) => [...(wordsByType.get(type) ?? [])];

  const getCategories = (type) =>
    [...new Set((recordsByType.get(type) ?? []).map((record) => record.category).filter(Boolean))];

  const getWordsForCategory = (type, category) =>
    (recordsByType.get(type) ?? [])
      .filter((record) => record.category === category)
      .map((record) => record.word);

  const startSchedule = () => {
    cron.schedule('0 0 * * 0', () => {
      sync().catch(() => undefined);
    });
  };

  return {
    getRandomWord,
    getWords,
    getCategories,
    getWordsForCategory,
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

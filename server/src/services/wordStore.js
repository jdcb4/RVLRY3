import axios from 'axios';
import cron from 'node-cron';

const DEFAULT_TYPES = ['guessing', 'describing'];
const WORDLIST_BASE_URL = process.env.WORDLIST_BASE_URL ?? 'https://wordlistmanager-production.up.railway.app';

export function createWordStore() {
  const wordsByType = new Map();
  let lastSyncAt = null;

  const syncType = async (type) => {
    const response = await axios.get(`${WORDLIST_BASE_URL}/api/words`, { params: { type } });
    const words = Array.isArray(response.data) ? response.data : response.data.words;
    if (Array.isArray(words) && words.length > 0) {
      wordsByType.set(type, words.map((item) => (typeof item === 'string' ? item : item.word)).filter(Boolean));
    }
  };

  const sync = async () => {
    await Promise.all(DEFAULT_TYPES.map((type) => syncType(type)));
    lastSyncAt = new Date().toISOString();
    return { lastSyncAt };
  };

  const getRandomWord = (type) => {
    const words = wordsByType.get(type) ?? [];
    if (words.length === 0) {
      return null;
    }
    return words[Math.floor(Math.random() * words.length)];
  };

  const startSchedule = () => {
    sync().catch(() => undefined);
    cron.schedule('0 0 * * 0', () => {
      sync().catch(() => undefined);
    });
  };

  return {
    getRandomWord,
    sync,
    startSchedule,
    status: () => ({
      lastSyncAt,
      loadedTypes: [...wordsByType.keys()]
    })
  };
}

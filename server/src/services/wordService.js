import cron from 'node-cron';
import { DEFAULT_WORDS, GAME_WORD_TYPES } from '../lib/gameConfig.js';

const WORD_MANAGER_URL = process.env.WORD_MANAGER_URL || 'https://wordlistmanager-production.up.railway.app';
const store = {
  words: structuredClone(DEFAULT_WORDS),
  lastSync: null,
};

async function fetchWordsByType(type) {
  const response = await fetch(`${WORD_MANAGER_URL}/api/words?type=${type}`);
  if (!response.ok) throw new Error(`Word manager request failed with status ${response.status}`);
  const payload = await response.json();
  const words = payload.words || payload.data || [];
  return words.map((entry) => (typeof entry === 'string' ? entry : entry.word)).filter(Boolean);
}

export async function syncWords() {
  const nextStore = {};
  for (const [gameType, wordType] of Object.entries(GAME_WORD_TYPES)) {
    const words = await fetchWordsByType(wordType);
    nextStore[gameType] = words.length ? words : DEFAULT_WORDS[gameType];
  }
  store.words = nextStore;
  store.lastSync = new Date().toISOString();
  return store;
}

export function scheduleWordSync() {
  cron.schedule('0 5 * * 1', async () => {
    try {
      await syncWords();
      console.log('[words] weekly sync complete');
    } catch (error) {
      console.error('[words] weekly sync failed', error.message);
    }
  });
}

export function getWordsForGame(gameType) {
  return {
    words: store.words[gameType] || [],
    lastSync: store.lastSync,
  };
}

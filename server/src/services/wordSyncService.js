import cron from 'node-cron';
import { env } from '../config/env.js';
import { setWords } from './wordStore.js';

const typeMap = {
  guessing: ['whowhatwhere'],
  describing: ['imposter', 'drawnguess']
};

async function fetchWordsByType(type) {
  const url = `${env.wordManagerBaseUrl}/api/words?type=${type}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Word sync failed for ${type}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload.words)) {
    return [];
  }

  return payload.words;
}

export async function syncWordsNow() {
  const entries = Object.keys(typeMap);
  await Promise.all(
    entries.map(async (type) => {
      const words = await fetchWordsByType(type);
      setWords(type, words);
    })
  );
}

export function startWordSyncJob() {
  cron.schedule(env.syncSchedule, () => {
    syncWordsNow().catch((error) => {
      console.error('Scheduled word sync failed:', error.message);
    });
  });
}

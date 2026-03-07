import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { fetchWordsByType } from './wordApi';
import {
  getWordSyncMetadata,
  saveWordList,
  saveWordSyncMetadata,
} from './wordStore';

const WORD_TYPES = ['guessing', 'describing'];
const SYNC_INTERVAL_DAYS = 7;

export function useWeeklyWordSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const lists = await Promise.all(WORD_TYPES.map((type) => fetchWordsByType(type)));
      await Promise.all(lists.map((list, index) => saveWordList(WORD_TYPES[index], list)));

      const metadata = {
        syncedAt: new Date().toISOString(),
        types: WORD_TYPES,
      };

      await saveWordSyncMetadata(metadata);
      setLastSync(metadata.syncedAt);
    } catch (syncError) {
      setError(syncError);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    async function hydrateSyncStatus() {
      const metadata = await getWordSyncMetadata();
      const syncedAt = metadata?.syncedAt;
      setLastSync(syncedAt ?? null);

      if (!syncedAt || dayjs().diff(dayjs(syncedAt), 'day') >= SYNC_INTERVAL_DAYS) {
        await syncNow();
      }
    }

    hydrateSyncStatus();
  }, [syncNow]);

  return {
    isSyncing,
    error,
    lastSync,
    syncNow,
  };
}

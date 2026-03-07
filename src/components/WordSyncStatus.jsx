import dayjs from 'dayjs';

function WordSyncStatus({ isSyncing, lastSync, onSync, error }) {
  return (
    <section className="sync-banner">
      <div>
        <strong>Word lists:</strong>{' '}
        {lastSync ? `Updated ${dayjs(lastSync).format('MMM D, YYYY h:mm A')}` : 'Not synced yet'}
      </div>
      <div className="sync-actions">
        <button type="button" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? 'Syncing...' : 'Sync now'}
        </button>
        {error && <small>Sync failed. Retrying in background.</small>}
      </div>
    </section>
  );
}

export default WordSyncStatus;

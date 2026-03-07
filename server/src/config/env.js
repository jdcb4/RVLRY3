export const env = {
  port: Number(process.env.PORT || 3000),
  wordManagerBaseUrl:
    process.env.WORD_MANAGER_BASE_URL || 'https://wordlistmanager-production.up.railway.app',
  syncSchedule: process.env.WORD_SYNC_CRON || '0 3 * * 1'
};

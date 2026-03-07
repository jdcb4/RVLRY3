const headers = { 'Content-Type': 'application/json' };

export async function fetchGameWords(gameType) {
  const response = await fetch(`/api/words/${gameType}`);
  if (!response.ok) throw new Error('Failed to fetch words');
  return response.json();
}

export async function triggerWordSync() {
  const response = await fetch('/api/words/sync', { method: 'POST', headers });
  if (!response.ok) throw new Error('Sync trigger failed');
  return response.json();
}

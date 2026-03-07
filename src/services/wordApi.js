import axios from 'axios';

const WORD_API_BASE_URL = import.meta.env.VITE_WORD_API_BASE_URL || 'https://wordlistmanager-production.up.railway.app';

const client = axios.create({
  baseURL: WORD_API_BASE_URL,
  timeout: 10000,
});

export async function fetchWordsByType(type) {
  const response = await client.get('/api/words', {
    params: {
      type,
      limit: 500,
    },
  });

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return response.data.words || [];
}

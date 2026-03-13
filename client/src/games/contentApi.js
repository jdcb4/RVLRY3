const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Unable to load game content');
  }

  return response.json();
};

export const fetchRandomWord = async (type) => {
  const payload = await fetchJson(`/api/words/random?type=${encodeURIComponent(type)}`);
  const word = String(payload.word ?? '').trim();
  if (!word) {
    throw new Error('No prompt available right now');
  }

  return word;
};

export const fetchWordDeck = async ({ type, category = null, count = 30 }) => {
  const params = new URLSearchParams({
    type,
    count: String(count)
  });

  if (category) {
    params.set('category', category);
  }

  const payload = await fetchJson(`/api/words/deck?${params.toString()}`);
  const words = Array.isArray(payload.words)
    ? payload.words.map((word) => String(word ?? '').trim()).filter(Boolean)
    : [];

  if (words.length === 0) {
    throw new Error('No words available right now');
  }

  return {
    category: String(payload.category ?? '').trim() || 'Mixed deck',
    words
  };
};

export const fetchHatGameSuggestions = async (count) => {
  const payload = await fetchWordDeck({
    type: 'guessing',
    category: 'Who',
    count
  });

  if (payload.words.length === 0) {
    throw new Error('No Who-list clues are available right now');
  }

  return payload.words;
};

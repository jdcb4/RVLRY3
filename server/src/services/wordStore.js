const wordCache = {
  guessing: [],
  describing: []
};

const lastSync = {
  guessing: null,
  describing: null
};

export function setWords(type, words) {
  wordCache[type] = words;
  lastSync[type] = new Date().toISOString();
}

export function getWords(type) {
  return wordCache[type] || [];
}

export function getSnapshot() {
  return {
    words: wordCache,
    lastSync
  };
}

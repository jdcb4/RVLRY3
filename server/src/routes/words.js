import { Router } from 'express';

const clampCount = (value, fallback, minimum = 1, maximum = 60) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizeCategory = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

export function wordsRouter(wordStore) {
  const router = Router();

  router.get('/random', (req, res) => {
    const type = req.query.type ?? 'guessing';
    const word = wordStore.getRandomWord(type);
    res.json({ type, word });
  });

  router.get('/deck', (req, res) => {
    const type = String(req.query.type ?? 'guessing');
    const count = clampCount(req.query.count, 24);
    const requestedCategory = normalizeCategory(req.query.category);
    const availableCategories = wordStore.getCategories(type);
    let category = requestedCategory;

    if (category && wordStore.getWordsForCategory(type, category).length === 0) {
      category = null;
    }

    if (!category && availableCategories.length > 0) {
      category = shuffle(availableCategories)[0];
    }

    const words = category
      ? wordStore.getWordsForCategory(type, category)
      : wordStore.getWords(type);

    res.json({
      type,
      category,
      words: shuffle(words).slice(0, count)
    });
  });

  router.get('/status', (_, res) => {
    res.json(wordStore.status());
  });

  router.post('/sync', async (_, res) => {
    const result = await wordStore.sync();
    res.json(result);
  });

  return router;
}

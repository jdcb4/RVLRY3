import { Router } from 'express';

export function wordsRouter(wordStore) {
  const router = Router();

  router.get('/random', (req, res) => {
    const type = req.query.type ?? 'guessing';
    const word = wordStore.getRandomWord(type);
    res.json({ type, word });
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

import 'dotenv/config';
import { createAppServer } from './app.js';
import { createWordStore } from './services/wordStore.js';

const wordStore = createWordStore();
const { httpServer } = createAppServer({ wordStore });
const port = process.env.PORT ?? 3001;

const bootstrap = async () => {
  try {
    await wordStore.initialize();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Word store initialization failed: ${message}`);
  }

  wordStore.startSchedule();
  httpServer.listen(port, () => {
    console.log(`RVLRY server listening on ${port}`);
  });
};

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Server bootstrap failed: ${message}`);
  process.exit(1);
});

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameById } from '../games/config';

export function LocalMode() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const game = getGameById(gameId);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    const fetchPrompt = async () => {
      const type = gameId === 'whowhatwhere' ? 'guessing' : 'describing';
      const response = await fetch(`/api/words/random?type=${type}`);
      const payload = await response.json();
      setPrompt(payload.word ?? 'No prompt available');
    };

    if (game?.supportsLocal) {
      fetchPrompt().catch(() => setPrompt('Unable to fetch prompt'));
    }
  }, [game?.supportsLocal, gameId]);

  if (!game?.supportsLocal) {
    return (
      <main className="app-shell">
        <p>This game does not support local mode yet.</p>
        <button onClick={() => navigate('/')}>Back</button>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1>{game.name} — Pass &amp; Play</h1>
      <p>Pass device when ready. Tap reveal for the next team.</p>
      <article className="card">
        <h2>Prompt</h2>
        <p>{prompt}</p>
      </article>
      <button onClick={() => navigate('/')}>Done</button>
    </main>
  );
}

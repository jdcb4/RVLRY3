import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameById } from '../games/config';

const getWordType = (gameId) => (gameId === 'whowhatwhere' ? 'guessing' : 'describing');

const localInstructions = {
  imposter: 'Pass the device in a circle. One player is the imposter and sees no word.',
  whowhatwhere: 'One player describes while others guess. Skip or score, then pass.',
  drawnguess: 'Alternate drawing and guessing prompts each handoff.'
};

export function LocalMode() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const game = getGameById(gameId);
  const [prompt, setPrompt] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [error, setError] = useState('');

  const fetchPrompt = useCallback(async () => {
    try {
      setError('');
      setIsRevealed(false);
      const type = getWordType(gameId);
      const response = await fetch(`/api/words/random?type=${type}`);
      const payload = await response.json();
      setPrompt(payload.word ?? 'No prompt available');
    } catch {
      setError('Unable to fetch prompt');
      setPrompt('No prompt available');
    }
  }, [gameId]);

  useEffect(() => {
    if (game?.supportsLocal) {
      fetchPrompt();
    }
  }, [fetchPrompt, game?.supportsLocal]);

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
      <p>{localInstructions[gameId]}</p>
      <article className="card">
        <h2>Prompt</h2>
        <p>{isRevealed ? prompt : 'Hidden. Tap reveal when next player is ready.'}</p>
      </article>
      {error && <p>{error}</p>}
      <div className="actions stacked">
        <button onClick={() => setIsRevealed((value) => !value)}>{isRevealed ? 'Hide' : 'Reveal'}</button>
        <button onClick={fetchPrompt}>Next handoff</button>
        <button onClick={() => navigate('/')}>Done</button>
      </div>
    </main>
  );
}

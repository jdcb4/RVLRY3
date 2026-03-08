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
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Pass and play</p>
        <h1 className="scene__title">Local mode unavailable</h1>
        <p className="scene__lead">This game is currently tuned for online play only.</p>
        <div className="actions">
          <button onClick={() => navigate(`/play/${gameId}`)}>Back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="scene scene--local">
      <header className="scene__header scene__header--compact">
        <p className="scene__eyebrow">Pass and play</p>
        <h1 className="scene__title">{game.name}</h1>
        <p className="scene__lead">{localInstructions[gameId]}</p>
      </header>

      <section className="panel panel--hero panel--stacked">
        <div className="panel-heading">
          <h2>Hidden prompt</h2>
          <p>Keep the screen covered until the next player is ready, then reveal and hand off.</p>
        </div>

        <div className="room-code-card room-code-card--prompt">
          <span className="helper-text">Prompt</span>
          <strong className="prompt-display">{isRevealed ? prompt : 'Hidden until reveal'}</strong>
        </div>

        {error && <p className="connection-banner connection-banner--error">{error}</p>}

        <div className="action-bar action-bar--static">
          <div className="action-bar__meta">
            <strong>{isRevealed ? 'Prompt visible' : 'Prompt hidden'}</strong>
            <span>{isRevealed ? 'Hide before passing the phone.' : 'Reveal when the next player is ready.'}</span>
          </div>
          <div className="action-bar__actions">
            <button onClick={() => setIsRevealed((value) => !value)}>{isRevealed ? 'Hide' : 'Reveal'}</button>
            <button className="secondary-action" onClick={fetchPrompt}>
              Next handoff
            </button>
          </div>
        </div>

        <div className="actions">
          <button className="secondary-action" onClick={() => navigate(`/play/${game.id}`)}>
            Back to online flow
          </button>
        </div>
      </section>
    </main>
  );
}

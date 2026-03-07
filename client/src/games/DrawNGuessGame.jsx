import { useCallback, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function DrawNGuessGame({ roomCode, playerName, gameType }) {
  const [state, setState] = useState({ players: [], prompt: '' });
  const handleState = useCallback((payload) => setState(payload), []);
  const socketRef = useSocket(roomCode, playerName, gameType, handleState);

  return (
    <section>
      <h2>DrawNGuess</h2>
      <p>Room: {roomCode}</p>
      <div className="prompt-card">{state.prompt || 'Waiting for a prompt...'}</div>
      <button className="primary" onClick={() => socketRef.current?.emit('drawnguess:next', { roomCode })}>
        Next chain prompt
      </button>
      <ul>{state.players.map((p) => <li key={p}>{p}</li>)}</ul>
    </section>
  );
}

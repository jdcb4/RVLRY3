import { useCallback, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function ImposterGame({ roomCode, playerName, gameType }) {
  const [state, setState] = useState({ players: [], prompt: '', role: '' });
  const handleState = useCallback((payload) => setState(payload), []);
  const socketRef = useSocket(roomCode, playerName, gameType, handleState);

  const requestRound = () => socketRef.current?.emit('imposter:start-round', { roomCode });

  return (
    <section>
      <h2>Imposter</h2>
      <p>Room: {roomCode}</p>
      <p>Your role: {state.role || 'Waiting for round...'}</p>
      <p>Secret word: {state.prompt || '---'}</p>
      <button onClick={requestRound} className="primary">
        Start round
      </button>
      <ul>{state.players.map((p) => <li key={p}>{p}</li>)}</ul>
    </section>
  );
}

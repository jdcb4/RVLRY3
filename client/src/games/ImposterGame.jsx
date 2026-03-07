import { useMemo, useState } from 'react';
import LocalGameShell from '../components/LocalGameShell';

export default function ImposterGame({ mode }) {
  const [players, setPlayers] = useState('Alice, Bob, Charlie');
  const [imposterIndex, setImposterIndex] = useState(0);

  const parsedPlayers = useMemo(
    () => players.split(',').map((entry) => entry.trim()).filter(Boolean),
    [players]
  );

  if (mode === 'online') {
    return null;
  }

  return (
    <LocalGameShell
      title="Imposter"
      description="Pass your phone and reveal each role privately."
    >
      <label>
        Players (comma separated)
        <input value={players} onChange={(event) => setPlayers(event.target.value)} />
      </label>
      <label>
        Imposter player
        <select value={imposterIndex} onChange={(event) => setImposterIndex(Number(event.target.value))}>
          {parsedPlayers.map((player, index) => (
            <option key={player} value={index}>
              {player}
            </option>
          ))}
        </select>
      </label>
      <ul>
        {parsedPlayers.map((player, index) => (
          <li key={player}>
            {player}: {index === imposterIndex ? 'Imposter' : 'Knows the word'}
          </li>
        ))}
      </ul>
    </LocalGameShell>
  );
}

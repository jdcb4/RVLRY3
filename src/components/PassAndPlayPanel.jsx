import { useState } from 'react';

function PassAndPlayPanel({ game }) {
  const [players, setPlayers] = useState(['']);

  const updatePlayer = (index, value) => {
    setPlayers((currentPlayers) => currentPlayers.map((name, currentIndex) => (index === currentIndex ? value : name)));
  };

  const addPlayer = () => {
    setPlayers((currentPlayers) => [...currentPlayers, '']);
  };

  return (
    <div className="panel">
      <h3>Pass-and-play setup</h3>
      <p>{game.title} can run on one device with players taking turns.</p>
      {players.map((name, index) => (
        <label key={`player-${index}`}>
          Player {index + 1}
          <input value={name} onChange={(event) => updatePlayer(index, event.target.value)} placeholder="Name" />
        </label>
      ))}
      <button type="button" onClick={addPlayer}>Add player</button>
      <button type="button" disabled={players.filter(Boolean).length < 2}>Start local game</button>
    </div>
  );
}

export default PassAndPlayPanel;

import { useState } from 'react';

export default function LobbyForm({ onSubmit, supportsLocal }) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState('online');

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ playerName: playerName.trim(), roomCode: roomCode.trim().toUpperCase(), mode });
  };

  return (
    <form className="lobby-form" onSubmit={handleSubmit}>
      <label>
        Your name
        <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} required />
      </label>
      {mode === 'online' && (
        <label>
          Room code
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Create or join"
            required
          />
        </label>
      )}
      {supportsLocal && (
        <div className="mode-toggle">
          <button type="button" className={mode === 'online' ? 'active' : ''} onClick={() => setMode('online')}>
            Online
          </button>
          <button
            type="button"
            className={mode === 'pass-and-play' ? 'active' : ''}
            onClick={() => setMode('pass-and-play')}
          >
            Pass-and-play
          </button>
        </div>
      )}
      <button type="submit" className="primary">
        Continue
      </button>
    </form>
  );
}

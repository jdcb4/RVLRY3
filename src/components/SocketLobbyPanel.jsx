import { useState } from 'react';
import { createGameSocket } from '../services/socketClient';

function SocketLobbyPanel({ game }) {
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [status, setStatus] = useState('Disconnected');

  const connect = () => {
    const socket = createGameSocket();

    socket.on('connect', () => {
      setStatus(`Connected (${socket.id})`);
      socket.emit('lobby:join', { gameId: game.id, roomCode, nickname });
    });

    socket.on('connect_error', () => {
      setStatus('Could not connect to lobby server. Configure VITE_SOCKET_SERVER_URL.');
      socket.close();
    });
  };

  return (
    <div className="panel">
      <h3>Online multiplayer</h3>
      <p>Create or join a room to play across devices.</p>
      <label>
        Nickname
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Player name" />
      </label>
      <label>
        Room code (optional)
        <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABCD" />
      </label>
      <button type="button" onClick={connect}>Connect</button>
      <p>{status}</p>
    </div>
  );
}

export default SocketLobbyPanel;

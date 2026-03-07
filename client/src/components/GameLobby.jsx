import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getGameById } from '../games/config';

export function GameLobby() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const game = getGameById(gameId);
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [messages, setMessages] = useState([]);

  const socket = useMemo(() => io('/', { transports: ['websocket'] }), []);

  useEffect(() => {
    socket.on('room:update', (payload) => {
      setMessages((prev) => [JSON.stringify(payload), ...prev].slice(0, 5));
    });

    return () => {
      socket.disconnect();
    };
  }, [socket]);

  if (!game) {
    return (
      <main className="app-shell">
        <p>Game not found.</p>
        <button onClick={() => navigate('/')}>Back</button>
      </main>
    );
  }

  const createRoom = () => {
    socket.emit('room:create', { gameId: game.id, playerName: name || 'Player' }, ({ code, error }) => {
      if (error) {
        setMessages((prev) => [error, ...prev]);
        return;
      }
      setRoomCode(code);
    });
  };

  const joinRoom = () => {
    socket.emit('room:join', { code: roomCode, playerName: name || 'Player' }, ({ error }) => {
      if (error) {
        setMessages((prev) => [error, ...prev]);
      }
    });
  };

  return (
    <main className="app-shell">
      <h1>{game.name}</h1>
      <p>{game.description}</p>
      <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="actions stacked">
        <button onClick={createRoom}>Create room</button>
        <input
          placeholder="Room code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button onClick={joinRoom}>Join room</button>
      </div>
      <ul className="log">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      <button onClick={() => navigate('/')}>Back</button>
    </main>
  );
}

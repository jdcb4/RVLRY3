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
  const [roomState, setRoomState] = useState(null);
  const [privateState, setPrivateState] = useState(null);
  const [socketId, setSocketId] = useState(null);

  const socket = useMemo(() => io('/', { transports: ['websocket'] }), []);

  useEffect(() => {
    socket.on('connect', () => {
      setSocketId(socket.id);
    });

    socket.on('room:update', (payload) => {
      setRoomState(payload);
      setMessages((prev) => [
        `Room ${payload.code} updated (${payload.players.length} players)`,
        ...prev
      ].slice(0, 5));
    });

    socket.on('game:private', (payload) => {
      setPrivateState(payload);
      setMessages((prev) => ['Private game role received', ...prev].slice(0, 5));
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

  const startGame = () => {
    socket.emit('room:start', { code: roomCode }, ({ error }) => {
      if (error) {
        setMessages((prev) => [error, ...prev]);
      }
    });
  };

  const isHost = roomState?.hostId === socketId;

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
        <button onClick={startGame} disabled={!roomCode || !isHost}>
          Start game
        </button>
      </div>

      {roomState && (
        <article className="card">
          <h2>Room {roomState.code}</h2>
          <p>Phase: {roomState.phase}</p>
          <p>{isHost ? 'You are host.' : 'Waiting for host to start.'}</p>
          <ul>
            {roomState.players.map((player) => (
              <li key={player.id}>
                {player.name} {player.id === roomState.hostId ? '(Host)' : ''}
              </li>
            ))}
          </ul>
        </article>
      )}

      {privateState && (
        <article className="card">
          <h2>Your role</h2>
          {privateState.role && <p>Role: {privateState.role}</p>}
          {privateState.word && <p>Word: {privateState.word}</p>}
          {!privateState.word && privateState.role === 'imposter' && <p>No word. Blend in.</p>}
        </article>
      )}

      <ul className="log">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      <button onClick={() => navigate('/')}>Back</button>
    </main>
  );
}

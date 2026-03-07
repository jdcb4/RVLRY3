import { useEffect, useState } from 'react';
import { createRoom, joinRoom } from '../services/api';
import { getSocket } from '../services/socket';

export default function OnlineLobby({ gameKey }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomState?.room?.code) {
      return;
    }

    const socket = getSocket();
    const code = roomState.room.code;

    socket.emit('room:subscribe', { roomCode: code });
    const onRoomUpdate = (payload) => {
      if (payload.room.code === code) {
        setRoomState(payload);
      }
    };

    socket.on('room:update', onRoomUpdate);

    return () => {
      socket.off('room:update', onRoomUpdate);
    };
  }, [roomState?.room?.code]);

  async function handleCreateRoom() {
    setError('');
    try {
      const payload = await createRoom(gameKey, name || 'Host');
      setRoomState(payload);
      setRoomCode(payload.room.code);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJoinRoom() {
    setError('');
    try {
      const payload = await joinRoom(roomCode, name || 'Player');
      setRoomState(payload);
    } catch (err) {
      setError(err.message);
    }
  }

  function startGame() {
    const socket = getSocket();
    socket.emit('room:start', { roomCode: roomState.room.code });
  }

  return (
    <section className="panel">
      <h3>Online lobby</h3>
      <label>
        Player name
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" />
      </label>
      <div className="inline-row">
        <button type="button" onClick={handleCreateRoom}>Create room</button>
        <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="Room code" />
        <button type="button" onClick={handleJoinRoom}>Join</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {roomState ? (
        <div className="lobby-status">
          <p>
            Room <strong>{roomState.room.code}</strong> · {roomState.room.status}
          </p>
          <ul>
            {roomState.room.players.map((player) => (
              <li key={player.id}>{player.name}</li>
            ))}
          </ul>
          {roomState.room.status === 'lobby' ? (
            <button type="button" onClick={startGame}>Start game</button>
          ) : (
            <pre>{JSON.stringify(roomState.round, null, 2)}</pre>
          )}
        </div>
      ) : null}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlaySession } from './PlaySessionContext';

export function GameLanding() {
  const navigate = useNavigate();
  const { roomCode: inviteRoomCode } = useParams();
  const {
    game,
    playerName,
    setPlayerName,
    lastRoomCode,
    roomState,
    connectionState,
    error,
    setError,
    pendingAction,
    createRoom,
    joinRoom
  } = usePlaySession();
  const [joinCode, setJoinCode] = useState(inviteRoomCode ?? '');

  useEffect(() => {
    setJoinCode(inviteRoomCode ?? '');
  }, [inviteRoomCode]);

  const currentRoomTarget =
    roomState?.code && roomState.gameId === game.id
      ? roomState.phase === 'in-progress'
        ? `/play/${game.id}/game/${roomState.code}`
        : `/play/${game.id}/lobby/${roomState.code}`
      : null;

  const handleCreateRoom = async () => {
    const response = await createRoom();
    if (response.code) {
      navigate(`/play/${game.id}/lobby/${response.code}`);
    }
  };

  const handleJoinRoom = async (nextCode = joinCode) => {
    const response = await joinRoom(nextCode);
    if (response.code) {
      navigate(`/play/${game.id}/lobby/${response.code}`);
    }
  };

  return (
    <main className="scene scene--landing">
      <header className="scene__header">
        <p className="scene__eyebrow">{game.tagline}</p>
        <h1 className="scene__title">{game.name}</h1>
        <p className="scene__lead">{game.description}</p>
      </header>

      <div className="panel-grid">
        <section className="panel panel--hero">
          <p className={connectionState === 'connected' ? 'status-pill' : 'status-pill status-pill--muted'}>
            {connectionState === 'connected' ? 'Server live' : 'Connecting'}
          </p>
          <h2>How this room starts</h2>
          <ul className="rule-list">
            {game.howToPlay.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {game.supportsLocal && (
            <div className="actions">
              <Link className="button-link button-link--secondary" to={`/local/${game.id}`}>
                Pass and play instead
              </Link>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>{inviteRoomCode ? `Join room ${inviteRoomCode}` : 'Get your room started'}</h2>
          <div className="field-stack">
            <label>
              <span className="helper-text">Player name</span>
              <input
                placeholder="What should the room call you?"
                value={playerName}
                onChange={(event) => {
                  setError('');
                  setPlayerName(event.target.value);
                }}
              />
            </label>

            <label>
              <span className="helper-text">Room code</span>
              <input
                placeholder="Enter six-character code"
                value={joinCode}
                maxLength={6}
                onChange={(event) => {
                  setError('');
                  setJoinCode(event.target.value.toUpperCase());
                }}
              />
            </label>
          </div>

          {error && <p className="connection-banner connection-banner--error">{error}</p>}

          <div className="actions">
            <button disabled={pendingAction === 'create'} onClick={handleCreateRoom}>
              Create room
            </button>
            <button
              className="secondary-action"
              disabled={pendingAction === 'join'}
              onClick={() => handleJoinRoom()}
            >
              Join room
            </button>
          </div>

          {currentRoomTarget && (
            <div className="hero-strip">
              <strong>Current room</strong>
              <p>You still have an active {roomState.phase === 'in-progress' ? 'game' : 'lobby'} session open.</p>
              <div className="actions">
                <Link className="button-link button-link--secondary" to={currentRoomTarget}>
                  Return to {roomState.code}
                </Link>
              </div>
            </div>
          )}

          {!currentRoomTarget && lastRoomCode && (
            <div className="hero-strip">
              <strong>Quick rejoin</strong>
              <p>Jump back into your last {game.name} room without re-entering the code.</p>
              <div className="actions">
                <button className="secondary-action" onClick={() => handleJoinRoom(lastRoomCode)}>
                  Rejoin {lastRoomCode}
                </button>
              </div>
            </div>
          )}

          <div className="actions">
            <Link className="button-link button-link--secondary" to="/">
              Back to RVLRY hub
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

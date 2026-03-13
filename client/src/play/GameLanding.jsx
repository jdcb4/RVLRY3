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

  const joinLabel = inviteRoomCode ? `Join ${inviteRoomCode}` : 'Join room';

  return (
    <main className="scene scene--landing">
      <header className="scene__header scene__header--compact">
        <p className="scene__eyebrow">{game.tagline}</p>
        <h1 className="scene__title">{game.name}</h1>
        <p className="scene__lead">{game.description}</p>
        <div className="facts-row">
          <span className="fact-chip">{game.minPlayers}+ players</span>
          <span className="fact-chip">{game.supportsLocal ? 'Online + pass-and-play' : 'Online only'}</span>
          <span className="fact-chip">Room-code join</span>
        </div>
      </header>

      <div className="panel-grid panel-grid--landing">
        <section className="panel panel--hero panel--stacked">
          <div className="panel-heading">
            <p className={connectionState === 'connected' ? 'status-pill' : 'status-pill status-pill--muted'}>
              {connectionState === 'connected' ? 'Server live' : 'Connecting'}
            </p>
            <h2>{inviteRoomCode ? `Join room ${inviteRoomCode}` : 'Play online'}</h2>
            <p>Save your name, then create or join with a code.</p>
          </div>

          {currentRoomTarget && (
            <div className="notice-card">
              <strong>Current session found</strong>
              <p>{roomState.phase === 'in-progress' ? 'Game' : 'Lobby'} {roomState.code} is already on this device.</p>
              <div className="actions">
                <Link className="button-link button-link--secondary" to={currentRoomTarget}>
                  Return to {roomState.code}
                </Link>
              </div>
            </div>
          )}

          {!currentRoomTarget && lastRoomCode && (
            <div className="notice-card">
              <strong>Quick rejoin</strong>
              <p>Jump back into your last room without typing the code again.</p>
              <div className="actions">
                <button className="secondary-action" onClick={() => handleJoinRoom(lastRoomCode)}>
                  Rejoin {lastRoomCode}
                </button>
              </div>
            </div>
          )}

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

          <div className="actions actions--stretch">
            <button disabled={pendingAction === 'create'} onClick={handleCreateRoom}>
              Create room
            </button>
            <button className="secondary-action" disabled={pendingAction === 'join'} onClick={() => handleJoinRoom()}>
              {joinLabel}
            </button>
          </div>

          <p className="helper-text">Your name stays on this device. Share the code or lobby link after you join.</p>
        </section>

        <section className="panel panel--stacked">
          <div className="panel-heading">
            <h2>How to play</h2>
          </div>

          <ol className="step-list">
            {game.howToPlay.map((item, index) => (
              <li key={item} className="step-card">
                <span className="step-card__index">0{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>

          <div className="actions actions--stretch">
            {game.supportsLocal && (
              <Link className="button-link button-link--secondary" to={`/local/${game.id}`}>
                Pass and play instead
              </Link>
            )}
            <Link className="button-link button-link--secondary" to="/">
              Back to RVLRY hub
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, InfoIcon, PhoneIcon } from '../components/Icons';
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
      <header className="scene__header scene__header--compact">
        <div className="scene__header-row scene__header-row--between">
          <Link aria-label="Back to RVLRY hub" className="scene__back scene__back--icon" to="/">
            <ArrowLeftIcon />
          </Link>
          <p className={connectionState === 'connected' ? 'status-pill' : 'status-pill status-pill--muted'}>
            {connectionState === 'connected' ? 'Server live' : 'Connecting'}
          </p>
        </div>
        <p className="scene__eyebrow">{game.tagline}</p>
        <h1 className="scene__title">{game.name}</h1>
      </header>

      <div className="panel-grid panel-grid--landing">
        <section className="panel panel--hero panel--stacked">
          <div className="panel-heading">
            <h2>{inviteRoomCode ? `Join ${inviteRoomCode}` : 'Play online'}</h2>
            <p>Set your name, then create a room or enter a code.</p>
          </div>

          {currentRoomTarget ? (
            <div className="notice-card">
              <strong>Session found</strong>
              <p>{roomState.phase === 'in-progress' ? 'Jump back into the game already on this phone.' : 'Return to the lobby already on this phone.'}</p>
              <div className="actions">
                <Link className="button-link button-link--secondary" to={currentRoomTarget}>
                  Return to {roomState.code}
                </Link>
              </div>
            </div>
          ) : null}

          {!currentRoomTarget && lastRoomCode ? (
            <div className="notice-card">
              <strong>Quick rejoin</strong>
              <div className="actions">
                <button className="secondary-action" onClick={() => handleJoinRoom(lastRoomCode)}>
                  Rejoin {lastRoomCode}
                </button>
              </div>
            </div>
          ) : null}

          <div className="field-stack">
            <label className="settings-field">
              <span className="helper-text">Name</span>
              <input
                placeholder="Player name"
                value={playerName}
                onChange={(event) => {
                  setError('');
                  setPlayerName(event.target.value);
                }}
              />
            </label>

            <label className="settings-field">
              <span className="helper-text">Room code</span>
              <input
                placeholder="Six-character code"
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
              Join room
            </button>
          </div>
        </section>

        <section className="panel panel--stacked">
          <details className="disclosure" open={Boolean(inviteRoomCode)}>
            <summary className="disclosure__summary">
              <div className="disclosure__summary-copy">
                <div className="disclosure__summary-title">
                  <span className="disclosure__icon">
                    <InfoIcon />
                  </span>
                  <h2>How it works</h2>
                </div>
                <p>Three quick steps</p>
              </div>
            </summary>
            <div className="disclosure__body">
              <ol className="step-list">
                {game.howToPlay.map((item, index) => (
                  <li key={item} className="step-card">
                    <span className="step-card__index">0{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </details>

          {game.supportsLocal ? (
            <details className="disclosure">
              <summary className="disclosure__summary">
                <div className="disclosure__summary-copy">
                  <div className="disclosure__summary-title">
                    <span className="disclosure__icon">
                      <PhoneIcon />
                    </span>
                    <h2>Pass and play</h2>
                  </div>
                  <p>Single-phone setup</p>
                </div>
              </summary>
              <div className="disclosure__body">
                <div className="notice-card">
                  <strong>Local mode</strong>
                  <p>Use one phone, pass it between turns, and keep hidden information protected.</p>
                </div>
                <div className="actions">
                  <Link className="button-link button-link--secondary" to={`/local/${game.id}`}>
                    <PhoneIcon />
                    Open local mode
                  </Link>
                </div>
              </div>
            </details>
          ) : null}
        </section>
      </div>
    </main>
  );
}

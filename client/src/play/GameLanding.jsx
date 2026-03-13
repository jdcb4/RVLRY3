import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, InfoIcon } from '../components/Icons';
import { usePlaySession } from './PlaySessionContext';

export function GameLanding() {
  const location = useLocation();
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
  const [toastMessage, setToastMessage] = useState('');
  const autoJoinAttemptedRef = useRef(false);

  useEffect(() => {
    autoJoinAttemptedRef.current = false;
  }, [inviteRoomCode]);

  useEffect(() => {
    if (!location.state?.toastMessage) {
      return;
    }

    setToastMessage(location.state.toastMessage);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(''), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  const currentRoomTarget =
    roomState?.code && roomState.gameId === game.id
      ? roomState.phase === 'in-progress'
        ? `/play/${game.id}/game/${roomState.code}`
        : `/play/${game.id}/lobby/${roomState.code}`
      : null;

  const handleCreateRoom = useCallback(async () => {
    const response = await createRoom();
    if (response.code) {
      navigate(`/play/${game.id}/lobby/${response.code}`);
    }
  }, [createRoom, game.id, navigate]);

  const handleJoinRoom = useCallback(async (code = inviteRoomCode) => {
    const response = await joinRoom(code);
    if (response.code) {
      navigate(`/play/${game.id}/lobby/${response.code}`);
    }
  }, [game.id, inviteRoomCode, joinRoom, navigate]);

  useEffect(() => {
    if (!inviteRoomCode || !location.state?.autoJoin || autoJoinAttemptedRef.current) {
      return;
    }

    if (!playerName.trim()) {
      return;
    }

    autoJoinAttemptedRef.current = true;
    handleJoinRoom(inviteRoomCode);
  }, [handleJoinRoom, inviteRoomCode, location.state, playerName]);

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
            <h2>{inviteRoomCode ? `Join ${inviteRoomCode}` : 'Host online'}</h2>
            <p>{inviteRoomCode ? 'Set your name, then join this room.' : 'Create a fresh room for this game.'}</p>
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

          {!inviteRoomCode && !currentRoomTarget && lastRoomCode ? (
            <div className="notice-card">
              <strong>Quick rejoin</strong>
              <div className="actions">
                <button className="secondary-action" onClick={() => handleJoinRoom(lastRoomCode)}>
                  Rejoin {lastRoomCode}
                </button>
              </div>
            </div>
          ) : null}

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

          {error ? <p className="connection-banner connection-banner--error">{error}</p> : null}

          <div className="actions actions--stretch">
            {inviteRoomCode ? (
              <button disabled={pendingAction === 'join'} onClick={() => handleJoinRoom(inviteRoomCode)}>
                Join room
              </button>
            ) : (
              <button disabled={pendingAction === 'create'} onClick={handleCreateRoom}>
                Create room
              </button>
            )}
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
        </section>
      </div>

      {toastMessage ? <p className="toast">{toastMessage}</p> : null}
    </main>
  );
}

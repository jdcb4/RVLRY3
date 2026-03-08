import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlaySession } from './PlaySessionContext';

const buildInviteLink = (gameId, roomCode) => `${window.location.origin}/play/${gameId}/join/${roomCode}`;

export function GameLobbyScreen() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const {
    game,
    playerName,
    playerId,
    currentPlayer,
    roomState,
    error,
    pendingAction,
    ensureRoom,
    setReady,
    startGame
  } = usePlaySession();
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    let ignore = false;

    if (!roomCode) {
      return undefined;
    }

    if (!playerName.trim()) {
      navigate(`/play/${game.id}/join/${roomCode}`, { replace: true });
      return undefined;
    }

    if (roomState?.code === roomCode && playerId) {
      return undefined;
    }

    ensureRoom(roomCode).then((response) => {
      if (!ignore && response.error) {
        navigate(`/play/${game.id}/join/${roomCode}`, { replace: true });
      }
    });

    return () => {
      ignore = true;
    };
  }, [ensureRoom, game.id, navigate, playerId, playerName, roomCode, roomState?.code]);

  useEffect(() => {
    if (roomState?.phase === 'in-progress' && roomState.code === roomCode) {
      navigate(`/play/${game.id}/game/${roomCode}`, { replace: true });
    }
  }, [game.id, navigate, roomCode, roomState?.code, roomState?.phase]);

  const isHost = roomState?.hostId === playerId;
  const readyCount = roomState?.players.filter((player) => player.ready).length ?? 0;
  const allPlayersReady = roomState?.players.every((player) => player.ready) ?? false;
  const canStart =
    Boolean(roomState) &&
    isHost &&
    roomState.players.length >= game.minPlayers &&
    allPlayersReady;
  const lobbyHeading = roomState ? `Room ${roomState.code}` : `Joining ${roomCode}`;
  const inviteLink = buildInviteLink(game.id, roomCode);

  const readinessLabel = useMemo(() => {
    if (!roomState) {
      return 'Connecting to lobby';
    }

    if (roomState.players.length < game.minPlayers) {
      return `Waiting for ${game.minPlayers - roomState.players.length} more player${
        game.minPlayers - roomState.players.length === 1 ? '' : 's'
      }`;
    }

    return `${readyCount} / ${roomState.players.length} ready`;
  }, [game.minPlayers, readyCount, roomState]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus('Invite link copied');
      window.setTimeout(() => setCopyStatus(''), 1800);
    } catch {
      setCopyStatus('Copy failed');
      window.setTimeout(() => setCopyStatus(''), 1800);
    }
  };

  const handleReadyToggle = async () => {
    await setReady(roomCode, !currentPlayer?.ready);
  };

  const handleStartGame = async () => {
    const response = await startGame(roomCode);
    if (response.ok) {
      navigate(`/play/${game.id}/game/${roomCode}`, { replace: true });
    }
  };

  if (!roomState || roomState.code !== roomCode) {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Lobby</p>
        <h1 className="scene__title">{lobbyHeading}</h1>
        <p className="scene__lead">Reconnecting you to the room and restoring your place.</p>
      </main>
    );
  }

  return (
    <main className="scene scene--lobby">
      <header className="scene__header">
        <p className="scene__eyebrow">{game.name} lobby</p>
        <h1 className="scene__title">{lobbyHeading}</h1>
        <p className="scene__lead">
          Use the lobby to confirm the roster, share the invite, and make sure everyone is ready
          before the host starts the round.
        </p>
      </header>

      <div className="panel-grid">
        <section className="panel panel--hero">
          <p className={allPlayersReady ? 'status-pill' : 'status-pill status-pill--muted'}>
            {readinessLabel}
          </p>
          <div className="stat-row">
            <span>Invite link</span>
            <button className="secondary-action" onClick={handleCopyCode}>
              Copy
            </button>
          </div>
          <div className="hero-strip">
            <strong>{inviteLink}</strong>
            <p>Share this link or the room code with anyone joining from another device.</p>
            {copyStatus && <p>{copyStatus}</p>}
          </div>
          <ul className="meta-list">
            <li>Minimum players: {game.minPlayers}</li>
            <li>Room code: {roomState.code}</li>
            <li>{isHost ? 'You control the start button.' : 'Only the host can start the round.'}</li>
          </ul>
        </section>

        <section className="panel">
          <h2>Players</h2>
          {error && <p className="connection-banner connection-banner--error">{error}</p>}
          <ul className="player-list">
            {roomState.players.map((player) => (
              <li key={player.id} className="player-row">
                <div className="player-row__identity">
                  <span className="player-row__name">{player.name}</span>
                  <div className="player-row__meta">
                    {player.id === playerId && <span className="badge badge--self">You</span>}
                    {player.id === roomState.hostId && <span className="badge badge--host">Host</span>}
                  </div>
                </div>
                <div className="player-row__status">
                  <span className={player.ready ? 'badge badge--ready' : 'badge'}>
                    {player.ready ? 'Ready' : 'Waiting'}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="actions">
            <button disabled={!currentPlayer || pendingAction === 'ready'} onClick={handleReadyToggle}>
              {currentPlayer?.ready ? 'Mark not ready' : 'Mark ready'}
            </button>
            {isHost && (
              <button disabled={!canStart || pendingAction === 'start'} onClick={handleStartGame}>
                Start game
              </button>
            )}
          </div>

          {!isHost && <p className="helper-text">The host starts the round once everyone is ready.</p>}

          <div className="actions">
            <Link className="button-link button-link--secondary" to={`/play/${game.id}`}>
              Back to landing
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

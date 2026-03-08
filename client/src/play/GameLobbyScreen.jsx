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
  const [shareStatus, setShareStatus] = useState('');

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

  const flashStatus = (message) => {
    setShareStatus(message);
    window.setTimeout(() => setShareStatus(''), 1800);
  };

  const handleCopy = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      flashStatus(successMessage);
    } catch {
      flashStatus('Copy failed');
    }
  };

  const handleShareInvite = async () => {
    if (!navigator.share) {
      return;
    }

    try {
      await navigator.share({
        title: `Join ${game.name}`,
        text: `Join my ${game.name} room on RVLRY`,
        url: inviteLink
      });
      flashStatus('Share sheet opened');
    } catch {
      // User cancelled or share failed; keep the UI quiet.
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
      <header className="scene__header scene__header--compact">
        <p className="scene__eyebrow">{game.name} lobby</p>
        <h1 className="scene__title">{lobbyHeading}</h1>
        <p className="scene__lead">
          Keep the lobby focused: share the room, confirm the roster, and start only when everyone is set.
        </p>
      </header>

      <div className="panel-grid panel-grid--lobby">
        <section className="panel panel--hero panel--stacked">
          <div className="panel-heading">
            <p className={allPlayersReady ? 'status-pill' : 'status-pill status-pill--muted'}>
              {readinessLabel}
            </p>
            <h2>Invite players</h2>
            <p>Use the room code for quick verbal sharing or send the direct join link from your phone.</p>
          </div>

          <div className="room-code-card">
            <span className="helper-text">Room code</span>
            <strong className="room-code-card__value">{roomState.code}</strong>
          </div>

          <div className="actions actions--stretch">
            <button className="secondary-action" onClick={() => handleCopy(roomState.code, 'Room code copied')}>
              Copy code
            </button>
            <button className="secondary-action" onClick={() => handleCopy(inviteLink, 'Invite link copied')}>
              Copy link
            </button>
            {navigator.share && (
              <button className="secondary-action" onClick={handleShareInvite}>
                Share invite
              </button>
            )}
          </div>

          <div className="invite-link-card">
            <span className="helper-text">Direct join link</span>
            <p className="invite-link">{inviteLink}</p>
          </div>

          {shareStatus && <p className="connection-banner">{shareStatus}</p>}

          <div className="summary-chips">
            <div className="summary-chip">
              <span className="summary-chip__label">Minimum</span>
              <strong className="summary-chip__value">{game.minPlayers} players</strong>
            </div>
            <div className="summary-chip">
              <span className="summary-chip__label">Ready</span>
              <strong className="summary-chip__value">{readyCount}</strong>
            </div>
            <div className="summary-chip">
              <span className="summary-chip__label">Host</span>
              <strong className="summary-chip__value">{isHost ? 'You' : roomState.players.find((player) => player.id === roomState.hostId)?.name ?? 'Assigned'}</strong>
            </div>
          </div>
        </section>

        <section className="panel panel--stacked">
          <div className="panel-heading">
            <h2>Players</h2>
            <p>{isHost ? 'You control the start once the room is ready.' : 'Only the host can launch the round.'}</p>
          </div>

          {error && <p className="connection-banner connection-banner--error">{error}</p>}

          <ul className="player-list">
            {roomState.players.map((player) => (
              <li key={player.id} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{player.name}</span>
                  <div className="player-row__meta">
                    {player.id === playerId && <span className="badge badge--self">You</span>}
                    {player.id === roomState.hostId && <span className="badge badge--host">Host</span>}
                  </div>
                </div>
                <span className={player.ready ? 'badge badge--ready' : 'badge'}>
                  {player.ready ? 'Ready' : 'Waiting'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="action-bar">
        <div className="action-bar__meta">
          <strong>{currentPlayer?.ready ? 'You are ready' : 'Mark ready when you are set'}</strong>
          <span>{readinessLabel}</span>
        </div>
        <div className="action-bar__actions">
          <button disabled={!currentPlayer || pendingAction === 'ready'} onClick={handleReadyToggle}>
            {currentPlayer?.ready ? 'Not ready' : 'Ready'}
          </button>
          {isHost && (
            <button disabled={!canStart || pendingAction === 'start'} onClick={handleStartGame}>
              Start game
            </button>
          )}
        </div>
      </div>

      <div className="actions">
        <Link className="button-link button-link--secondary" to={`/play/${game.id}`}>
          Back to landing
        </Link>
      </div>
    </main>
  );
}

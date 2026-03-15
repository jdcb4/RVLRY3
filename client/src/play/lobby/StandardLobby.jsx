import { CheckIcon, MinusIcon, XIcon } from '../../components/Icons';

function ReadyStateIcon({ playerName, ready }) {
  return (
    <span
      aria-label={ready ? `${playerName} ready` : `${playerName} not ready`}
      className={ready ? 'ready-mark ready-mark--ready' : 'ready-mark ready-mark--waiting'}
      role="img"
    >
      {ready ? <CheckIcon /> : <MinusIcon />}
    </span>
  );
}

export function StandardLobby({
  roomCode,
  roomState,
  currentPlayer,
  isHost,
  pendingAction,
  kickPlayer,
  error,
  onToast
}) {
  const handleKickPlayer = async (player) => {
    const response = await kickPlayer?.(roomCode, player.id);
    if (response?.ok) {
      onToast?.(`${player.name} removed from the room`);
    }
  };

  return (
    <section className="panel panel--stacked">
      <div className="panel-heading">
        <h2>Players</h2>
      </div>

      {error && <p className="connection-banner connection-banner--error">{error}</p>}

      <ul className="player-list">
        {roomState.players.map((player) => (
          <li key={player.id} className="player-row player-row--compact">
            <div className="player-row__identity">
              <span className="player-row__name">{player.name}</span>
              <div className="player-row__meta">
                {player.id === currentPlayer?.id && <span className="badge badge--self">You</span>}
                {player.id === roomState.hostId && <span className="badge badge--host">Host</span>}
              </div>
            </div>
            <div className="team-card__player-actions">
              <ReadyStateIcon playerName={player.name} ready={player.ready} />
              {isHost && player.id !== currentPlayer?.id ? (
                <button
                  aria-label={`Remove ${player.name}`}
                  className="icon-button icon-button--danger"
                  disabled={pendingAction === 'kick-player'}
                  onClick={() => handleKickPlayer(player)}
                >
                  <XIcon />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

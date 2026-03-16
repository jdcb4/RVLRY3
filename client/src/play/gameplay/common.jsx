import { useState } from 'react';
import { Link } from 'react-router-dom';

export function ResultsActions({ isHost, roomCode, gameId, onReturnToLobby, pendingAction }) {
  if (!isHost) {
    return (
      <div className="field-stack">
        <div className="notice-card notice-card--focus waiting-card">
          <strong>Waiting for host to start a new game...</strong>
          <p className="waiting-indicator">
            <span aria-hidden="true" className="waiting-indicator__dot" />
            Stay here for the next round, or head back to the game list.
          </p>
        </div>
        <div className="actions actions--stretch">
          <Link className="button-link button-link--secondary" to={`/play/${gameId}`}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="actions actions--stretch">
      <button disabled={pendingAction === 'return-to-lobby'} onClick={() => onReturnToLobby(roomCode)}>
        Return to lobby
      </button>
    </div>
  );
}

export function DisclosurePanel({ title, description, summary, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(() => defaultOpen);

  return (
    <details
      className="panel disclosure"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="disclosure__summary">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {summary ? <span className="badge">{summary}</span> : null}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

export function GameplayPlayerList({ players, playerId, hostId, getStatus }) {
  return (
    <ul className="player-list">
      {players.map((player) => {
        const status = getStatus(player);
        const badgeClass = status.tone === 'ready' ? 'badge badge--ready' : 'badge';

        return (
          <li key={player.id} className="player-row player-row--compact">
            <div className="player-row__identity">
              <span className="player-row__name">{player.name}</span>
              <div className="player-row__meta">
                {player.id === playerId && <span className="badge badge--self">You</span>}
                {player.id === hostId && <span className="badge badge--host">Host</span>}
              </div>
            </div>
            <span className={badgeClass}>{status.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

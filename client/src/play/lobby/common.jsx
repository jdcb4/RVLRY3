import { useEffect, useState } from 'react';
import {
  CheckIcon,
  CrownIcon,
  PencilIcon,
  XIcon
} from '../../components/Icons';

export function LobbyDisclosure({
  title,
  summary = null,
  description = null,
  icon = null,
  open = false,
  children
}) {
  const [isOpen, setIsOpen] = useState(() => open);

  return (
    <details
      className="disclosure"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="disclosure__summary">
        <div className="disclosure__summary-copy">
          <div className="disclosure__summary-title">
            {icon ? <span className="disclosure__icon">{icon}</span> : null}
            <h2>{title}</h2>
          </div>
          {description ? <p>{description}</p> : null}
        </div>
        {summary ? <span className="badge">{summary}</span> : null}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

export function LobbySettingList({ items }) {
  return (
    <ul className="meta-list lobby-setting-list">
      {items.map((item) => (
        <li key={item.label} className="stat-row">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function ReadyStateIcon({ playerName, ready }) {
  return (
    <span
      aria-label={ready ? `${playerName} ready` : `${playerName} not ready`}
      className={ready ? 'ready-mark ready-mark--ready' : 'ready-mark ready-mark--waiting'}
      role="img"
    >
      {ready ? <CheckIcon /> : <XIcon />}
    </span>
  );
}

export function TeamCard({
  team,
  currentPlayer,
  hostId,
  isHost,
  roomCode,
  pendingAction,
  teamNameDraft,
  setTeamNameDraft,
  onSaveTeamName,
  onAssignTeam,
  onKickPlayer,
  onToast
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const isOnTeam = currentPlayer?.teamId === team.id;
  const isCaptain = currentPlayer?.id === team.captainId;
  const joinLabel = currentPlayer?.teamId ? 'Switch team' : 'Join team';
  const normalizedDraft = String(teamNameDraft ?? team.name).trim();
  const hasNameChange = normalizedDraft.length > 0 && normalizedDraft !== team.name;

  useEffect(() => {
    setIsEditingName(false);
  }, [team.id, team.name]);

  const handleSaveTeamName = async () => {
    if (!isCaptain || !hasNameChange) {
      setIsEditingName(false);
      return;
    }

    const response = await onSaveTeamName(roomCode, team.id, normalizedDraft);
    if (response?.ok) {
      onToast?.('Team name updated');
      setIsEditingName(false);
    }
  };

  const handleKickPlayer = async (player) => {
    const response = await onKickPlayer?.(roomCode, player.id);
    if (response?.ok) {
      onToast?.(`${player.name} removed from the room`);
    }
  };

  return (
    <article className={`team-card ${isOnTeam ? 'team-card--active' : ''}`}>
      <div className="team-card__header">
        <div className="team-card__headline">
          {isEditingName ? (
            <div className="team-card__edit-row">
              <input
                aria-label={`Team name for ${team.name}`}
                value={teamNameDraft ?? team.name}
                maxLength={24}
                onChange={(event) => setTeamNameDraft(team.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSaveTeamName();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setTeamNameDraft(team.id, team.name);
                    setIsEditingName(false);
                  }
                }}
              />
              <button
                className="secondary-action secondary-action--compact"
                disabled={pendingAction === 'update-team-name'}
                onClick={handleSaveTeamName}
              >
                Save
              </button>
              <button
                className="secondary-action secondary-action--compact"
                onClick={() => {
                  setTeamNameDraft(team.id, team.name);
                  setIsEditingName(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="team-card__name-row">
              <h3>{team.name}</h3>
              {isCaptain ? (
                <button
                  aria-label={`Edit ${team.name}`}
                  className="icon-button"
                  onClick={() => setIsEditingName(true)}
                >
                  <PencilIcon />
                </button>
              ) : null}
            </div>
          )}
          <p className="team-card__subtitle">
            {team.readyCount} / {team.players.length} ready
          </p>
        </div>

        {isOnTeam ? (
          <span className="badge badge--ready">On this team</span>
        ) : (
          <button
            className="secondary-action secondary-action--compact"
            disabled={pendingAction === 'assign-team'}
            onClick={() => onAssignTeam(roomCode, team.id)}
          >
            {joinLabel}
          </button>
        )}
      </div>

      {team.players.length === 0 ? (
        <p className="team-card__empty">No players yet.</p>
      ) : (
        <ul className="player-list">
          {team.players.map((player) => {
            const isCaptainPlayer = player.id === team.captainId;

            return (
              <li key={player.id} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name player-row__name--with-icon">
                    {player.name}
                    {isCaptainPlayer ? (
                      <span
                        aria-label={`${player.name} is team captain`}
                        className="captain-mark"
                        role="img"
                      >
                        <CrownIcon />
                      </span>
                    ) : null}
                  </span>
                  <div className="player-row__meta">
                    {player.id === currentPlayer?.id ? <span className="badge badge--self">You</span> : null}
                    {player.id === hostId ? <span className="badge badge--host">Host</span> : null}
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
            );
          })}
        </ul>
      )}
    </article>
  );
}

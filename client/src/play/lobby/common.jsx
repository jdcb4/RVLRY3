import { PencilIcon } from '../../components/Icons';

function TeamNameEditor({
  team,
  roomCode,
  pendingAction,
  teamNameDraft,
  setTeamNameDraft,
  onSaveTeamName
}) {
  return (
    <details className="disclosure disclosure--subtle">
      <summary className="disclosure__summary disclosure__summary--compact">
        <div className="disclosure__summary-copy">
          <div className="disclosure__summary-title">
            <span className="disclosure__icon">
              <PencilIcon />
            </span>
            <h3>Edit team</h3>
          </div>
          <p>Rename {team.name}</p>
        </div>
      </summary>
      <div className="disclosure__body">
        <div className="field-stack">
          <label className="settings-field">
            <span className="helper-text">Team name</span>
            <input
              value={teamNameDraft}
              maxLength={24}
              onChange={(event) => setTeamNameDraft(team.id, event.target.value)}
            />
          </label>
          <button
            className="secondary-action"
            disabled={pendingAction === 'update-team-name'}
            onClick={() => onSaveTeamName(roomCode, team.id, teamNameDraft)}
          >
            Save name
          </button>
        </div>
      </div>
    </details>
  );
}

export function TeamCard({
  team,
  currentPlayer,
  isHost,
  roomCode,
  pendingAction,
  teamNameDraft,
  setTeamNameDraft,
  onSaveTeamName,
  onAssignTeam
}) {
  const isCurrentTeam = currentPlayer?.teamId === team.id;
  const playerCount = team.players.length;

  return (
    <article className={`team-card ${isCurrentTeam ? 'team-card--active' : ''}`}>
      <div className="team-card__header">
        <div className="team-card__headline">
          <h3>{team.name}</h3>
          <p className="team-card__subtitle">
            {playerCount === 0 ? 'No players yet' : `${playerCount} player${playerCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="player-row__meta">
          {isCurrentTeam && <span className="badge badge--self">Your team</span>}
        </div>
      </div>

      <ul className="player-list">
        {playerCount > 0 ? (
          team.players.map((player) => (
            <li key={player.id} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{player.name}</span>
                <div className="player-row__meta">
                  {player.id === currentPlayer?.id && <span className="badge badge--self">You</span>}
                  {player.ready ? <span className="badge badge--ready">Ready</span> : null}
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="team-card__empty">Open spot</li>
        )}
      </ul>

      <div className="team-card__actions">
        {currentPlayer && !isCurrentTeam ? (
          <button
            className="secondary-action"
            disabled={pendingAction === 'assign-team'}
            onClick={() => onAssignTeam(roomCode, team.id)}
          >
            Join team
          </button>
        ) : (
          <div className="notice-card team-card__notice">
            <strong>{isCurrentTeam ? 'You are here' : 'Waiting for players'}</strong>
            <p>{isCurrentTeam ? 'Stay here or switch teams before the host starts.' : 'Players can join this team at any time.'}</p>
          </div>
        )}

        {isHost ? (
          <TeamNameEditor
            team={team}
            roomCode={roomCode}
            pendingAction={pendingAction}
            teamNameDraft={teamNameDraft}
            setTeamNameDraft={setTeamNameDraft}
            onSaveTeamName={onSaveTeamName}
          />
        ) : null}
      </div>
    </article>
  );
}

export function LobbyDisclosure({ title, summary, children, open = false, icon = null }) {
  return (
    <details className="disclosure" open={open}>
      <summary className="disclosure__summary">
        <div className="disclosure__summary-copy">
          <div className="disclosure__summary-title">
            {icon ? <span className="disclosure__icon">{icon}</span> : null}
            <h2>{title}</h2>
          </div>
          {summary ? <p>{summary}</p> : null}
        </div>
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

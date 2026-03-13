export function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path
        d="M11.75 4.75 6.5 10l5.25 5.25M7 10h6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 13.25V4.5M10 4.5 6.75 7.75M10 4.5l3.25 3.25M5.5 10.75v3.25c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25v-3.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
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

  return (
    <article className="team-card">
      <div className="team-card__header">
        {isHost ? (
          <div className="team-card__title-row">
            <input
              value={teamNameDraft}
              maxLength={24}
              onChange={(event) => setTeamNameDraft(team.id, event.target.value)}
            />
            <button
              className="secondary-action team-card__save"
              disabled={pendingAction === 'update-team-name'}
              onClick={() => onSaveTeamName(roomCode, team.id, teamNameDraft)}
            >
              Save
            </button>
          </div>
        ) : (
          <h3>{team.name}</h3>
        )}
        <div className="player-row__meta">
          <span className="badge">{team.score} pts</span>
          {isCurrentTeam && <span className="badge badge--self">Your team</span>}
        </div>
      </div>

      <ul className="player-list">
        {team.players.length > 0 ? (
          team.players.map((player) => (
            <li key={player.id} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{player.name}</span>
                <div className="player-row__meta">
                  <span className={player.ready ? 'badge badge--ready' : 'badge'}>
                    {player.ready ? 'Ready' : 'Waiting'}
                  </span>
                  {player.id === currentPlayer?.id && <span className="badge badge--self">You</span>}
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="team-card__empty">No players yet</li>
        )}
      </ul>

      {currentPlayer && !isCurrentTeam && (
        <button
          className="secondary-action"
          disabled={pendingAction === 'assign-team'}
          onClick={() => onAssignTeam(roomCode, team.id)}
        >
          Join {team.name}
        </button>
      )}
    </article>
  );
}

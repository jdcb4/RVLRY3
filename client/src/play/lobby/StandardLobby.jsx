export function StandardLobby({ roomState, playerId, error }) {
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
  );
}

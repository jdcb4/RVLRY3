import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlaySession } from './PlaySessionContext';

const buildInviteLink = (gameId, roomCode) => `${window.location.origin}/play/${gameId}/join/${roomCode}`;

const buildTeamRosters = (roomState) =>
  (roomState?.teams ?? []).map((team) => ({
    ...team,
    players: roomState.players.filter((player) => player.teamId === team.id)
  }));

function TeamCard({
  team,
  currentPlayer,
  isHost,
  roomCode,
  pendingAction,
  teamNameDraft,
  setTeamNameDraft,
  onSaveTeamName
}) {
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
        <span className="badge">{team.score} pts</span>
      </div>

      <ul className="player-list">
        {team.players.length > 0 ? (
          team.players.map((player) => (
            <li key={player.id} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{player.name}</span>
                <div className="player-row__meta">
                  {player.id === currentPlayer?.id && <span className="badge badge--self">You</span>}
                </div>
              </div>
              <span className={player.ready ? 'badge badge--ready' : 'badge'}>
                {player.ready ? 'Ready' : 'Waiting'}
              </span>
            </li>
          ))
        ) : (
          <li className="team-card__empty">No players yet</li>
        )}
      </ul>
    </article>
  );
}

function WhoWhatWhereLobby({
  roomCode,
  roomState,
  currentPlayer,
  isHost,
  pendingAction,
  teamNameDrafts,
  setTeamNameDraft,
  settingsForm,
  updateSetting,
  updateTeamName,
  error
}) {
  const teamRosters = useMemo(() => buildTeamRosters(roomState), [roomState]);

  return (
    <section className="panel panel--stacked">
      <div className="panel-heading">
        <h2>Teams and rounds</h2>
        <p>Teams are auto-balanced as people join. The host sets team count, turn length, and round count.</p>
      </div>

      {error && <p className="connection-banner connection-banner--error">{error}</p>}

      <div className="team-grid">
        {teamRosters.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            currentPlayer={currentPlayer}
            isHost={isHost}
            roomCode={roomCode}
            pendingAction={pendingAction}
            teamNameDraft={teamNameDrafts[team.id] ?? team.name}
            setTeamNameDraft={setTeamNameDraft}
            onSaveTeamName={updateTeamName}
          />
        ))}
      </div>

      <section className="settings-card">
        <div className="panel-heading">
          <h3>Match settings</h3>
          <p>{isHost ? 'Changes apply immediately while the room is in the lobby.' : 'The host controls the timer and round settings.'}</p>
        </div>

        <div className="settings-grid">
          <label className="settings-field">
            <span className="helper-text">Teams</span>
            <select
              value={settingsForm.teamCount}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('teamCount', Number.parseInt(event.target.value, 10))}
            >
              <option value={2}>2 teams</option>
              <option value={3}>3 teams</option>
              <option value={4}>4 teams</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="helper-text">Turn length</span>
            <select
              value={settingsForm.turnDurationSeconds}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('turnDurationSeconds', Number.parseInt(event.target.value, 10))}
            >
              <option value={30}>30 seconds</option>
              <option value={45}>45 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={75}>75 seconds</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="helper-text">Rounds</span>
            <select
              value={settingsForm.totalRounds}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('totalRounds', Number.parseInt(event.target.value, 10))}
            >
              <option value={2}>2 rounds</option>
              <option value={3}>3 rounds</option>
              <option value={4}>4 rounds</option>
              <option value={5}>5 rounds</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="helper-text">Free skips</span>
            <select
              value={settingsForm.freeSkips}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('freeSkips', Number.parseInt(event.target.value, 10))}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="helper-text">Skip penalty</span>
            <select
              value={settingsForm.skipPenalty}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('skipPenalty', Number.parseInt(event.target.value, 10))}
            >
              <option value={0}>0 points</option>
              <option value={1}>1 point</option>
              <option value={2}>2 points</option>
            </select>
          </label>
        </div>

        <p className="helper-text">
          New players are placed on the smallest team automatically. Ties go to the earliest team.
        </p>
      </section>

      <div className="summary-chips">
        <div className="summary-chip">
          <span className="summary-chip__label">Teams ready</span>
          <strong className="summary-chip__value">
            {teamRosters.filter((team) => team.players.length >= 2).length} / {teamRosters.length}
          </strong>
        </div>
        <div className="summary-chip">
          <span className="summary-chip__label">Your team</span>
          <strong className="summary-chip__value">
            {teamRosters.find((team) => team.id === currentPlayer?.teamId)?.name ?? 'Assigning'}
          </strong>
        </div>
        <div className="summary-chip">
          <span className="summary-chip__label">Players needed</span>
          <strong className="summary-chip__value">
            {Math.max(0, (settingsForm.teamCount * 2) - roomState.players.length)}
          </strong>
        </div>
      </div>
    </section>
  );
}

function StandardLobby({ roomState, playerId, currentPlayer, isHost, pendingAction, handleReadyToggle, handleStartGame, error }) {
  return (
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

      <div className="actions actions--stretch">
        <button disabled={!currentPlayer || pendingAction === 'ready'} onClick={handleReadyToggle}>
          {currentPlayer?.ready ? 'Not ready' : 'Ready'}
        </button>
        {isHost && (
          <button disabled={pendingAction === 'start'} onClick={handleStartGame}>
            Start game
          </button>
        )}
      </div>
    </section>
  );
}

const getWhoWhatWhereStartHint = ({ roomState, game, isHost, readyCount, allPlayersReady }) => {
  const teamRosters = buildTeamRosters(roomState);
  const requiredPlayers = Math.max(game.minPlayers, (roomState.settings?.teamCount ?? 2) * 2);

  if (roomState.players.length < requiredPlayers) {
    return `Need ${requiredPlayers - roomState.players.length} more player${
      requiredPlayers - roomState.players.length === 1 ? '' : 's'
    }`;
  }

  if (teamRosters.some((team) => team.players.length < 2)) {
    return 'Each team needs at least 2 players';
  }

  if (!allPlayersReady) {
    return `${readyCount} / ${roomState.players.length} ready`;
  }

  return isHost ? 'Ready to start' : 'Waiting for host';
};

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
    updateTeamName,
    updateRoomSettings,
    setReady,
    startGame
  } = usePlaySession();
  const [shareStatus, setShareStatus] = useState('');
  const [teamNameDrafts, setTeamNameDrafts] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    teamCount: 2,
    turnDurationSeconds: 45,
    totalRounds: 3,
    freeSkips: 1,
    skipPenalty: 1
  });

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

  useEffect(() => {
    if (!roomState?.teams) {
      return;
    }

    setTeamNameDrafts(
      roomState.teams.reduce((drafts, team) => {
        drafts[team.id] = team.name;
        return drafts;
      }, {})
    );
  }, [roomState?.teams]);

  useEffect(() => {
    if (!roomState?.settings) {
      return;
    }

    setSettingsForm(roomState.settings);
  }, [roomState?.settings]);

  const isHost = roomState?.hostId === playerId;
  const readyCount = roomState?.players.filter((player) => player.ready).length ?? 0;
  const allPlayersReady = roomState?.players.every((player) => player.ready) ?? false;
  const lobbyHeading = roomState ? `Room ${roomState.code}` : `Joining ${roomCode}`;
  const inviteLink = buildInviteLink(game.id, roomCode);
  const readinessLabel =
    roomState && game.gameplayView === 'whowhatwhere'
      ? getWhoWhatWhereStartHint({ roomState, game, isHost, readyCount, allPlayersReady })
      : !roomState
        ? 'Connecting to lobby'
        : roomState.players.length < game.minPlayers
          ? `Waiting for ${game.minPlayers - roomState.players.length} more player${
              game.minPlayers - roomState.players.length === 1 ? '' : 's'
            }`
          : `${readyCount} / ${roomState.players.length} ready`;

  const canStart = useMemo(() => {
    const requiredPlayers = Math.max(game.minPlayers, (roomState?.settings?.teamCount ?? 2) * 2);

    if (!roomState || !isHost || roomState.players.length < requiredPlayers || !allPlayersReady) {
      return false;
    }

    if (game.gameplayView !== 'whowhatwhere') {
      return true;
    }

    const teamRosters = buildTeamRosters(roomState);
    return (
      roomState.players.every((player) => player.teamId) &&
      teamRosters.length >= 2 &&
      teamRosters.every((team) => team.players.length >= 2)
    );
  }, [allPlayersReady, game.gameplayView, game.minPlayers, isHost, roomState]);

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
      // User cancelled or share failed.
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

  const handleUpdateSetting = async (key, value) => {
    const nextSettings = { ...settingsForm, [key]: value };
    setSettingsForm(nextSettings);
    await updateRoomSettings(roomCode, nextSettings);
  };

  const handleSetTeamNameDraft = (teamId, value) => {
    setTeamNameDrafts((currentDrafts) => ({
      ...currentDrafts,
      [teamId]: value
    }));
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
            <p className={canStart ? 'status-pill' : 'status-pill status-pill--muted'}>{readinessLabel}</p>
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
              <strong className="summary-chip__value">
                {isHost ? 'You' : roomState.players.find((player) => player.id === roomState.hostId)?.name ?? 'Assigned'}
              </strong>
            </div>
          </div>
        </section>

        {game.gameplayView === 'whowhatwhere' ? (
          <WhoWhatWhereLobby
            roomCode={roomCode}
            roomState={roomState}
            currentPlayer={currentPlayer}
            isHost={isHost}
            pendingAction={pendingAction}
            teamNameDrafts={teamNameDrafts}
            setTeamNameDraft={handleSetTeamNameDraft}
            settingsForm={settingsForm}
            updateSetting={handleUpdateSetting}
            updateTeamName={updateTeamName}
            error={error}
          />
        ) : (
          <StandardLobby
            roomState={roomState}
            playerId={playerId}
            currentPlayer={currentPlayer}
            isHost={isHost}
            pendingAction={pendingAction}
            handleReadyToggle={handleReadyToggle}
            handleStartGame={handleStartGame}
            error={error}
          />
        )}
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

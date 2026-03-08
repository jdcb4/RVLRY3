import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlaySession } from './PlaySessionContext';

const buildInviteLink = (gameId, roomCode) => `${window.location.origin}/play/${gameId}/join/${roomCode}`;

const buildTeamRosters = (roomState) =>
  (roomState?.teams ?? []).map((team) => ({
    ...team,
    players: roomState.players.filter((player) => player.teamId === team.id)
  }));

function ArrowLeftIcon() {
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

function ShareIcon() {
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
        <h2>Teams</h2>
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
      </section>
    </section>
  );
}

function StandardLobby({ roomState, playerId, currentPlayer, isHost, pendingAction, handleReadyToggle, handleStartGame, error }) {
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

const getStartWarning = ({ roomState, game, isHost, allPlayersReady }) => {
  if (!roomState) {
    return 'Lobby is still loading';
  }

  if (!isHost) {
    return 'Only the host can start the game';
  }

  if (game.gameplayView === 'whowhatwhere') {
    const teamCount = roomState.settings?.teamCount ?? 2;
    const requiredPlayers = Math.max(game.minPlayers, teamCount * 2);

    if (roomState.players.length < requiredPlayers) {
      return `Need at least ${requiredPlayers} players to start`;
    }

    const teamRosters = buildTeamRosters(roomState);

    if (roomState.players.some((player) => !player.teamId)) {
      return 'Wait for team assignment to finish';
    }

    if (teamRosters.some((team) => team.players.length < 2)) {
      return 'Each team needs at least 2 players';
    }
  } else if (roomState.players.length < game.minPlayers) {
    return `Need at least ${game.minPlayers} players to start`;
  }

  if (!allPlayersReady) {
    return 'Everyone needs to be ready before the game can start';
  }

  return null;
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
  const [toastMessage, setToastMessage] = useState('');
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
  const allPlayersReady = roomState?.players.every((player) => player.ready) ?? false;
  const inviteLink = buildInviteLink(game.id, roomCode);
  const startWarning = useMemo(
    () => getStartWarning({ roomState, game, isHost, allPlayersReady }),
    [allPlayersReady, game, isHost, roomState]
  );

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(''), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  const handleCopy = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      setToastMessage(successMessage);
    } catch {
      setToastMessage('Copy failed');
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
      setToastMessage('Share sheet opened');
    } catch {
      // User cancelled or share failed.
    }
  };

  const handleReadyToggle = async () => {
    await setReady(roomCode, !currentPlayer?.ready);
  };

  const handleStartGame = async () => {
    if (startWarning) {
      setToastMessage(startWarning);
      return;
    }

    const response = await startGame(roomCode);
    if (response.ok) {
      navigate(`/play/${game.id}/game/${roomCode}`, { replace: true });
      return;
    }

    if (response.error) {
      setToastMessage(response.error);
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
        <h1 className="scene__title">LOBBY</h1>
        <p className="scene__lead">Reconnecting you to the room and restoring your place.</p>
      </main>
    );
  }

  return (
    <main className="scene scene--lobby">
      <header className="scene__header scene__header--compact scene__header--with-back">
        <div className="scene__header-row">
          <Link className="scene__back" to={`/play/${game.id}`}>
            <ArrowLeftIcon />
            <span>Back</span>
          </Link>
        </div>
        <h1 className="scene__title scene__title--lobby">LOBBY</h1>
      </header>

      <div className="panel-grid panel-grid--lobby">
        <section className="panel panel--hero panel--stacked">
          <div className="panel-heading">
            <h2>Invite</h2>
          </div>

          <div className="room-code-card room-code-card--bare">
            <strong className="room-code-card__value">{roomState.code}</strong>
          </div>

          <div className="actions actions--compact">
            <button
              className="secondary-action secondary-action--compact"
              onClick={() => handleCopy(roomState.code, 'Room code copied')}
            >
              Copy code
            </button>
            <button
              className="secondary-action secondary-action--compact"
              onClick={() => handleCopy(inviteLink, 'Invite link copied')}
            >
              Copy link
            </button>
            {navigator.share && (
              <button
                aria-label="Share invite"
                className="secondary-action secondary-action--compact secondary-action--icon"
                onClick={handleShareInvite}
              >
                <ShareIcon />
              </button>
            )}
          </div>

          {toastMessage && <p className="toast">{toastMessage}</p>}
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

      <div className="action-bar action-bar--actions-only">
        <div className="action-bar__actions">
          <button disabled={!currentPlayer || pendingAction === 'ready'} onClick={handleReadyToggle}>
            {currentPlayer?.ready ? 'Not ready' : 'Ready'}
          </button>
          {isHost && (
            <button disabled={pendingAction === 'start'} onClick={handleStartGame}>
              Start game
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAudioCues } from '../audio/AudioCueContext';
import { ArrowLeftIcon, ShareIcon } from '../components/Icons';
import { getGameModule } from '../games/registry';
import { buildInviteLink, getStartHint } from './lobby/helpers';
import { LOBBY_COMPONENTS } from './lobby';
import { StandardLobby } from './lobby/StandardLobby';
import { usePlaySession } from './PlaySessionContext';

export function GameLobbyScreen() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const { playCue } = useAudioCues();
  const {
    game,
    playerName,
    playerId,
    currentPlayer,
    roomState,
    lobbyPrivateState,
    error,
    setError,
    pendingAction,
    ensureRoom,
    assignTeam,
    updateTeamName,
    rebalanceTeams,
    updateRoomSettings,
    submitHatClues,
    setReady,
    startGame
  } = usePlaySession();
  const gameModule = getGameModule(game.id);
  const [toastMessage, setToastMessage] = useState('');
  const [teamNameDrafts, setTeamNameDrafts] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    teamCount: 2,
    turnDurationSeconds: 45,
    totalRounds: 3,
    freeSkips: 1,
    skipPenalty: 1,
    cluesPerPlayer: 6,
    skipsPerTurn: 1
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
  const startHint = useMemo(
    () => getStartHint({ roomState, game, gameModule, isHost, allPlayersReady }),
    [allPlayersReady, game, gameModule, isHost, roomState]
  );
  const LobbyComponent = LOBBY_COMPONENTS[gameModule.lobbyVariant] ?? StandardLobby;

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

  const handleSubmitHatClues = async (clues) => submitHatClues(roomCode, clues);

  const handleReadyToggle = async () => {
    await setReady(roomCode, !currentPlayer?.ready);
  };

  const handleStartGame = async () => {
    if (startHint) {
      setToastMessage(startHint);
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
        <p className="scene__lead">Reconnecting you to the room.</p>
      </main>
    );
  }

  return (
    <main className="scene scene--lobby">
      <header className="scene__header scene__header--compact scene__header--with-back">
        <div className="scene__header-row">
          <Link aria-label="Back to game setup" className="scene__back scene__back--icon" to={`/play/${game.id}`}>
            <ArrowLeftIcon />
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

        <LobbyComponent
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
          assignTeam={assignTeam}
          rebalanceTeams={rebalanceTeams}
          lobbyPrivateState={lobbyPrivateState}
          submitHatClues={handleSubmitHatClues}
          setError={setError}
          error={error}
          playerId={playerId}
          onToast={setToastMessage}
          onPlaySubmitCue={() => playCue('submit')}
        />
      </div>

      <div className="action-bar action-bar--actions-only">
        <div className="action-bar__actions">
          <button disabled={!currentPlayer || pendingAction === 'ready'} onClick={handleReadyToggle}>
            {currentPlayer?.ready ? 'Unready' : 'Ready'}
          </button>
          {isHost && (
            <button disabled={pendingAction === 'start' || Boolean(startHint)} onClick={handleStartGame}>
              Start
            </button>
          )}
        </div>
        <p className="helper-text">
          {startHint ?? (isHost ? 'Start when everyone is set.' : 'The host starts the game.')}
        </p>
      </div>
    </main>
  );
}

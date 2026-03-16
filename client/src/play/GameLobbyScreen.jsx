import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAudioCues } from '../audio/AudioCueContext';
import { InfoPopover } from '../components/InfoPopover';
import { ShareIcon } from '../components/Icons';
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
    roomExitNotice,
    error,
    setError,
    clearRoomExitNotice,
    pendingAction,
    ensureRoom,
    assignTeam,
    updateTeamName,
    rebalanceTeams,
    updateRoomSettings,
    submitHatClues,
    kickPlayer,
    setReady,
    startGame
  } = usePlaySession();
  const gameModule = getGameModule(game.id);
  const hatReadyHandlerRef = useRef(null);
  const [toastMessage, setToastMessage] = useState('');
  const [teamNameDrafts, setTeamNameDrafts] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    teamCount: 2,
    turnDurationSeconds: 45,
    totalRounds: 3,
    skipLimit: 1,
    rounds: 2,
    imposterCount: 1,
    roundDurationSeconds: 45,
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
    if (roomExitNotice?.code !== roomCode) {
      return;
    }

    navigate(`/play/${game.id}`, {
      replace: true,
      state: { toastMessage: roomExitNotice.message }
    });
    clearRoomExitNotice();
  }, [clearRoomExitNotice, game.id, navigate, roomCode, roomExitNotice]);

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
  const requiredPlayerCount = useMemo(() => {
    if (game.id === 'imposter') {
      return Math.max(game.minPlayers, settingsForm.imposterCount + 2);
    }

    if (gameModule.requiresTeams) {
      return Math.max(game.minPlayers, (settingsForm.teamCount ?? 2) * 2);
    }

    return game.minPlayers;
  }, [
    game.id,
    game.minPlayers,
    gameModule.requiresTeams,
    settingsForm.imposterCount,
    settingsForm.teamCount
  ]);
  const requiredHatClues =
    roomState?.lobbyState?.requiredCluesPerPlayer ??
    roomState?.settings?.cluesPerPlayer ??
    settingsForm.cluesPerPlayer;
  const currentPlayerClueCount =
    currentPlayer && gameModule.requiresHatClues
      ? (roomState?.lobbyState?.clueCountsByPlayerId?.[currentPlayer.id] ??
        lobbyPrivateState?.submittedCount ??
        0)
      : 0;
  const canReadyUp =
    !gameModule.requiresHatClues || currentPlayerClueCount === requiredHatClues;
  const inviteLink = buildInviteLink(game.id, roomCode);
  const startHint = useMemo(
    () => getStartHint({ roomState, game, gameModule, isHost, allPlayersReady }),
    [allPlayersReady, game, gameModule, isHost, roomState]
  );
  const howToPlayItems = game.howToPlay ?? [];
  const readyHint =
    !canReadyUp && currentPlayer
      ? `Save all ${requiredHatClues} clues before readying up.`
      : startHint ?? (isHost ? 'Start when everyone is set.' : 'The host starts the game.');
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

  const registerHatReadyHandler = (handler) => {
    hatReadyHandlerRef.current = handler;

    return () => {
      if (hatReadyHandlerRef.current === handler) {
        hatReadyHandlerRef.current = null;
      }
    };
  };

  const handleReadyToggle = async () => {
    if (gameModule.requiresHatClues && !currentPlayer?.ready) {
      const prepareResponse = await hatReadyHandlerRef.current?.();
      if (!prepareResponse?.ok) {
        return;
      }
    }

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
      <div className="panel-grid panel-grid--lobby">
        <section className="panel panel--hero panel--stacked">
          <div className="room-code-card room-code-card--bare">
            <strong className="room-code-card__value">{roomState.code}</strong>
            <p className="helper-text room-code-card__meta">
              {roomState.players.length} / {requiredPlayerCount} players joined
            </p>
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
            <InfoPopover label={`How to play ${game.name}`} title={`How to play ${game.name}`}>
              <ol className="step-list step-list--compact">
                {howToPlayItems.map((item, index) => (
                  <li key={`${game.id}-lobby-rule-${index}`} className="step-card">
                    <span className="step-card__index">0{index + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </InfoPopover>
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
          registerHatReadyHandler={registerHatReadyHandler}
          kickPlayer={kickPlayer}
          setError={setError}
          error={error}
          playerId={playerId}
          onToast={setToastMessage}
          onPlaySubmitCue={() => playCue('submit')}
        />
      </div>

      <div className="lobby-action-dock">
        <div className="action-bar action-bar--dock">
          <div className="action-bar__actions">
            <button
              disabled={
                !currentPlayer ||
                pendingAction === 'ready' ||
                (!gameModule.requiresHatClues && !currentPlayer?.ready && !canReadyUp)
              }
              onClick={handleReadyToggle}
            >
              {currentPlayer?.ready ? 'Unready' : gameModule.requiresHatClues ? 'Save & Ready' : 'Ready'}
            </button>
            {isHost && (
              <button disabled={pendingAction === 'start' || Boolean(startHint)} onClick={handleStartGame}>
                Start
              </button>
            )}
          </div>
          <p className="helper-text action-bar__hint">{readyHint}</p>
        </div>
      </div>
    </main>
  );
}

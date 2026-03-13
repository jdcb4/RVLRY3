import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameModule } from '../games/registry';
import { GAMEPLAY_COMPONENTS } from './gameplay';
import { ImposterPlay } from './gameplay/ImposterPlay';
import { usePlaySession } from './PlaySessionContext';

export function GamePlayScreen() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const {
    game,
    playerName,
    playerId,
    roomState,
    privateState,
    ensureRoom,
    sendGameAction,
    returnRoomToLobby,
    pendingAction
  } = usePlaySession();
  const gameModule = getGameModule(game.id);

  useEffect(() => {
    let ignore = false;

    if (!roomCode) {
      return undefined;
    }

    if (!playerName.trim()) {
      navigate(`/play/${game.id}/join/${roomCode}`, { replace: true });
      return undefined;
    }

    if (roomState?.code === roomCode && roomState.phase === 'in-progress' && playerId) {
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
  }, [ensureRoom, game.id, navigate, playerId, playerName, roomCode, roomState?.code, roomState?.phase]);

  useEffect(() => {
    if (roomState?.code === roomCode && roomState.phase !== 'in-progress') {
      navigate(`/play/${game.id}/lobby/${roomCode}`, { replace: true });
    }
  }, [game.id, navigate, roomCode, roomState?.code, roomState?.phase]);

  const playersById = useMemo(
    () => new Map((roomState?.players ?? []).map((player) => [player.id, player])),
    [roomState?.players]
  );
  const isHost = roomState?.hostId === playerId;
  const gameplayLead = gameModule.gameplayLead;
  const ActiveGameplay = GAMEPLAY_COMPONENTS[gameModule.playVariant] ?? ImposterPlay;

  if (!roomState || roomState.code !== roomCode || roomState.phase !== 'in-progress') {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Gameplay</p>
        <h1 className="scene__title">{game.name}</h1>
        <p className="scene__lead">Restoring the round and your private state.</p>
      </main>
    );
  }

  return (
    <main className="scene scene--gameplay">
      <header className="scene__header scene__header--compact">
        <p className="scene__eyebrow">{game.name} in play</p>
        <h1 className="scene__title">Room {roomState.code}</h1>
        <p className="scene__lead">{gameplayLead}</p>
      </header>

      <ActiveGameplay
        roomCode={roomCode}
        roomState={roomState}
        privateState={privateState}
        playersById={playersById}
        playerId={playerId}
        isHost={isHost}
        pendingAction={pendingAction}
        sendGameAction={sendGameAction}
        returnRoomToLobby={returnRoomToLobby}
      />
    </main>
  );
}

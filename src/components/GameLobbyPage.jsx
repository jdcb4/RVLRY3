import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GAME_MODES, getGameById } from '../games/catalog';
import SocketLobbyPanel from './SocketLobbyPanel';
import PassAndPlayPanel from './PassAndPlayPanel';

function GameLobbyPage() {
  const { gameId } = useParams();
  const game = useMemo(() => getGameById(gameId), [gameId]);
  const [mode, setMode] = useState(game?.supportedModes[0] ?? GAME_MODES.SOCKET);

  if (!game) {
    return <p>Game not found.</p>;
  }

  return (
    <section className="layout-stack">
      <h2>{game.title}</h2>
      <p>{game.summary}</p>
      <div className="mode-picker">
        {game.supportedModes.map((supportedMode) => (
          <button
            key={supportedMode}
            type="button"
            className={mode === supportedMode ? 'selected' : ''}
            onClick={() => setMode(supportedMode)}
          >
            {supportedMode}
          </button>
        ))}
      </div>

      {mode === GAME_MODES.SOCKET ? <SocketLobbyPanel game={game} /> : <PassAndPlayPanel game={game} />}
    </section>
  );
}

export default GameLobbyPage;

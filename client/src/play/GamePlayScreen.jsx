import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePlaySession } from './PlaySessionContext';

function renderPrivatePanel(gameplayView, privateState) {
  if (gameplayView === 'imposter') {
    return (
      <section className="panel">
        <h2>Your role</h2>
        <div className="meta-list">
          <div className="stat-row">
            <span>Role</span>
            <span>{privateState?.role ?? 'Waiting for assignment'}</span>
          </div>
          <div className="stat-row">
            <span>Word</span>
            <span>{privateState?.word ?? 'No word. Blend in.'}</span>
          </div>
        </div>
      </section>
    );
  }

  if (gameplayView === 'whowhatwhere') {
    return (
      <section className="panel">
        <h2>Round focus</h2>
        <p>
          Keep clues short, listen for guesses, and move quickly. This round shares one public prompt
          for the full room.
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Sketch flow</h2>
      <p>
        Stay on the active prompt, pass control cleanly, and let the chain drift in unexpected
        directions.
      </p>
    </section>
  );
}

function renderPublicPanel(gameplayView, publicState) {
  if (gameplayView === 'imposter') {
    return (
      <section className="panel panel--hero">
        <h2>Room state</h2>
        <div className="stat-row">
          <span>Status</span>
          <span>{publicState?.status ?? 'Waiting'}</span>
        </div>
        <div className="stat-row">
          <span>Clues given</span>
          <span>{publicState?.clueCount ?? 0}</span>
        </div>
      </section>
    );
  }

  if (gameplayView === 'whowhatwhere') {
    return (
      <section className="panel panel--hero">
        <h2>Round state</h2>
        <div className="stat-row">
          <span>Word length</span>
          <span>{publicState?.currentWordLength ?? '-'}</span>
        </div>
        <div className="stat-row">
          <span>Guessed</span>
          <span>{publicState?.guessed ?? 0}</span>
        </div>
        <div className="stat-row">
          <span>Skipped</span>
          <span>{publicState?.skipped ?? 0}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="panel panel--hero">
      <h2>Chain state</h2>
      <div className="stat-row">
        <span>Prompt</span>
        <span>{publicState?.activePrompt ?? 'Waiting'}</span>
      </div>
      <div className="stat-row">
        <span>Chain length</span>
        <span>{publicState?.chainLength ?? 0}</span>
      </div>
      <div className="stat-row">
        <span>Submissions</span>
        <span>{publicState?.submissions ?? 0}</span>
      </div>
    </section>
  );
}

export function GamePlayScreen() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const { game, playerName, playerId, roomState, privateState, ensureRoom } = usePlaySession();

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

  if (!roomState || roomState.code !== roomCode || roomState.phase !== 'in-progress') {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Gameplay</p>
        <h1 className="scene__title">{game.name}</h1>
        <p className="scene__lead">Restoring the active round and your private game state.</p>
      </main>
    );
  }

  return (
    <main className="scene scene--gameplay">
      <header className="scene__header">
        <p className="scene__eyebrow">{game.name} in play</p>
        <h1 className="scene__title">Room {roomState.code}</h1>
        <p className="scene__lead">
          Gameplay lives here only. Lobby controls stay behind you until the round ends.
        </p>
      </header>

      <div className="gameplay-grid">
        {renderPublicPanel(game.gameplayView, roomState.gamePublicState)}
        {renderPrivatePanel(game.gameplayView, privateState)}
        <section className="panel">
          <h2>At the table</h2>
          <ul className="player-list">
            {roomState.players.map((player) => (
              <li key={player.id} className="player-row">
                <div className="player-row__identity">
                  <span className="player-row__name">{player.name}</span>
                  <div className="player-row__meta">
                    {player.id === roomState.hostId && <span className="badge badge--host">Host</span>}
                    {player.id === playerId && <span className="badge badge--self">You</span>}
                  </div>
                </div>
                <span className="badge badge--ready">Playing</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Round notes</h2>
          <ul className="rule-list">
            {game.howToPlay.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

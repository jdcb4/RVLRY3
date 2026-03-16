import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { PhoneIcon, UsersIcon } from './components/Icons';
import { games } from './games/config';

const PLAYER_NAME_STORAGE_KEY = 'rvlry.playerName';
const HUB_MODE_STORAGE_KEY = 'rvlry.hubMode';

const LocalMode = lazy(() =>
  import('./components/LocalMode').then((module) => ({ default: module.LocalMode }))
);
const GameLanding = lazy(() =>
  import('./play/GameLanding').then((module) => ({ default: module.GameLanding }))
);
const GameLobbyScreen = lazy(() =>
  import('./play/GameLobbyScreen').then((module) => ({ default: module.GameLobbyScreen }))
);
const GamePlayScreen = lazy(() =>
  import('./play/GamePlayScreen').then((module) => ({ default: module.GamePlayScreen }))
);
const PlayShell = lazy(() =>
  import('./play/PlayShell').then((module) => ({ default: module.PlayShell }))
);

function HostModeToggle({ mode, onChange }) {
  return (
    <div className="hub-mode-toggle" role="group" aria-label="Host mode">
      <button
        type="button"
        aria-pressed={mode === 'online'}
        className={mode === 'online' ? 'hub-mode-toggle__button hub-mode-toggle__button--active' : 'hub-mode-toggle__button'}
        onClick={() => onChange('online')}
      >
        <UsersIcon />
        Online
      </button>
      <button
        type="button"
        aria-pressed={mode === 'local'}
        className={mode === 'local' ? 'hub-mode-toggle__button hub-mode-toggle__button--active' : 'hub-mode-toggle__button'}
        onClick={() => onChange('local')}
      >
        <PhoneIcon />
        Pass & play
      </button>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState(() => window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? '');
  const [hostMode, setHostMode] = useState(() => window.localStorage.getItem(HUB_MODE_STORAGE_KEY) ?? 'online');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinPending, setJoinPending] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
  }, [playerName]);

  useEffect(() => {
    window.localStorage.setItem(HUB_MODE_STORAGE_KEY, hostMode);
  }, [hostMode]);

  const handleJoin = async () => {
    const normalizedCode = joinCode.trim().toUpperCase();
    if (!playerName.trim()) {
      setJoinError('Enter your name first');
      return;
    }

    if (!normalizedCode) {
      setJoinError('Enter a room code');
      return;
    }

    setJoinPending(true);
    setJoinError('');

    try {
      const response = await fetch(`/api/rooms/${normalizedCode}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.gameId) {
        setJoinError(payload?.error ?? 'Room not found');
        return;
      }

      navigate(`/play/${payload.gameId}/join/${payload.code}`, {
        state: { autoJoin: true }
      });
    } catch {
      setJoinError('Unable to look up that room right now');
    } finally {
      setJoinPending(false);
    }
  };

  return (
    <main className="hub-shell hub-shell--centered">
      <header className="hub-hero hub-hero--centered">
        <h1 className="scene__title">RVLRY</h1>
      </header>

      <section className="hub-panel">
        <label className="settings-field">
          <input
            placeholder="Player name"
            value={playerName}
            onChange={(event) => {
              setPlayerName(event.target.value);
              setJoinError('');
            }}
          />
        </label>
      </section>

      <section className="hub-panel">
        <div className="panel-heading">
          <h2>Join a game</h2>
        </div>

        <div className="field-stack">
          <label className="settings-field">
            <input
              placeholder="Six-character code"
              value={joinCode}
              maxLength={6}
              onChange={(event) => {
                setJoinCode(event.target.value.toUpperCase());
                setJoinError('');
              }}
            />
          </label>

          {joinError ? <p className="connection-banner connection-banner--error">{joinError}</p> : null}

          <div className="actions">
            <button disabled={joinPending} onClick={handleJoin}>
              {joinPending ? 'Joining' : 'Join game'}
            </button>
          </div>
        </div>
      </section>

      <section className="hub-panel hub-panel--games">
        <div className="panel-heading">
          <h2>Host a game</h2>
        </div>

        <HostModeToggle mode={hostMode} onChange={setHostMode} />

        <div className="hub-list">
          {games
            .filter((game) => hostMode === 'online' || game.supportsLocal)
            .map((game) => (
              <Link
                key={game.id}
                className="hub-card hub-card--link"
                to={hostMode === 'online' ? `/play/${game.id}` : `/local/${game.id}`}
              >
                <div className="hub-card__body">
                  <div>
                    <h2>{game.name}</h2>
                    <span className="badge hub-card__players">{game.playerRangeLabel}</span>
                    <p className="hub-card__description">{game.description}</p>
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </section>
    </main>
  );
}

function RouteFallback() {
  return (
    <main className="scene scene--simple">
      <p className="scene__eyebrow">RVLRY</p>
      <h1 className="scene__title">Loading</h1>
    </main>
  );
}

const withSuspense = (element) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play/:gameId" element={withSuspense(<PlayShell />)}>
        <Route index element={withSuspense(<GameLanding />)} />
        <Route path="join/:roomCode" element={withSuspense(<GameLanding />)} />
        <Route path="lobby/:roomCode" element={withSuspense(<GameLobbyScreen />)} />
        <Route path="game/:roomCode" element={withSuspense(<GamePlayScreen />)} />
      </Route>
      <Route path="/local/:gameId" element={withSuspense(<LocalMode />)} />
    </Routes>
  );
}

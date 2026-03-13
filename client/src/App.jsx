import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
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

function HubModeToggle({ mode, onChange }) {
  return (
    <div className="hub-mode-toggle" role="group" aria-label="Play mode">
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
  const [playerName, setPlayerName] = useState(() => window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? '');
  const [mode, setMode] = useState(() => window.localStorage.getItem(HUB_MODE_STORAGE_KEY) ?? 'online');

  useEffect(() => {
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
  }, [playerName]);

  useEffect(() => {
    window.localStorage.setItem(HUB_MODE_STORAGE_KEY, mode);
  }, [mode]);

  return (
    <main className="hub-shell hub-shell--centered">
      <header className="hub-hero hub-hero--centered">
        <h1 className="scene__title">RVLRY</h1>
        <p className="scene__lead">Pick a mode, choose a game, and only show the table what matters next.</p>
      </header>

      <section className="hub-panel">
        <div className="field-stack">
          <label className="settings-field">
            <span className="helper-text">Your name</span>
            <input
              placeholder="Player name"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
            />
          </label>
          <HubModeToggle mode={mode} onChange={setMode} />
        </div>
      </section>

      <section className="hub-panel hub-panel--games">
        <div className="panel-heading">
          <h2>{mode === 'online' ? 'Choose a game' : 'Choose a local game'}</h2>
        </div>

        <div className="hub-list">
          {games
            .filter((game) => mode === 'online' || game.supportsLocal)
            .map((game) => (
              <Link
                key={game.id}
                className="hub-card hub-card--link"
                to={mode === 'online' ? `/play/${game.id}` : `/local/${game.id}`}
              >
                <div className="hub-card__body">
                  <div>
                    <p className="hub-card__eyebrow">{game.tagline}</p>
                    <h2>{game.name}</h2>
                    <div className="facts-row facts-row--tight">
                      <span className="fact-chip">{game.minPlayers}+ players</span>
                      {mode === 'online' ? (
                        <span className="fact-chip">Room code</span>
                      ) : (
                        <span className="fact-chip">Single device</span>
                      )}
                    </div>
                  </div>
                  <span className="hub-card__icon" aria-hidden="true">
                    {mode === 'online' ? <UsersIcon /> : <PhoneIcon />}
                  </span>
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

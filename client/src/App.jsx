import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { games } from './games/config';

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

function Home() {
  return (
    <main className="hub-shell">
      <header className="hub-hero">
        <p className="scene__eyebrow">Mobile-first party games</p>
        <h1 className="scene__title">RVLRY</h1>
        <p className="scene__lead">
          Quick room-based games designed for phones first. Pick a title, start a clean lobby,
          and keep the live round focused on what players need right now.
        </p>
        <div className="facts-row">
          <span className="fact-chip">{games.length} live games</span>
          <span className="fact-chip">Share by room code</span>
          <span className="fact-chip">No app install</span>
        </div>
      </header>

      <section className="hub-grid">
        {games.map((game) => (
          <article key={game.id} className="hub-card">
            <p className="hub-card__eyebrow">{game.tagline}</p>
            <h2>{game.name}</h2>
            <p>{game.description}</p>
            <div className="facts-row facts-row--tight">
              <span className="fact-chip">{game.minPlayers}+ players</span>
              <span className="fact-chip">{game.supportsLocal ? 'Online + local' : 'Online only'}</span>
            </div>
            <div className="actions">
              <Link className="button-link" to={`/play/${game.id}`}>
                Open {game.name}
              </Link>
            </div>
          </article>
        ))}
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

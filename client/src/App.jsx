import { Link, Route, Routes } from 'react-router-dom';
import { LocalMode } from './components/LocalMode';
import { games } from './games/config';
import { GameLanding } from './play/GameLanding';
import { GameLobbyScreen } from './play/GameLobbyScreen';
import { GamePlayScreen } from './play/GamePlayScreen';
import { PlayShell } from './play/PlayShell';

function Home() {
  return (
    <main className="hub-shell">
      <header className="hub-hero">
        <p className="scene__eyebrow">Mobile party games</p>
        <h1 className="scene__title">RVLRY</h1>
        <p className="scene__lead">
          Pick a game, gather a room, and move cleanly from onboarding into lobby and play.
        </p>
      </header>
      <section className="hub-grid">
        {games.map((game) => (
          <article key={game.id} className="hub-card">
            <p className="hub-card__eyebrow">{game.tagline}</p>
            <h2>{game.name}</h2>
            <p>{game.description}</p>
            <div className="actions">
              <Link className="button-link" to={`/play/${game.id}`}>
                Open game
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play/:gameId" element={<PlayShell />}>
        <Route index element={<GameLanding />} />
        <Route path="join/:roomCode" element={<GameLanding />} />
        <Route path="lobby/:roomCode" element={<GameLobbyScreen />} />
        <Route path="game/:roomCode" element={<GamePlayScreen />} />
      </Route>
      <Route path="/local/:gameId" element={<LocalMode />} />
    </Routes>
  );
}

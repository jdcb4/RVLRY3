import { Link, Route, Routes } from 'react-router-dom';
import { GameLobby } from './components/GameLobby';
import { LocalMode } from './components/LocalMode';
import { games } from './games/config';

function Home() {
  return (
    <main className="app-shell">
      <header>
        <h1>RVLRY</h1>
        <p>Party games built for mobile and room screens.</p>
      </header>
      <section className="game-grid">
        {games.map((game) => (
          <article key={game.id} className="card">
            <h2>{game.name}</h2>
            <p>{game.description}</p>
            <div className="actions">
              <Link to={`/play/${game.id}`}>Online</Link>
              {game.supportsLocal && <Link to={`/local/${game.id}`}>Pass &amp; Play</Link>}
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
      <Route path="/play/:gameId" element={<GameLobby />} />
      <Route path="/local/:gameId" element={<LocalMode />} />
    </Routes>
  );
}

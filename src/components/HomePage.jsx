import { Link } from 'react-router-dom';
import { gameCatalog } from '../games/catalog';

function HomePage() {
  return (
    <section className="layout-stack">
      <h2>Select a game</h2>
      <div className="card-grid">
        {gameCatalog.map((game) => (
          <Link key={game.id} to={`/game/${game.id}`} className="game-card">
            <h3>{game.title}</h3>
            <p>{game.summary}</p>
            <small>Modes: {game.supportedModes.join(', ')}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default HomePage;

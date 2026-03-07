import { games } from '../utils/games';

function SupportBadge({ support }) {
  const label = support === 'online' ? 'Sockets' : 'Pass-and-Play';
  return <span className="badge">{label}</span>;
}

export default function GameLauncher({ onSelectGame }) {
  return (
    <section className="panel">
      <h2>Choose a game</h2>
      <p className="muted">Designed for fast, mobile-first setup.</p>
      <div className="card-grid">
        {games.map((game) => (
          <button key={game.key} type="button" className="game-card" onClick={() => onSelectGame(game.key)}>
            <h3>{game.name}</h3>
            <p>{game.tagline}</p>
            <div className="badge-row">
              {game.supports.map((support) => (
                <SupportBadge key={support} support={support} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

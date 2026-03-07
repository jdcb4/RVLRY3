export default function GameCard({ game, onSelect }) {
  return (
    <button className="game-card" onClick={onSelect}>
      <h3>{game.name}</h3>
      <p>{game.description}</p>
      <small>Modes: {game.modes.join(', ')}</small>
    </button>
  );
}

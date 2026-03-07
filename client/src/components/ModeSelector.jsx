import { modes } from '../utils/games';

export default function ModeSelector({ gameName, selectedMode, onChange, onBack }) {
  return (
    <section className="panel">
      <button className="link-button" type="button" onClick={onBack}>
        ← Back to games
      </button>
      <h2>{gameName}</h2>
      <p>Choose how you want to play.</p>
      <div className="mode-list">
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            className={`mode-button ${selectedMode === mode.key ? 'active' : ''}`}
            onClick={() => onChange(mode.key)}
          >
            {mode.name}
          </button>
        ))}
      </div>
    </section>
  );
}

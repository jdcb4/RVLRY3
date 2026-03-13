import { Link, Outlet, useParams } from 'react-router-dom';
import { SoundToggle } from '../audio/SoundToggle';
import { getGameById } from '../games/config';
import { PlaySessionProvider } from './PlaySessionContext';

export function PlayShell() {
  const { gameId } = useParams();
  const game = getGameById(gameId);

  if (!game) {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Route not found</p>
        <h1 className="scene__title">Unknown game</h1>
        <p className="scene__lead">The game you requested is not configured in RVLRY.</p>
        <div className="actions">
          <Link className="button-link" to="/">
            Back to hub
          </Link>
        </div>
      </main>
    );
  }

  return (
    <PlaySessionProvider game={game}>
      <div className="play-shell">
        <header className="topbar">
          <Link className="topbar__brand" to="/">
            RVLRY
          </Link>
          <div className="topbar__meta">
            <SoundToggle compact />
            <span className="topbar__pill">{game.name}</span>
            <span className="topbar__pill topbar__pill--muted">Online flow</span>
          </div>
        </header>
        <Outlet />
      </div>
    </PlaySessionProvider>
  );
}

import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { SoundToggle } from '../audio/SoundToggle';
import { ArrowLeftIcon } from '../components/Icons';
import { getGameById } from '../games/config';
import { PlaySessionProvider } from './PlaySessionContext';

export function PlayShell() {
  const location = useLocation();
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

  const lobbyBackTarget = location.pathname.includes(`/play/${game.id}/lobby/`)
    ? `/play/${game.id}`
    : null;

  return (
    <PlaySessionProvider game={game}>
      <div className="play-shell">
        <header className="topbar">
          <div className="topbar__leading">
            {lobbyBackTarget ? (
              <Link
                aria-label="Back to game setup"
                className="topbar__pill topbar__pill--button topbar__pill--icon topbar__pill--compact"
                to={lobbyBackTarget}
              >
                <ArrowLeftIcon />
              </Link>
            ) : null}
            <Link className="topbar__brand" to="/">
              RVLRY
            </Link>
          </div>
          <div className="topbar__meta">
            <SoundToggle compact />
            <span className="topbar__pill">{game.name}</span>
          </div>
        </header>
        <Outlet />
      </div>
    </PlaySessionProvider>
  );
}

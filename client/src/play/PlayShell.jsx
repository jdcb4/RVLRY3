import { Link, Outlet, useParams } from 'react-router-dom';
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
      <Outlet />
    </PlaySessionProvider>
  );
}

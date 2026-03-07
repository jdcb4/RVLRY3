import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from '../components/HomePage';
import GameLobbyPage from '../components/GameLobbyPage';
import WordSyncStatus from '../components/WordSyncStatus';
import { useWeeklyWordSync } from '../services/useWeeklyWordSync';

function App() {
  const { isSyncing, lastSync, syncNow, error } = useWeeklyWordSync();

  useEffect(() => {
    if (error) {
      console.warn('Word sync failed', error);
    }
  }, [error]);

  return (
    <div className="app-shell">
      <header className="brand-header">
        <h1>RVLRY</h1>
        <p>Modern parlour games for local and online play.</p>
      </header>
      <WordSyncStatus isSyncing={isSyncing} lastSync={lastSync} onSync={syncNow} error={error} />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:gameId" element={<GameLobbyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

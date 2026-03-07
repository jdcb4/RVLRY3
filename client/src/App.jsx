import { useMemo, useState } from 'react';
import GameLauncher from './components/GameLauncher';
import ModeSelector from './components/ModeSelector';
import OnlineLobby from './components/OnlineLobby';
import ImposterGame from './games/ImposterGame';
import WhoWhatWhereGame from './games/WhoWhatWhereGame';
import DrawNGuessGame from './games/DrawNGuessGame';
import { games } from './utils/games';

const localGameViews = {
  imposter: ImposterGame,
  whowhatwhere: WhoWhatWhereGame,
  drawnguess: DrawNGuessGame
};

export default function App() {
  const [selectedGame, setSelectedGame] = useState('');
  const [mode, setMode] = useState('online');

  const gameMeta = useMemo(() => games.find((game) => game.key === selectedGame), [selectedGame]);
  const LocalGameComponent = selectedGame ? localGameViews[selectedGame] : null;

  return (
    <main className="app-shell">
      <header>
        <h1>RVLRY</h1>
        <p>Online parlour games for groups in one room or across devices.</p>
      </header>

      {!selectedGame ? <GameLauncher onSelectGame={setSelectedGame} /> : null}

      {selectedGame ? (
        <>
          <ModeSelector
            gameName={gameMeta?.name || ''}
            selectedMode={mode}
            onChange={setMode}
            onBack={() => setSelectedGame('')}
          />

          {mode === 'online' ? <OnlineLobby gameKey={selectedGame} /> : null}

          {mode === 'local' && LocalGameComponent ? <LocalGameComponent mode={mode} /> : null}
        </>
      ) : null}
    </main>
  );
}

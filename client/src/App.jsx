import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import GameCard from './components/GameCard';
import LobbyForm from './components/LobbyForm';
import ImposterGame from './games/ImposterGame';
import WhoWhatWhereGame from './games/WhoWhatWhereGame';
import DrawNGuessGame from './games/DrawNGuessGame';
import { GAME_METADATA, GAME_TYPES } from './lib/gameTypes';
import { useGameStore } from './hooks/useGameStore';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="grid">
      {Object.entries(GAME_METADATA).map(([slug, game]) => (
        <GameCard key={slug} game={game} onSelect={() => navigate(`/lobby/${slug}`)} />
      ))}
    </div>
  );
}

function Lobby() {
  const navigate = useNavigate();
  const { gameType } = useParams();
  const setSession = useGameStore((state) => state.setSession);

  const metadata = GAME_METADATA[gameType];
  if (!metadata) return <p>Unknown game.</p>;

  const handleSubmit = ({ playerName, roomCode, mode }) => {
    setSession({ playerName, roomCode: roomCode || 'LOCAL', gameType, mode });
    navigate(`/play/${gameType}`);
  };

  return (
    <div>
      <h2>{metadata.name}</h2>
      <LobbyForm onSubmit={handleSubmit} supportsLocal={metadata.modes.includes('pass-and-play')} />
    </div>
  );
}

function Play() {
  const { gameType } = useParams();
  const session = useGameStore();

  if (gameType === GAME_TYPES.IMPOSTER) {
    return <ImposterGame roomCode={session.roomCode} playerName={session.playerName} gameType={gameType} />;
  }
  if (gameType === GAME_TYPES.WHOWHATWHERE) {
    return <WhoWhatWhereGame mode={session.mode} />;
  }
  if (gameType === GAME_TYPES.DRAWNGUESS) {
    return <DrawNGuessGame roomCode={session.roomCode} playerName={session.playerName} gameType={gameType} />;
  }
  return <p>Game coming soon.</p>;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:gameType" element={<Lobby />} />
        <Route path="/play/:gameType" element={<Play />} />
      </Routes>
    </Layout>
  );
}

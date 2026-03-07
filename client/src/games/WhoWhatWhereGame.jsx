import { useState } from 'react';
import LocalGameShell from '../components/LocalGameShell';

export default function WhoWhatWhereGame({ mode }) {
  const [teamA, setTeamA] = useState(0);
  const [teamB, setTeamB] = useState(0);

  if (mode === 'online') {
    return null;
  }

  return (
    <LocalGameShell
      title="WhoWhatWhere"
      description="One player describes, teammates guess before the timer ends."
    >
      <div className="score-grid">
        <button type="button" onClick={() => setTeamA((score) => score + 1)}>Team A +1</button>
        <strong>{teamA}</strong>
        <button type="button" onClick={() => setTeamB((score) => score + 1)}>Team B +1</button>
        <strong>{teamB}</strong>
      </div>
    </LocalGameShell>
  );
}

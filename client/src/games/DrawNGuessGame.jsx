import { useState } from 'react';
import LocalGameShell from '../components/LocalGameShell';

export default function DrawNGuessGame({ mode }) {
  const [chain, setChain] = useState(['Write a starting word']);
  const [entry, setEntry] = useState('');

  if (mode === 'online') {
    return null;
  }

  function submitEntry() {
    if (!entry.trim()) {
      return;
    }

    setChain((current) => [...current, entry.trim()]);
    setEntry('');
  }

  return (
    <LocalGameShell
      title="DrawNGuess"
      description="Alternate between prompts and guesses as the phone passes around."
    >
      <label>
        Next prompt/guess
        <input value={entry} onChange={(event) => setEntry(event.target.value)} />
      </label>
      <button type="button" onClick={submitEntry}>Add step</button>
      <ol>
        {chain.map((step, index) => (
          <li key={`${step}-${index}`}>{step}</li>
        ))}
      </ol>
    </LocalGameShell>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGameWords } from '../lib/api';

export default function WhoWhatWhereGame({ mode }) {
  const { data } = useQuery({
    queryKey: ['words', 'whowhatwhere'],
    queryFn: () => fetchGameWords('whowhatwhere'),
  });
  const [index, setIndex] = useState(0);

  const words = data?.words || [];
  const current = words[index % (words.length || 1)] || 'Loading words...';

  return (
    <section>
      <h2>WhoWhatWhere</h2>
      <p>Mode: {mode}</p>
      <div className="prompt-card">{current}</div>
      <button className="primary" onClick={() => setIndex((x) => x + 1)}>
        Next word
      </button>
      <small>Supports local pass-and-play and online score tracking.</small>
    </section>
  );
}

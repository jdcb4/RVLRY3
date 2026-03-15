import { useEffect, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
import { getActiveImposterPlayer, getImposterSecretForPlayer } from '../../local/session';
import { ResultsActions } from './common';

export function ImposterLocalView({
  session,
  applyAction,
  busyAction,
  onPlayAgain,
  onResetSetup
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [roundStarted, setRoundStarted] = useState(false);
  const activePlayer = getActiveImposterPlayer(session);
  const secret = activePlayer
    ? getImposterSecretForPlayer(session, activePlayer.id)
    : null;

  useStageCue(session.stage, {
    clues: 'phase-change',
    discussion: 'phase-change',
    results: 'results-reveal'
  });

  useEffect(() => {
    setIsRevealed(false);
  }, [session.stage, session.revealIndex]);

  useEffect(() => {
    if (session.stage !== 'clues') {
      setRoundStarted(false);
    }
  }, [session.stage]);

  if (session.stage === 'reveal' && activePlayer) {
    return (
      <div className="gameplay-stack">
        {!isRevealed ? (
          <section className="panel panel--hero panel--stacked gameplay-primary">
            <div className="panel-heading">
              <p className="status-pill">
                Player reveal {session.revealIndex + 1} / {session.players.length}
              </p>
              <h2>Pass the phone to {activePlayer.name}</h2>
            </div>

            <div className="notice-card local-handoff">
              <strong>
                {activePlayer.name}, confirm when you are ready to check your player
                details.
              </strong>
            </div>

            <button onClick={() => setIsRevealed(true)}>
              Reveal {activePlayer.name} details
            </button>
          </section>
        ) : (
          <section className="panel panel--hero panel--stacked gameplay-primary">
            <div className="panel-heading">
              <p className="status-pill">
                Player reveal {session.revealIndex + 1} / {session.players.length}
              </p>
              <h2>{activePlayer.name} details</h2>
            </div>

            <div className="role-card">
              <span className="helper-text">Role</span>
              <strong className="role-card__title">
                {secret.role === 'imposter' ? 'Imposter' : 'Crew'}
              </strong>
              <span className="helper-text">Word</span>
              <strong className="role-card__body">
                {secret.word ?? 'No word. Blend in and stay calm.'}
              </strong>
            </div>

            <p className="helper-text">
              Click I Understand once you have memorised your details.
            </p>

            <button
              onClick={() => {
                setIsRevealed(false);
                applyAction({ type: 'next-reveal' });
              }}
            >
              I Understand
            </button>
          </section>
        )}
      </div>
    );
  }

  if (session.stage === 'clues') {
    return (
      <div className="gameplay-stack">
        {!roundStarted ? (
          <section className="panel panel--hero panel--stacked gameplay-primary">
            <div className="panel-heading">
              <p className="status-pill">Round prep</p>
              <h2>Pass the phone back to the host</h2>
            </div>

            <div className="notice-card local-handoff">
              <strong>Host, confirm when you are ready to begin the round.</strong>
            </div>

            <button onClick={() => setRoundStarted(true)}>Begin round</button>
          </section>
        ) : (
          <section className="panel panel--hero panel--stacked gameplay-primary">
            <div className="panel-heading">
              <p className="status-pill">Round live</p>
              <h2>Take it in turns going around the group</h2>
              <p>
                Each player may say 1 word and 1 word only. Go around the group{' '}
                {session.settings.rounds} time
                {session.settings.rounds === 1 ? '' : 's'}.
              </p>
            </div>

            <ul className="player-list">
              {session.players.map((player, index) => (
                <li key={player.id} className="player-row player-row--compact">
                  <div className="player-row__identity">
                    <span className="player-row__name">{player.name}</span>
                    <span className="helper-text">Player {index + 1}</span>
                  </div>
                </li>
              ))}
            </ul>

            <p className="helper-text">
              Click finished when everyone has gone {session.settings.rounds} time
              {session.settings.rounds === 1 ? '' : 's'}.
            </p>

            <button onClick={() => applyAction({ type: 'complete-clue-rounds' })}>
              Move to judgement
            </button>
          </section>
        )}
      </div>
    );
  }

  if (session.stage === 'discussion') {
    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">Discuss</p>
            <h2>Discuss as a group</h2>
            <p>
              Discuss amongst yourselves who you think the imposter
              {session.settings.imposterCount === 1 ? ' was' : 's were'}. Once you have
              finished discussing and voting, click reveal to find out who was faking it.
            </p>
          </div>

          <button onClick={() => applyAction({ type: 'reveal-imposters' })}>
            Reveal imposter
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">Reveal</p>
          <h2>Imposter reveal</h2>
        </div>

        <div className="role-card">
          <span className="helper-text">Secret word</span>
          <strong className="role-card__title">{session.results?.secretWord}</strong>
          <span className="role-card__body">
            {(session.results?.imposterIds ?? [session.results?.imposterId])
              .map(
                (imposterId) =>
                  session.players.find((player) => player.id === imposterId)?.name ??
                  'Player'
              )
              .join(', ')}{' '}
            {(session.results?.imposterIds?.length ?? 1) > 1
              ? 'were the imposters.'
              : 'was the imposter.'}
          </span>
        </div>

        <ResultsActions
          busyAction={busyAction}
          onPlayAgain={onPlayAgain}
          onResetSetup={onResetSetup}
        />
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
import { SummaryChips } from '../gameplay/SharedGameUi';
import {
  getActiveImposterPlayer,
  getImposterSecretForPlayer,
  MAX_LOCAL_CLUE_LENGTH
} from '../../local/session';
import { HandoffPanel, ResultsActions } from './common';

export function ImposterLocalView({
  session,
  applyAction,
  busyAction,
  onPlayAgain,
  onResetSetup
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [clueText, setClueText] = useState('');
  const activePlayer = getActiveImposterPlayer(session);
  const secret = activePlayer
    ? getImposterSecretForPlayer(session, activePlayer.id)
    : null;

  useStageCue(session.stage, {
    clues: 'phase-change',
    voting: 'phase-change',
    results: 'results-reveal'
  });

  useEffect(() => {
    setIsRevealed(false);
    setClueText('');
  }, [session.stage, session.revealIndex, session.clueIndex, session.votingIndex]);

  if (session.stage === 'reveal' && activePlayer) {
    return (
      <div className="gameplay-stack">
        <HandoffPanel
          pill={`Role reveal ${session.revealIndex + 1} / ${session.players.length}`}
          title={`Pass to ${activePlayer.name}`}
          description="Only this player should see the reveal before the phone moves on."
          isRevealed={isRevealed}
          onReveal={() => setIsRevealed(true)}
          onHide={() => setIsRevealed(false)}
          footer={
            isRevealed ? (
              <button onClick={() => applyAction({ type: 'next-reveal' })}>
                {session.revealIndex === session.players.length - 1
                  ? 'Start clue round'
                  : 'Lock and pass'}
              </button>
            ) : null
          }
        >
          <div className="role-card">
            <span className="helper-text">Role</span>
            <strong className="role-card__title">
              {secret.role === 'imposter' ? 'Imposter' : 'Crew'}
            </strong>
            <span className="helper-text">Word</span>
            <strong className="role-card__body">
              {secret.word ?? 'No word. Bluff through the clues.'}
            </strong>
          </div>
        </HandoffPanel>
      </div>
    );
  }

  if (session.stage === 'clues' && activePlayer) {
    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">Clue round</p>
            <h2>{activePlayer.name} is up</h2>
            <p>Say the clue, then log it here.</p>
          </div>

          <SummaryChips
            items={[
              {
                label: 'Clue turn',
                value: `${session.clueIndex + 1} / ${session.players.length}`
              },
              { label: 'Clues logged', value: session.clues.length },
              { label: 'Players', value: session.players.length }
            ]}
          />

          <label className="settings-field">
            <span className="helper-text">Clue from {activePlayer.name}</span>
            <input
              placeholder="Short clue for the room"
              maxLength={MAX_LOCAL_CLUE_LENGTH}
              value={clueText}
              onChange={(event) => setClueText(event.target.value)}
            />
          </label>

          <button
            onClick={() => applyAction({ type: 'submit-clue', payload: { text: clueText } })}
          >
            Save clue
          </button>
        </section>

        <section className="panel panel--stacked">
          <div className="panel-heading">
            <h2>Clue feed</h2>
          </div>

          {session.clues.length > 0 ? (
            <ul className="player-list">
              {session.clues.map((clue) => {
                const player = session.players.find((entry) => entry.id === clue.playerId);
                return (
                  <li
                    key={`${clue.playerId}-${clue.text}`}
                    className="player-row player-row--compact"
                  >
                    <div className="player-row__identity">
                      <span className="player-row__name">
                        {player?.name ?? 'Player'}
                      </span>
                      <span className="helper-text">{clue.text}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="helper-text">
              Saved clues will appear here as the round progresses.
            </p>
          )}
        </section>
      </div>
    );
  }

  if (session.stage === 'voting' && activePlayer) {
    return (
      <div className="gameplay-stack">
        <HandoffPanel
          pill={`Secret vote ${session.votingIndex + 1} / ${session.players.length}`}
          title={`Pass to ${activePlayer.name}`}
          description="Keep each vote private until everyone has chosen."
          isRevealed={isRevealed}
          onReveal={() => setIsRevealed(true)}
          onHide={() => setIsRevealed(false)}
        >
          <div className="field-stack">
            <p className="helper-text">Who seems most likely to be bluffing?</p>
            <div className="actions actions--stretch">
              {session.players
                .filter((player) => player.id !== activePlayer.id)
                .map((player) => (
                  <button
                    key={player.id}
                    className="secondary-action"
                    onClick={() =>
                      applyAction({
                        type: 'submit-vote',
                        payload: { targetPlayerId: player.id }
                      })
                    }
                  >
                    Vote for {player.name}
                  </button>
                ))}
            </div>
          </div>
        </HandoffPanel>
      </div>
    );
  }

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">Round complete</p>
          <h2>{session.results?.outcome === 'crew' ? 'Crew wins' : 'Imposter wins'}</h2>
          <p>{session.results?.reason}</p>
        </div>

        <div className="role-card">
          <span className="helper-text">Secret word</span>
          <strong className="role-card__title">{session.results?.secretWord}</strong>
          <span className="role-card__body">
            {session.players.find((player) => player.id === session.results?.imposterId)
              ?.name ?? 'Player'}{' '}
            was the imposter.
          </span>
        </div>

        <ResultsActions
          busyAction={busyAction}
          onPlayAgain={onPlayAgain}
          onResetSetup={onResetSetup}
        />
      </section>

      <section className="panel panel--stacked">
        <div className="panel-heading">
          <h2>Vote board</h2>
        </div>

        <ul className="player-list">
          {(session.results?.voteTally ?? []).map((entry) => {
            const player = session.players.find((item) => item.id === entry.playerId);
            return (
              <li key={entry.playerId} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{player?.name ?? 'Player'}</span>
                  <div className="player-row__meta">
                    {entry.playerId === session.results?.imposterId && (
                      <span className="badge badge--host">Imposter</span>
                    )}
                    {entry.playerId === session.results?.accusedPlayerId && (
                      <span className="badge badge--self">Accused</span>
                    )}
                  </div>
                </div>
                <span className="badge">{entry.votes} vote(s)</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

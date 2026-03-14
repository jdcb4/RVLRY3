import { useEffect, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
import { SummaryChips } from '../gameplay/SharedGameUi';
import { getActiveImposterPlayer, getImposterSecretForPlayer } from '../../local/session';
import { HandoffPanel, ResultsActions } from './common';

export function ImposterLocalView({
  session,
  applyAction,
  busyAction,
  onPlayAgain,
  onResetSetup
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasViewedSecret, setHasViewedSecret] = useState(false);
  const [selectedVotes, setSelectedVotes] = useState([]);
  const activePlayer = getActiveImposterPlayer(session);
  const secret = activePlayer
    ? getImposterSecretForPlayer(session, activePlayer.id)
    : null;
  const voteTargetCount = Math.min(session.settings?.imposterCount ?? 1, session.players.length - 1);

  useStageCue(session.stage, {
    clues: 'phase-change',
    discussion: 'phase-change',
    voting: 'phase-change',
    results: 'results-reveal'
  });

  useEffect(() => {
    setIsRevealed(false);
    setHasViewedSecret(false);
    setSelectedVotes([]);
  }, [session.stage, session.revealIndex, session.clueIndex, session.votingIndex, session.clueRound]);

  if (session.stage === 'reveal' && activePlayer) {
    return (
      <div className="gameplay-stack">
        <HandoffPanel
          pill={`Role reveal ${session.revealIndex + 1} / ${session.players.length}`}
          title={`Pass to ${activePlayer.name}`}
          targetName={activePlayer.name}
          description="Only this player should see the reveal before the phone moves on."
          isRevealed={isRevealed}
          onReveal={() => {
            setIsRevealed(true);
            setHasViewedSecret(true);
          }}
          onHide={() => setIsRevealed(false)}
          footer={
            hasViewedSecret ? (
              <button
                onClick={() => {
                  setIsRevealed(false);
                  applyAction({ type: 'next-reveal' });
                }}
              >
                {session.revealIndex === session.players.length - 1
                  ? 'Start spoken rounds'
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
              {secret.word ?? 'No word. Blend in and stay calm.'}
            </strong>
          </div>
        </HandoffPanel>
      </div>
    );
  }

  if (session.stage === 'clues' && activePlayer) {
    return (
      <div className="gameplay-stack">
        <HandoffPanel
          pill={`Round ${session.clueRound} / ${session.settings.rounds}`}
          title={`Pass to ${activePlayer.name}`}
          targetName={activePlayer.name}
          description="This player says one word out loud, then hands the phone on."
          isRevealed={isRevealed}
          onReveal={() => setIsRevealed(true)}
          onHide={() => setIsRevealed(false)}
          showHideButton={false}
          footer={
            isRevealed ? (
              <button onClick={() => applyAction({ type: 'advance-clue-turn' })}>
                {session.clueIndex === session.players.length - 1
                  ? session.clueRound === session.settings.rounds
                    ? 'Finish spoken rounds'
                    : 'Next round'
                  : 'Next player'}
              </button>
            ) : null
          }
        >
          <div className="field-stack">
            <div className="panel-heading">
              <p className="status-pill">Spoken clue round</p>
              <h2>{activePlayer.name} is up</h2>
              <p>Say one word out loud, then tap next.</p>
            </div>

            <SummaryChips
              items={[
                {
                  label: 'Round',
                  value: `${session.clueRound} / ${session.settings.rounds}`
                },
                {
                  label: 'Player',
                  value: `${session.clueIndex + 1} / ${session.players.length}`
                },
                {
                  label: 'Spoken',
                  value: `${session.clueTurns.length} / ${session.players.length * session.settings.rounds}`
                }
              ]}
            />
          </div>
        </HandoffPanel>

        <section className="panel panel--stacked">
          <div className="panel-heading">
            <h2>Spoken order</h2>
          </div>

          {session.clueTurns.length > 0 ? (
            <ul className="player-list">
              {session.clueTurns.map((turn, index) => {
                const player = session.players.find((entry) => entry.id === turn.playerId);
                return (
                  <li
                    key={`${turn.playerId}-${turn.roundNumber}-${index}`}
                    className="player-row player-row--compact"
                  >
                    <div className="player-row__identity">
                      <span className="player-row__name">{player?.name ?? 'Player'}</span>
                      <span className="helper-text">Round {turn.roundNumber}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="helper-text">
              Spoken turns will appear here as the room moves around the circle.
            </p>
          )}
        </section>
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
            <p>Talk it through out loud, then open voting when everyone is ready.</p>
          </div>

          <SummaryChips
            items={[
              { label: 'Rounds', value: session.settings.rounds },
              { label: 'Imposters', value: session.settings.imposterCount },
              { label: 'Players', value: session.players.length }
            ]}
          />

          <button onClick={() => applyAction({ type: 'start-voting' })}>Start voting</button>
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
          targetName={activePlayer.name}
          description="Keep each vote private until everyone has chosen."
          isRevealed={isRevealed}
          onReveal={() => setIsRevealed(true)}
          onHide={() => setIsRevealed(false)}
          footer={
            isRevealed ? (
              <button
                disabled={selectedVotes.length !== voteTargetCount}
                onClick={() =>
                  applyAction({
                    type: 'submit-vote',
                    payload: { targetPlayerIds: selectedVotes }
                  })
                }
              >
                Lock vote
              </button>
            ) : null
          }
        >
          <div className="field-stack">
            <div className="notice-card notice-card--focus">
              <strong>Who are the imposters?</strong>
              <p>
                Pick {voteTargetCount} player{voteTargetCount === 1 ? '' : 's'} before
                locking your vote.
              </p>
            </div>
            <div className="actions actions--stretch">
              {session.players
                .filter((player) => player.id !== activePlayer.id)
                .map((player) => (
                  <button
                    key={player.id}
                    className={selectedVotes.includes(player.id) ? '' : 'secondary-action'}
                    onClick={() =>
                      setSelectedVotes((currentVotes) => {
                        if (currentVotes.includes(player.id)) {
                          return currentVotes.filter((entry) => entry !== player.id);
                        }

                        if (currentVotes.length >= voteTargetCount) {
                          return [...currentVotes.slice(1), player.id];
                        }

                        return [...currentVotes, player.id];
                      })
                    }
                  >
                    {selectedVotes.includes(player.id) ? 'Selected' : 'Select'} {player.name}
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
            {(session.results?.imposterIds ?? [session.results?.imposterId])
              .map(
                (imposterId) =>
                  session.players.find((player) => player.id === imposterId)?.name ?? 'Player'
              )
              .join(', ')}{' '}
            {(session.results?.imposterIds?.length ?? 1) > 1 ? 'were the imposters.' : 'was the imposter.'}
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
                    {(session.results?.imposterIds ?? [session.results?.imposterId]).includes(entry.playerId) ? (
                      <span className="badge badge--host">Imposter</span>
                    ) : null}
                    {(session.results?.accusedPlayerIds ?? [session.results?.accusedPlayerId]).includes(entry.playerId) ? (
                      <span className="badge badge--self">Accused</span>
                    ) : null}
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

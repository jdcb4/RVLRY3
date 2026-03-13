import { useEffect, useMemo, useState } from 'react';
import { useStageCue, useTimedTurnAudio } from '../../audio/useGameAudio';
import { formatCountdown, getCountdownSeconds } from '../../games/timedTurns';
import { getWhoWhatWhereContext } from '../../local/session';
import {
  LeaderboardList,
  SummaryChips,
  TeamScoreboard,
  TurnSummaryPanel
} from '../gameplay/SharedGameUi';
import { buildWhoWhatWhereRosters } from './helpers';
import { HandoffPanel, ResultsActions } from './common';

export function WhoWhatWhereLocalView({
  session,
  applyAction,
  busyAction,
  onStartTurn,
  onPlayAgain,
  onResetSetup
}) {
  const [handoffVisible, setHandoffVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getCountdownSeconds(session.activeTurn?.endsAt)
  );
  const context = getWhoWhatWhereContext(session);
  const teamRosters = useMemo(
    () => buildWhoWhatWhereRosters(session.players, session.teams),
    [session.players, session.teams]
  );

  useTimedTurnAudio({
    active: session.stage === 'turn',
    turnKey: `${session.roundNumber}:${context.activeTeamId}:${context.activeDescriberId}`,
    endsAt: session.activeTurn?.endsAt
  });
  useStageCue(session.stage, {
    results: 'results-reveal'
  });

  useEffect(() => {
    setHandoffVisible(false);
  }, [session.stage, session.roundNumber, session.teamIndex]);

  useEffect(() => {
    if (session.stage !== 'turn' || !session.activeTurn?.endsAt) {
      setSecondsRemaining(0);
      return undefined;
    }

    const tick = () => {
      const remaining = getCountdownSeconds(session.activeTurn.endsAt);
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        applyAction({ type: 'end-turn' });
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [applyAction, session.activeTurn?.endsAt, session.stage]);

  if (session.stage === 'turn') {
    const currentWord =
      session.activeTurn?.wordQueue[session.activeTurn?.queueIndex] ?? 'Loading';

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">Live turn</p>
            <h2>{context.activeDescriberName} is describing</h2>
            <p>Keep the phone with the describer while the team guesses out loud.</p>
          </div>

          <div className="turn-hero">
            <div className="turn-hero__clock">
              <span className="helper-text">Time left</span>
              <strong>{formatCountdown(secondsRemaining)}</strong>
            </div>
            <div className="turn-hero__score">
              <span className="helper-text">Category</span>
              <strong>{session.activeTurn?.category ?? 'Mixed deck'}</strong>
            </div>
          </div>

          <div className="role-card">
            <span className="helper-text">Current word</span>
            <strong className="role-card__title">{currentWord}</strong>
            <span className="role-card__body">
              Score it when they get it, or skip and take the penalty.
            </span>
          </div>

          <SummaryChips
            items={[
              { label: 'Team', value: context.activeTeam?.name ?? 'Team' },
              { label: 'Score', value: session.activeTurn?.score ?? 0 },
              {
                label: 'Free skips',
                value: session.activeTurn?.freeSkipsRemaining ?? 0
              }
            ]}
          />

          <div className="actions actions--stretch">
            <button onClick={() => applyAction({ type: 'mark-correct' })}>Correct</button>
            <button
              className="secondary-action"
              onClick={() => applyAction({ type: 'skip-word' })}
            >
              Skip
            </button>
            <button
              className="secondary-action"
              onClick={() => applyAction({ type: 'end-turn' })}
            >
              End turn
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (session.stage === 'results') {
    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">Match complete</p>
            <h2>{session.results?.isTie ? 'Tie game' : 'Final leaderboard'}</h2>
            <p>
              {session.results?.isTie
                ? 'Two or more teams finished level on points.'
                : `${session.results?.leaderboard?.[0]?.teamName ?? 'A team'} finished on top.`}
            </p>
          </div>

          <LeaderboardList
            leaderboard={session.results?.leaderboard ?? []}
            winnerTeamIds={session.results?.winnerTeamIds ?? []}
          />

          <ResultsActions
            busyAction={busyAction}
            onPlayAgain={onPlayAgain}
            onResetSetup={onResetSetup}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">Between turns</p>
          <h2>{context.activeTeam?.name ?? 'Next team'} are up next</h2>
          <p>{context.activeDescriberName} is the current describer for this turn.</p>
        </div>

        <SummaryChips
          items={[
            {
              label: 'Round',
              value: `${session.roundNumber} / ${session.settings.totalRounds}`
            },
            { label: 'Describer', value: context.activeDescriberName },
            {
              label: 'Turn length',
              value: `${session.settings.turnDurationSeconds}s`
            }
          ]}
        />

        <HandoffPanel
          pill="Pass to describer"
          title={`Give the phone to ${context.activeDescriberName}`}
          description={`${
            context.activeTeam?.name ?? 'The next team'
          } should be ready to guess before the clock starts.`}
          isRevealed={handoffVisible}
          onReveal={() => setHandoffVisible(true)}
          onHide={() => setHandoffVisible(false)}
          footer={
            handoffVisible ? (
              <button disabled={busyAction === 'start-turn'} onClick={onStartTurn}>
                {busyAction === 'start-turn' ? 'Loading words' : 'Start turn'}
              </button>
            ) : null
          }
        >
          <div className="notice-card notice-card--focus">
            <strong>{context.activeTeam?.name ?? 'Next team'} are live when you start.</strong>
            <p>The timer starts with the first word.</p>
          </div>
        </HandoffPanel>
      </section>

      <TeamScoreboard teams={teamRosters} activeTeamId={context.activeTeamId}>
        <TurnSummaryPanel summary={session.lastTurnSummary} />
      </TeamScoreboard>
    </div>
  );
}

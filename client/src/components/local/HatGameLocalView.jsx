import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioCues } from '../../audio/AudioCueContext';
import { useStageCue, useTimedTurnAudio } from '../../audio/useGameAudio';
import {
  getHatGamePhaseCueName,
  getHatGamePhaseTone
} from '../../games/hatGamePresentation';
import { formatCountdown, getCountdownSeconds } from '../../games/timedTurns';
import {
  getHatGamePhaseMeta,
  getWhoWhatWhereContext
} from '../../local/session';
import {
  LeaderboardList,
  SummaryChips,
  TeamScoreboard,
  TurnSummaryPanel
} from '../gameplay/SharedGameUi';
import {
  HandoffPanel,
  ResultsActions
} from './common';
import { buildWhoWhatWhereRosters } from './helpers';

export function HatGameLocalView({
  session,
  applyAction,
  busyAction,
  onStartTurn,
  onPlayAgain,
  onResetSetup
}) {
  const { playCue } = useAudioCues();
  const [handoffVisible, setHandoffVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getCountdownSeconds(session.activeTurn?.endsAt)
  );
  const context = getWhoWhatWhereContext(session);
  const phaseMeta = getHatGamePhaseMeta(session.phaseNumber);
  const teamRosters = useMemo(
    () => buildWhoWhatWhereRosters(session.players, session.teams),
    [session.players, session.teams]
  );
  const previousPhaseRef = useRef(session.phaseNumber);
  const phaseTone = getHatGamePhaseTone(session.phaseNumber);

  useTimedTurnAudio({
    active: session.stage === 'turn',
    turnKey: `${session.phaseNumber}:${session.roundNumber}:${context.activeTeamId}:${context.activeDescriberId}`,
    endsAt: session.activeTurn?.endsAt
  });
  useStageCue(session.stage, {
    results: 'results-reveal'
  });

  useEffect(() => {
    if (session.phaseNumber > previousPhaseRef.current && session.stage === 'turn') {
      playCue(getHatGamePhaseCueName(session.phaseNumber));
    }

    previousPhaseRef.current = session.phaseNumber;
  }, [playCue, session.phaseNumber, session.stage]);

  useEffect(() => {
    setHandoffVisible(false);
  }, [session.stage, session.phaseNumber, session.roundNumber, session.teamIndex]);

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
    const currentClue =
      session.activeTurn?.clueQueue[session.activeTurn?.queueIndex]?.text ?? 'Loading';

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">
              Phase {session.phaseNumber}: {phaseMeta.name}
            </p>
            <h2>{context.activeDescriberName} is describing</h2>
            <p>{phaseMeta.instruction}</p>
          </div>

          <div className="turn-hero">
            <div className="turn-hero__clock">
              <span className="helper-text">Time left</span>
              <strong>{formatCountdown(secondsRemaining)}</strong>
            </div>
            <div className="turn-hero__score">
              <span className="helper-text">Skips left</span>
              <strong>{session.activeTurn?.skipsRemaining ?? 0}</strong>
            </div>
          </div>

          <div className="notice-card notice-card--focus">
            <strong>Current rule</strong>
            <p>{phaseMeta.instruction}</p>
          </div>

          <div className={`role-card role-card--word role-card--word-${phaseTone}`}>
            <span className="helper-text">Current clue</span>
            <strong className="role-card__title">{currentClue}</strong>
            <span className="role-card__body">Keep the clue visible only for the describer.</span>
          </div>

          <SummaryChips
            items={[
              { label: 'Team', value: context.activeTeam?.name ?? 'Team' },
              { label: 'Score', value: session.activeTurn?.score ?? 0 },
              { label: 'Correct', value: session.activeTurn?.correctCount ?? 0 }
            ]}
          />

          {session.activeTurn?.skippedCluePoolIndex !== null && (
            <div className="notice-card notice-card--focus">
              <strong>Skipped clue waiting</strong>
              <p>
                {session.activeTurn?.skippedClueText ??
                  'Bring the skipped clue back before using another skip.'}
              </p>
              <div className="actions">
                <button
                  className="secondary-action"
                  onClick={() => applyAction({ type: 'return-skipped-clue' })}
                >
                  Go back to skipped clue
                </button>
              </div>
            </div>
          )}

          <div className="actions actions--stretch">
            <button onClick={() => applyAction({ type: 'mark-correct' })}>Correct</button>
            <button
              className="secondary-action"
              disabled={
                session.activeTurn?.skippedCluePoolIndex !== null ||
                session.activeTurn?.skipsRemaining <= 0
              }
              onClick={() => applyAction({ type: 'skip-clue' })}
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
            <p className="status-pill">HatGame complete</p>
            <h2>{session.results?.isTie ? 'Tie game' : 'Final leaderboard'}</h2>
            <p>All three phases are complete and the shared clue pool is finished.</p>
          </div>

          <SummaryChips
            items={[
              { label: 'Teams', value: session.teams.length },
              { label: 'Clues', value: session.results?.totalClues ?? 0 },
              { label: 'Players', value: session.players.length }
            ]}
          />

          {session.results?.bestTurn ? (
            <div className="notice-card notice-card--focus">
              <strong>Best turn</strong>
              <p>
                {session.results.bestTurn.describerName} scored {session.results.bestTurn.score}{' '}
                for {session.results.bestTurn.teamName}.
              </p>
            </div>
          ) : null}

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
          <p className="status-pill">
            Phase {session.phaseNumber}: {phaseMeta.name}
          </p>
          <h2>{context.activeTeam?.name ?? 'Next team'} are up next</h2>
          <p>{context.activeDescriberName} is the describer for this turn.</p>
        </div>

        <SummaryChips
          items={[
            { label: 'Rule', value: phaseMeta.name },
            { label: 'Describer', value: context.activeDescriberName },
            {
              label: 'Turn length',
              value: `${session.settings.turnDurationSeconds}s`
            }
          ]}
        />

        <div className="notice-card notice-card--focus">
          <strong>Current phase rule</strong>
          <p>{phaseMeta.instruction}</p>
        </div>

        {session.lastTurnSummary?.phaseCompleted && (
          <div className="notice-card notice-card--focus">
            <strong>Phase {session.lastTurnSummary.completedPhaseNumber} complete</strong>
            <p>
              {session.lastTurnSummary.nextPhaseName
                ? `Next phase: ${session.lastTurnSummary.nextPhaseName}. Same clues, tougher rule.`
                : 'That was the final phase.'}
            </p>
          </div>
        )}

        <HandoffPanel
          pill="Pass to describer"
          title={`Give the phone to ${context.activeDescriberName}`}
          targetName={context.activeDescriberName}
          description={`${
            context.activeTeam?.name ?? 'The next team'
          } should be ready to guess before the clock starts.`}
          isRevealed={handoffVisible}
          onReveal={() => setHandoffVisible(true)}
          onHide={() => setHandoffVisible(false)}
          revealLabel="Describer ready"
          footer={
            handoffVisible ? (
              <button disabled={busyAction === 'start-turn'} onClick={onStartTurn}>
                Start turn
              </button>
            ) : null
          }
        >
          <div className="notice-card">
            <strong>Same clue pool, new rule</strong>
            <p>{phaseMeta.instruction}</p>
          </div>
        </HandoffPanel>
      </section>

      <TeamScoreboard
        summary={
          session.stage === 'turn'
            ? `${context.activeTeam?.name ?? 'Active team'} up`
            : `Phase ${session.phaseNumber}`
        }
        teams={teamRosters}
        activeTeamId={context.activeTeamId}
      >
        <TurnSummaryPanel summary={session.lastTurnSummary} />
      </TeamScoreboard>
    </div>
  );
}

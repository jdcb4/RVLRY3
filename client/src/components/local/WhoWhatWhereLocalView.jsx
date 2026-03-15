import { useEffect, useMemo, useState } from 'react';
import { useAudioCues } from '../../audio/AudioCueContext';
import { useStageCue, useTimedTurnAudio } from '../../audio/useGameAudio';
import { formatCountdown, getCountdownSeconds } from '../../games/timedTurns';
import { getWhoWhatWhereContext } from '../../local/session';
import {
  LeaderboardList,
  SummaryChips,
  TeamScoreboard,
  TurnSummaryPanel
} from '../gameplay/SharedGameUi';
import { XIcon } from '../Icons';
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
  const { playCue } = useAudioCues();
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
      session.activeTurn?.currentWordSource === 'skipped'
        ? session.activeTurn?.currentSkippedWord?.word ?? 'Loading'
        : session.activeTurn?.wordQueue[session.activeTurn?.queueIndex] ?? 'Loading';

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="turn-panel__topbar">
            <div className="panel-heading">
              <h2>{context.activeTeam?.name ?? 'Team'} up</h2>
            </div>
            <button
              type="button"
              className="icon-button icon-button--subtle"
              aria-label="End turn"
              onClick={() => applyAction({ type: 'end-turn' })}
            >
              <XIcon />
            </button>
          </div>

          <div className="role-card role-card--word role-card--word-guessing">
            <span className="helper-text">Current word</span>
            <strong className="role-card__title">{currentWord}</strong>
          </div>

          <div className="turn-hero turn-hero--compact">
            <div className="turn-hero__clock">
              <span className="helper-text">Time left</span>
              <strong>{formatCountdown(secondsRemaining)}</strong>
            </div>
            <div className="turn-hero__score">
              <span className="helper-text">Category</span>
              <strong>{session.activeTurn?.category ?? 'Mixed deck'}</strong>
            </div>
          </div>

          <SummaryChips
            items={[
              { label: 'Score', value: session.activeTurn?.score ?? 0 },
              {
                label: 'Skipped waiting',
                value: session.activeTurn?.skippedWords?.length ?? 0
              }
            ]}
          />

          {session.activeTurn?.skippedWords?.length > 0 ? (
            <div className="notice-card notice-card--focus">
              <strong>
                {session.activeTurn?.currentWordSource === 'skipped'
                  ? 'Back on skipped words'
                  : 'Skipped words waiting'}
              </strong>
              <p>
                {session.activeTurn?.currentWordSource === 'skipped'
                  ? 'Finish this returned word or send it to the back of the skipped queue.'
                  : `${session.activeTurn.skippedWords.length} word(s) are waiting to come back.`}
              </p>
              {session.activeTurn?.currentWordSource !== 'skipped' ? (
                <div className="actions">
                  <button
                    className="secondary-action"
                    onClick={() => applyAction({ type: 'return-skipped-word' })}
                  >
                    Return to skipped word
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="turn-action-dock">
            <button
              className="secondary-action"
              onClick={async () => {
                await playCue('skip');
                applyAction({ type: 'skip-word' });
              }}
            >
              Skip
            </button>
            <button
              onClick={async () => {
                await playCue('correct');
                applyAction({ type: 'mark-correct' });
              }}
            >
              Correct
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
          <h2>{context.activeTeam?.name ?? 'Next team'} up next</h2>
        </div>

        <HandoffPanel
          pill="Pass to describer"
          title={`Give the phone to ${context.activeDescriberName}`}
          targetName={context.activeDescriberName}
          description={`${context.activeTeam?.name ?? 'The next team'} guesses when the timer starts.`}
          isRevealed={handoffVisible}
          onReveal={() => setHandoffVisible(true)}
          onHide={() => setHandoffVisible(false)}
          revealLabel="Describer ready"
          showHideButton={false}
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
          </div>
        </HandoffPanel>
      </section>

      <TeamScoreboard
        summary={context.activeTeam?.name ? `${context.activeTeam.name} up` : `${teamRosters.length} teams`}
        teams={teamRosters}
        activeTeamId={context.activeTeamId}
      >
        <TurnSummaryPanel summary={session.lastTurnSummary} />
      </TeamScoreboard>
    </div>
  );
}

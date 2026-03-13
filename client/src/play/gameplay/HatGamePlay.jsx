import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioCues } from '../../audio/AudioCueContext';
import { useStageCue, useTimedTurnAudio } from '../../audio/useGameAudio';
import {
  LeaderboardList,
  SummaryChips,
  TeamScoreboard,
  TurnSummaryPanel
} from '../../components/gameplay/SharedGameUi';
import { formatCountdown, getCountdownSeconds } from '../../games/timedTurns';
import { buildTeamRosters, EMPTY_TEAMS, getTeamById } from './helpers';
import {
  ResultsActions
} from './common';

export function HatGamePlay({
  roomCode,
  roomState,
  privateState,
  playerId,
  isHost,
  pendingAction,
  sendGameAction,
  returnRoomToLobby
}) {
  const { playCue } = useAudioCues();
  const publicState = roomState.gamePublicState;
  const stage = publicState?.stage;
  const results = publicState?.results;
  const turn = publicState?.turn;
  const teams = roomState.teams ?? EMPTY_TEAMS;
  const teamRosters = useMemo(() => buildTeamRosters(teams, roomState.players), [roomState.players, teams]);
  const activeTeam = getTeamById(teams, publicState.activeTeamId);
  const myTeam = getTeamById(teams, privateState?.teamId);
  const [secondsRemaining, setSecondsRemaining] = useState(() => getCountdownSeconds(turn?.endsAt));
  const autoEndRef = useRef('');
  const previousPhaseRef = useRef(publicState?.phaseNumber ?? 1);

  useTimedTurnAudio({
    active: stage === 'turn',
    turnKey: `${publicState.phaseNumber}:${publicState.roundNumber}:${publicState.activeTeamId}:${publicState.activeDescriberId}`,
    endsAt: turn?.endsAt
  });
  useStageCue(stage, {
    'game-over': 'results-reveal'
  });

  useEffect(() => {
    const phaseNumber = publicState?.phaseNumber ?? 1;
    if (phaseNumber > previousPhaseRef.current) {
      playCue('phase-change');
    }

    previousPhaseRef.current = phaseNumber;
  }, [playCue, publicState?.phaseNumber]);

  useEffect(() => {
    if (stage !== 'turn' || !turn?.endsAt) {
      setSecondsRemaining(0);
      autoEndRef.current = '';
      return undefined;
    }

    const tick = () => {
      const remaining = getCountdownSeconds(turn.endsAt);
      setSecondsRemaining(remaining);

      const canForceSync = playerId === publicState.activeDescriberId || isHost;
      if (remaining <= 0 && canForceSync && autoEndRef.current !== turn.endsAt) {
        autoEndRef.current = turn.endsAt;
        sendGameAction(roomCode, 'end-turn');
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [
    isHost,
    playerId,
    publicState.activeDescriberId,
    roomCode,
    sendGameAction,
    stage,
    turn?.endsAt
  ]);

  if (stage === 'turn') {
    if (privateState?.isDescriber) {
      return (
        <div className="gameplay-stack">
          <section className="panel panel--hero panel--stacked gameplay-primary">
            <div className="panel-heading">
              <p className="status-pill">
                Phase {publicState.phaseNumber}: {publicState.phaseName}
              </p>
              <h2>You are describing</h2>
              <p>{publicState.phaseInstruction}</p>
            </div>

            <div className="turn-hero">
              <div className="turn-hero__clock">
                <span className="helper-text">Time left</span>
                <strong>{formatCountdown(secondsRemaining)}</strong>
              </div>
              <div className="turn-hero__score">
                <span className="helper-text">Skips left</span>
                <strong>{privateState?.skipsRemaining ?? turn?.skipsRemaining ?? 0}</strong>
              </div>
            </div>

            <div className="role-card">
              <span className="helper-text">Current clue</span>
              <strong className="role-card__title">{privateState?.clue ?? 'Loading next clue'}</strong>
              <span className="role-card__body">
                {privateState?.skippedCluePending
                  ? 'A skipped clue must come back before you can skip again.'
                  : publicState.phaseInstruction}
              </span>
            </div>

            <SummaryChips
              items={[
                { label: 'Team', value: activeTeam?.name ?? 'Team' },
                { label: 'Turn score', value: turn?.score ?? 0 },
                { label: 'Correct', value: turn?.correctCount ?? 0 }
              ]}
            />

            {privateState?.skippedCluePending && (
              <div className="notice-card notice-card--focus">
                <strong>Skip is locked</strong>
                <p>Finish the skipped clue before skipping again.</p>
              </div>
            )}

            <div className="actions actions--stretch">
              <button disabled={pendingAction === 'mark-correct'} onClick={() => sendGameAction(roomCode, 'mark-correct')}>
                Correct
              </button>
              <button
                className="secondary-action"
                disabled={pendingAction === 'skip-clue' || !privateState?.canSkip}
                onClick={() => sendGameAction(roomCode, 'skip-clue')}
              >
                Skip
              </button>
              <button
                className="secondary-action"
                disabled={pendingAction === 'end-turn'}
                onClick={() => sendGameAction(roomCode, 'end-turn')}
              >
                End turn
              </button>
            </div>
          </section>
        </div>
      );
    }

    if (privateState?.isActiveTeam) {
      return (
        <div className="gameplay-stack">
          <section className="panel panel--hero panel--stacked gameplay-primary">
            <div className="panel-heading">
              <p className="status-pill">
                Phase {publicState.phaseNumber}: {publicState.phaseName}
              </p>
              <h2>You are guessing</h2>
              <p>{publicState.activeDescriberName} is describing for {activeTeam?.name ?? 'your team'}.</p>
            </div>

            <div className="turn-hero">
              <div className="turn-hero__clock">
                <span className="helper-text">Time left</span>
                <strong>{formatCountdown(secondsRemaining)}</strong>
              </div>
              <div className="turn-hero__score">
                <span className="helper-text">Rule</span>
                <strong>{publicState.phaseName}</strong>
              </div>
            </div>

            <div className="notice-card notice-card--focus">
              <strong>Keep calling names out loud</strong>
              <p>{publicState.phaseInstruction}</p>
            </div>

            {turn?.skippedCluePending && (
              <div className="notice-card">
                <strong>A skipped clue is still waiting</strong>
                <p>The describer cannot skip again yet.</p>
              </div>
            )}
          </section>
        </div>
      );
    }

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">
              Phase {publicState.phaseNumber}: {publicState.phaseName}
            </p>
            <h2>You are waiting</h2>
            <p>{publicState.activeDescriberName} is describing for {activeTeam?.name ?? 'the active team'}.</p>
          </div>

          <div className="turn-hero">
            <div className="turn-hero__clock">
              <span className="helper-text">Time left</span>
              <strong>{formatCountdown(secondsRemaining)}</strong>
            </div>
            <div className="turn-hero__score">
              <span className="helper-text">Rule</span>
              <strong>{publicState.phaseName}</strong>
            </div>
          </div>

          <div className="notice-card">
            <strong>Watch the round and stay ready</strong>
            <p>{publicState.phaseInstruction}</p>
          </div>
        </section>
      </div>
    );
  }

  if (stage === 'game-over') {
    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">HatGame complete</p>
            <h2>{results?.isTie ? 'Tie game' : 'Final leaderboard'}</h2>
            <p>
              {results?.isTie
                ? 'Multiple teams finished level after all three phases.'
                : `${getTeamById(teams, results?.winnerTeamIds?.[0])?.name ?? 'Winner'} finished on top.`}
            </p>
          </div>

          <SummaryChips
            items={[
              { label: 'Phases', value: 3 },
              { label: 'Teams', value: teams.length },
              { label: 'Clues', value: results?.totalClues ?? 0 }
            ]}
          />

          <LeaderboardList
            leaderboard={results?.leaderboard ?? []}
            winnerTeamIds={results?.winnerTeamIds ?? []}
          />

          <ResultsActions
            isHost={isHost}
            roomCode={roomCode}
            onReturnToLobby={returnRoomToLobby}
            pendingAction={pendingAction}
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
            Phase {publicState.phaseNumber}: {publicState.phaseName}
          </p>
          <h2>{privateState?.canStartTurn ? 'Your team is up' : 'Next team up'}</h2>
          <p>
            {activeTeam?.name ?? 'Next team'} will go next, with {publicState.activeDescriberName} describing.
          </p>
        </div>

        <SummaryChips
          items={[
            { label: 'Phase', value: publicState.phaseName ?? 'Describe' },
            { label: 'Next team', value: activeTeam?.name ?? 'Waiting' },
            { label: 'Describer', value: publicState.activeDescriberName ?? 'Waiting' }
          ]}
        />

        <div className="notice-card notice-card--focus">
          <strong>Current rule</strong>
          <p>{publicState.phaseInstruction}</p>
        </div>

        {publicState.lastTurnSummary?.phaseCompleted && (
          <div className="notice-card notice-card--focus">
            <strong>Phase {publicState.lastTurnSummary.completedPhaseNumber} complete</strong>
            <p>
              {publicState.lastTurnSummary.nextPhaseName
                ? `Next up: ${publicState.lastTurnSummary.nextPhaseName}. Same clues, tighter rules.`
                : 'That was the final phase.'}
            </p>
          </div>
        )}

        {privateState?.canStartTurn ? (
          <div className="field-stack">
            <div className="notice-card">
              <strong>Get your team ready</strong>
              <p>Start only when your team is listening and the describer has the device.</p>
            </div>
            <button disabled={pendingAction === 'start-turn'} onClick={() => sendGameAction(roomCode, 'start-turn')}>
              Start turn
            </button>
          </div>
        ) : privateState?.isActiveTeam ? (
          <div className="notice-card">
            <strong>Your team is on deck</strong>
            <p>Stay close for the next clue.</p>
          </div>
        ) : (
          <div className="notice-card">
            <strong>{activeTeam?.name ?? 'The next team'} is preparing</strong>
            <p>You are waiting until it is {myTeam?.name ?? 'your'} team&apos;s turn.</p>
          </div>
        )}
      </section>

      <TeamScoreboard
        description="Scores and phase progress stay here."
        teams={teamRosters}
        activeTeamId={publicState.activeTeamId}
      >
        <TurnSummaryPanel
          summary={publicState.lastTurnSummary}
          entries={publicState.lastTurnSummary?.clues ?? []}
          getEntryKey={(entry, index) => `${entry.clue}-${index}`}
          getEntryLabel={(entry) => entry.clue}
        />
      </TeamScoreboard>
    </div>
  );
}

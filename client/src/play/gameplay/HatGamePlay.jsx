import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioCues } from '../../audio/AudioCueContext';
import { useStageCue, useTimedTurnAudio } from '../../audio/useGameAudio';
import { InfoPopover } from '../../components/InfoPopover';
import {
  LeaderboardList,
  SummaryChips,
  TeamScoreboard,
  TeamTurnOrder,
  TurnSummaryPanel
} from '../../components/gameplay/SharedGameUi';
import {
  getHatGamePhaseCueName,
  getHatGamePhaseTone
} from '../../games/hatGamePresentation';
import { formatCountdown, getCountdownSeconds } from '../../games/timedTurns';
import { buildActiveTeamOrder, buildTeamRosters, EMPTY_TEAMS, getTeamById } from './helpers';
import { ResultsActions } from './common';

function PhaseRuleCard({ phaseName, phaseInstruction }) {
  return (
    <div className="turn-hero__score">
      <div className="stat-card__topline">
        <span className="helper-text">Rule</span>
        <InfoPopover
          align="left"
          label={`What does ${phaseName} mean?`}
          title={phaseName}
        >
          <p>{phaseInstruction}</p>
        </InfoPopover>
      </div>
      <strong className="stat-card__value">{phaseName}</strong>
    </div>
  );
}

function RoleStatusCard({ title, description }) {
  return (
    <div className="role-card">
      <span className="helper-text">Role</span>
      <strong className="role-card__title">{title}</strong>
      <span className="role-card__body">{description}</span>
    </div>
  );
}

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
  const teamRosters = useMemo(
    () => buildTeamRosters(teams, roomState.players),
    [roomState.players, teams]
  );
  const activeTeam = getTeamById(teams, publicState.activeTeamId);
  const activeTeamOrder = useMemo(
    () => buildActiveTeamOrder(teamRosters, publicState.activeTeamId),
    [publicState.activeTeamId, teamRosters]
  );
  const phaseTone = getHatGamePhaseTone(publicState?.phaseNumber);
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    getCountdownSeconds(turn?.endsAt)
  );
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
    if (phaseNumber > previousPhaseRef.current && stage === 'turn') {
      playCue(getHatGamePhaseCueName(phaseNumber));
    }

    previousPhaseRef.current = phaseNumber;
  }, [playCue, publicState?.phaseNumber, stage]);

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
              <h2>You are describing</h2>
              <p>Your team is live.</p>
            </div>

            <div className="turn-hero">
              <div className="turn-hero__clock">
                <span className="helper-text">Time left</span>
                <strong>{formatCountdown(secondsRemaining)}</strong>
              </div>
              <PhaseRuleCard
                phaseName={publicState.phaseName}
                phaseInstruction={publicState.phaseInstruction}
              />
            </div>

            <div className={`role-card role-card--word role-card--word-${phaseTone}`}>
              <span className="helper-text">Current clue</span>
              <strong className="role-card__title">{privateState?.clue ?? 'Loading next clue'}</strong>
              <span className="role-card__body">Keep the clue on screen and score it fast.</span>
            </div>

            <SummaryChips
              items={[
                { label: 'Team', value: activeTeam?.name ?? 'Team' },
                { label: 'Turn score', value: turn?.score ?? 0 },
                { label: 'Skips left', value: privateState?.skipsRemaining ?? turn?.skipsRemaining ?? 0 }
              ]}
            />

            {privateState?.showingSkippedClue || (privateState?.pendingSkippedCount ?? 0) > 0 ? (
              <div className="notice-card notice-card--focus">
                <strong>{privateState?.showingSkippedClue ? 'Working through skipped clues' : 'Skipped clues waiting'}</strong>
                <p>
                  {privateState?.showingSkippedClue
                    ? 'The current clue came from your skipped list. You can also jump to another waiting clue.'
                    : `${privateState?.pendingSkippedCount ?? 0} skipped clue(s) are waiting. Choose any one to return.`}
                </p>
                <div className="actions">
                  {(privateState?.skippedClues ?? []).map((entry) => (
                    <button
                      key={entry.poolIndex}
                      className="secondary-action"
                      disabled={pendingAction === 'return-skipped-clue' || !privateState?.canReturnSkippedClue}
                      onClick={() =>
                        sendGameAction(roomCode, 'return-skipped-clue', {
                          poolIndex: entry.poolIndex
                        })
                      }
                    >
                      {entry.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="actions actions--stretch">
              <button
                disabled={pendingAction === 'mark-correct'}
                onClick={() => sendGameAction(roomCode, 'mark-correct')}
              >
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
              <h2>Your team is live</h2>
              <p>{publicState.activeDescriberName} is describing for your team.</p>
            </div>

            <div className="turn-hero">
              <div className="turn-hero__clock">
                <span className="helper-text">Time left</span>
                <strong>{formatCountdown(secondsRemaining)}</strong>
              </div>
              <PhaseRuleCard
                phaseName={publicState.phaseName}
                phaseInstruction={publicState.phaseInstruction}
              />
            </div>

            <RoleStatusCard
              title="Guessing"
              description="Call names out loud while the describer keeps the cards moving."
            />

            {turn?.showingSkippedClue || (turn?.pendingSkippedCount ?? 0) > 0 ? (
              <div className="notice-card">
                <strong>{turn?.showingSkippedClue ? 'Working through skipped clues' : 'Skipped clues waiting'}</strong>
                <p>
                  {turn?.showingSkippedClue
                    ? 'Your team is back on the earlier skipped clue.'
                    : `${turn?.pendingSkippedCount ?? 0} skipped clue(s) are still waiting to come back.`}
                </p>
              </div>
            ) : null}
          </section>
        </div>
      );
    }

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <h2>Wait for your team</h2>
            <p>{publicState.activeDescriberName} is describing for {activeTeam?.name ?? 'the active team'}.</p>
          </div>

          <div className="turn-hero">
            <div className="turn-hero__clock">
              <span className="helper-text">Time left</span>
              <strong>{formatCountdown(secondsRemaining)}</strong>
            </div>
            <PhaseRuleCard
              phaseName={publicState.phaseName}
              phaseInstruction={publicState.phaseInstruction}
            />
          </div>

          <TeamTurnOrder
            teams={activeTeamOrder}
            activeTeamId={publicState.activeTeamId}
            activeDescriberName={publicState.activeDescriberName}
          />
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

          {results?.bestTurn ? (
            <div className="notice-card notice-card--focus">
              <strong>Best turn</strong>
              <p>
                {results.bestTurn.describerName} scored {results.bestTurn.score} for{' '}
                {results.bestTurn.teamName}.
              </p>
            </div>
          ) : null}

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
          <h2>{privateState?.isActiveTeam ? "You're up now" : 'Next team up'}</h2>
          <p>
            {privateState?.canStartTurn
              ? `Start when ${publicState.activeDescriberName} has the phone and the team is listening.`
              : privateState?.isActiveTeam
                ? `Waiting for ${publicState.activeDescriberName} to start the turn.`
                : `${activeTeam?.name ?? 'Next team'} will go next, with ${publicState.activeDescriberName} describing.`}
          </p>
        </div>

        <div className="turn-hero">
          <div className="turn-hero__clock">
            <span className="helper-text">Turn length</span>
            <strong>{roomState.settings?.turnDurationSeconds ?? 45}s</strong>
          </div>
          <PhaseRuleCard
            phaseName={publicState.phaseName}
            phaseInstruction={publicState.phaseInstruction}
          />
        </div>

        <SummaryChips
          items={[
            { label: 'Next team', value: activeTeam?.name ?? 'Waiting' },
            { label: 'Describer', value: publicState.activeDescriberName ?? 'Waiting' }
          ]}
        />

        {publicState.lastTurnSummary?.phaseCompleted ? (
          <div className="notice-card notice-card--focus">
            <strong>Phase {publicState.lastTurnSummary.completedPhaseNumber} complete</strong>
            <p>
              {publicState.lastTurnSummary.nextPhaseName
                ? `Next up: ${publicState.lastTurnSummary.nextPhaseName}. Same clues, tighter rules.`
                : 'That was the final phase.'}
            </p>
          </div>
        ) : null}

        {privateState?.canStartTurn ? (
          <div className="field-stack">
            <div className="notice-card">
              <strong>Get your team ready</strong>
              <p>Start when the describer has the phone and the guessers are listening.</p>
            </div>
            <button
              disabled={pendingAction === 'start-turn'}
              onClick={() => sendGameAction(roomCode, 'start-turn')}
            >
              Start turn
            </button>
          </div>
        ) : privateState?.isActiveTeam ? (
          <RoleStatusCard
            title="Guessing"
            description={`Waiting for ${publicState.activeDescriberName} to start the turn.`}
          />
        ) : (
          <TeamTurnOrder
            teams={activeTeamOrder}
            activeTeamId={publicState.activeTeamId}
            activeDescriberName={publicState.activeDescriberName}
          />
        )}
      </section>

      <TeamScoreboard
        summary={
          stage === 'turn'
            ? `${activeTeam?.name ?? 'Active team'} up`
            : `Phase ${publicState.phaseNumber}`
        }
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStageCue, useTimedTurnAudio } from '../../audio/useGameAudio';
import {
  LeaderboardList,
  SummaryChips,
  TeamScoreboard,
  TeamTurnOrder,
  TurnSummaryPanel
} from '../../components/gameplay/SharedGameUi';
import { formatCountdown, getCountdownSeconds } from '../../games/timedTurns';
import { buildActiveTeamOrder, buildTeamRosters, EMPTY_TEAMS, getTeamById } from './helpers';
import {
  ResultsActions
} from './common';

export function WhoWhatWherePlay({
  roomCode,
  roomState,
  privateState,
  playerId,
  isHost,
  pendingAction,
  sendGameAction,
  returnRoomToLobby
}) {
  const publicState = roomState.gamePublicState;
  const stage = publicState?.stage;
  const results = publicState?.results;
  const turn = publicState?.turn;
  const teams = roomState.teams ?? EMPTY_TEAMS;
  const teamRosters = useMemo(() => buildTeamRosters(teams, roomState.players), [roomState.players, teams]);
  const activeTeamOrder = useMemo(
    () => buildActiveTeamOrder(teamRosters, publicState.activeTeamId),
    [publicState.activeTeamId, teamRosters]
  );
  const activeTeam = getTeamById(teams, publicState.activeTeamId);
  const [secondsRemaining, setSecondsRemaining] = useState(() => getCountdownSeconds(turn?.endsAt));
  const autoEndRef = useRef('');

  useTimedTurnAudio({
    active: stage === 'turn',
    turnKey: `${publicState.roundNumber}:${publicState.activeTeamId}:${publicState.activeDescriberId}`,
    endsAt: turn?.endsAt
  });
  useStageCue(stage, {
    'game-over': 'results-reveal'
  });

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
              <p className="status-pill">Describing</p>
              <h2>You are describing</h2>
              <p>{activeTeam?.name ?? 'Your team'} is live. Speak and keep the round moving.</p>
            </div>

            <div className="turn-hero">
              <div className="turn-hero__clock">
                <span className="helper-text">Time left</span>
                <strong>{formatCountdown(secondsRemaining)}</strong>
              </div>
              <div className="turn-hero__score">
                <span className="helper-text">Category</span>
                <strong>{privateState?.category ?? turn?.category ?? 'Loading'}</strong>
              </div>
            </div>

            <div className="role-card">
              <span className="helper-text">Current word</span>
              <strong className="role-card__title">{privateState.word ?? 'Loading next word'}</strong>
              <span className="role-card__body">
                No spelling or rhyming. Tap as soon as your team gets it.
              </span>
            </div>

            <SummaryChips
              items={[
                { label: 'Turn score', value: turn?.score ?? 0 },
                { label: 'Correct', value: turn?.correctCount ?? 0 },
                { label: 'Free skips', value: turn?.freeSkipsRemaining ?? 0 }
              ]}
            />

            <div className="actions actions--stretch">
              <button disabled={pendingAction === 'mark-correct'} onClick={() => sendGameAction(roomCode, 'mark-correct')}>
                Correct
              </button>
              <button
                className="secondary-action"
                disabled={pendingAction === 'skip-word'}
                onClick={() => sendGameAction(roomCode, 'skip-word')}
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
              <p className="status-pill">{activeTeam?.name ?? 'Your team'} turn</p>
              <h2>You are guessing</h2>
              <p>{publicState.activeDescriberName} is describing. Call answers out loud.</p>
            </div>

            <div className="turn-hero">
              <div className="turn-hero__clock">
                <span className="helper-text">Time left</span>
                <strong>{formatCountdown(secondsRemaining)}</strong>
              </div>
              <div className="turn-hero__score">
                <span className="helper-text">Category</span>
                <strong>{turn?.category ?? 'Loading'}</strong>
              </div>
            </div>

            <div className="notice-card notice-card--focus">
              <strong>Keep guessing</strong>
              <p>Only the describer sees the word.</p>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
            <div className="panel-heading">
              <p className="status-pill">{activeTeam?.name ?? 'Other team'} turn</p>
              <h2>You are waiting</h2>
              <p>{publicState.activeDescriberName} is describing for {activeTeam?.name ?? 'the active team'}.</p>
          </div>

          <div className="turn-hero">
            <div className="turn-hero__clock">
              <span className="helper-text">Time left</span>
              <strong>{formatCountdown(secondsRemaining)}</strong>
            </div>
            <div className="turn-hero__score">
              <span className="helper-text">Category</span>
              <strong>{turn?.category ?? 'Loading'}</strong>
            </div>
          </div>

          <div className="notice-card">
            <strong>Wait for your team&apos;s turn</strong>
            <p>The word stays hidden until your turn.</p>
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
            <p className="status-pill">Match complete</p>
            <h2>{results?.isTie ? 'Tie game' : 'Final leaderboard'}</h2>
            <p>
              {results?.isTie
                ? 'Two or more teams finished level on points.'
                : `${getTeamById(teams, results?.winnerTeamIds?.[0])?.name ?? 'Winner'} finished on top.`}
            </p>
          </div>

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
          <p className="status-pill">Between turns</p>
          <h2>{privateState?.canStartTurn ? 'Your team is up' : 'Next team up'}</h2>
          <p>
            {activeTeam?.name ?? 'Next team'} will go next, with {publicState.activeDescriberName} describing.
          </p>
        </div>

        <SummaryChips
          items={[
            { label: 'Round', value: `${publicState.roundNumber} / ${publicState.totalRounds}` },
            { label: 'Next team', value: activeTeam?.name ?? 'Waiting' },
            { label: 'Describer', value: publicState.activeDescriberName ?? 'Waiting' }
          ]}
        />

        {privateState?.canStartTurn ? (
          <div className="field-stack">
            <div className="notice-card notice-card--focus">
              <strong>Get your team ready</strong>
              <p>Start when your team is set.</p>
            </div>
            <button disabled={pendingAction === 'start-turn'} onClick={() => sendGameAction(roomCode, 'start-turn')}>
              Start turn
            </button>
          </div>
        ) : privateState?.isActiveTeam ? (
          <div className="notice-card">
            <strong>Your team is on deck</strong>
            <p>Stay ready for the countdown.</p>
          </div>
        ) : (
          <TeamTurnOrder
            teams={activeTeamOrder}
            activeTeamId={publicState.activeTeamId}
            activeDescriberName={publicState.activeDescriberName}
          />
        )}
      </section>

      <TeamScoreboard
        summary={activeTeam?.name ? `${activeTeam.name} up` : `${teamRosters.length} teams`}
        teams={teamRosters}
        activeTeamId={publicState.activeTeamId}
      >
        <TurnSummaryPanel
          summary={publicState.lastTurnSummary}
          entries={publicState.lastTurnSummary?.words ?? []}
          getEntryKey={(entry, index) => `${entry.word}-${index}`}
          getEntryLabel={(entry) => entry.word}
        />
      </TeamScoreboard>
    </div>
  );
}

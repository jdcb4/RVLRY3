import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioCues } from '../audio/AudioCueContext';
import { useStageCue, useTimedTurnAudio } from '../audio/useGameAudio';
import { useNavigate, useParams } from 'react-router-dom';
import { usePlaySession } from './PlaySessionContext';

const EMPTY_TEAMS = [];

function ResultsActions({ isHost, roomCode, onReturnToLobby, pendingAction }) {
  if (!isHost) {
    return <p className="helper-text">The host can return the room to the lobby for another round.</p>;
  }

  return (
    <div className="actions actions--stretch">
      <button disabled={pendingAction === 'return-to-lobby'} onClick={() => onReturnToLobby(roomCode)}>
        Return to lobby
      </button>
    </div>
  );
}

function SummaryChips({ items }) {
  return (
    <div className="summary-chips">
      {items.filter(Boolean).map((item) => (
        <div key={`${item.label}-${item.value}`} className="summary-chip">
          <span className="summary-chip__label">{item.label}</span>
          <strong className="summary-chip__value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DisclosurePanel({ title, description, summary, defaultOpen = false, children }) {
  return (
    <details className="panel disclosure" open={defaultOpen}>
      <summary className="disclosure__summary">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {summary ? <span className="badge">{summary}</span> : null}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

const formatCountdown = (totalSeconds) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getCountdownSeconds = (endsAt) => {
  if (!endsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
};

const getTeamById = (teams, teamId) => teams.find((team) => team.id === teamId) ?? null;

const buildTeamRosters = (teams, players) =>
  (teams ?? []).map((team) => ({
    ...team,
    players: players.filter((player) => player.teamId === team.id)
  }));

function GameplayPlayerList({ players, playerId, hostId, getStatus }) {
  return (
    <ul className="player-list">
      {players.map((player) => {
        const status = getStatus(player);
        const badgeClass = status.tone === 'ready' ? 'badge badge--ready' : 'badge';

        return (
          <li key={player.id} className="player-row player-row--compact">
            <div className="player-row__identity">
              <span className="player-row__name">{player.name}</span>
              <div className="player-row__meta">
                {player.id === playerId && <span className="badge badge--self">You</span>}
                {player.id === hostId && <span className="badge badge--host">Host</span>}
              </div>
            </div>
            <span className={badgeClass}>{status.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ImposterPlay({
  roomCode,
  roomState,
  privateState,
  playersById,
  playerId,
  isHost,
  pendingAction,
  sendGameAction,
  returnRoomToLobby
}) {
  const [clueText, setClueText] = useState('');
  const publicState = roomState.gamePublicState;
  const stage = publicState?.stage;
  const results = publicState?.results;
  const currentTurnName = playersById.get(publicState.currentTurnPlayerId)?.name ?? 'Waiting';

  useStageCue(stage, {
    voting: 'phase-change',
    results: 'results-reveal'
  });

  useEffect(() => {
    setClueText('');
  }, [stage, publicState?.currentTurnPlayerId]);

  const handleSubmitClue = async () => {
    const response = await sendGameAction(roomCode, 'submit-clue', { text: clueText });
    if (!response.error) {
      setClueText('');
    }
  };

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">{stage === 'clues' ? 'Clue round' : stage === 'voting' ? 'Voting' : 'Results'}</p>
          <h2>Your role</h2>
          <p>Keep the live action at the top. Secondary detail stays tucked below.</p>
        </div>

        <SummaryChips
          items={[
            { label: 'Stage', value: stage === 'clues' ? 'Clue' : stage === 'voting' ? 'Vote' : 'Reveal' },
            stage === 'voting'
              ? { label: 'Votes', value: `${publicState.votesSubmitted} / ${roomState.players.length}` }
              : { label: 'Turn', value: currentTurnName },
            { label: 'Clues', value: publicState.clueCount }
          ]}
        />

        <div className="role-card">
          <span className="helper-text">Role</span>
          <strong className="role-card__title">{privateState?.role ?? 'Waiting'}</strong>
          <span className="helper-text">Word</span>
          <strong className="role-card__body">{privateState?.word ?? 'No word. Blend in.'}</strong>
        </div>

        {stage === 'clues' && privateState?.canClue && (
          <div className="field-stack">
            <label>
              <span className="helper-text">Give your clue</span>
              <input
                placeholder="Short clue for the room"
                value={clueText}
                maxLength={120}
                onChange={(event) => setClueText(event.target.value)}
              />
            </label>
            <button disabled={pendingAction === 'submit-clue'} onClick={handleSubmitClue}>
              Submit clue
            </button>
          </div>
        )}

        {stage === 'clues' && !privateState?.canClue && (
          <p className="helper-text">{currentTurnName} is up. Watch the clue feed and get ready for your turn.</p>
        )}

        {stage === 'voting' && privateState?.canVote && (
          <div className="field-stack">
            <p className="helper-text">Vote for the player you think is bluffing.</p>
            <div className="actions actions--stretch">
              {roomState.players
                .filter((player) => player.id !== playerId)
                .map((player) => (
                  <button
                    key={player.id}
                    className="secondary-action"
                    disabled={pendingAction === 'cast-vote' || player.id === privateState.votedForPlayerId}
                    onClick={() => sendGameAction(roomCode, 'cast-vote', { targetPlayerId: player.id })}
                  >
                    Vote for {player.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        {stage === 'voting' && privateState?.hasVoted && (
          <p className="helper-text">
            Vote locked for {playersById.get(privateState.votedForPlayerId)?.name ?? 'the accused player'}.
          </p>
        )}

        {stage === 'results' && results && (
          <div className="field-stack">
            <p className="stage-summary">
              {results.outcome === 'crew' ? 'Crew wins' : 'Imposter wins'}: {results.reason}
            </p>
            <p className="helper-text">
              The word was {results.secretWord}. {playersById.get(results.imposterId)?.name ?? 'The imposter'} was the imposter.
            </p>
            <ResultsActions
              isHost={isHost}
              roomCode={roomCode}
              onReturnToLobby={returnRoomToLobby}
              pendingAction={pendingAction}
            />
          </div>
        )}
      </section>

      <DisclosurePanel
        title={stage === 'results' ? 'Vote board' : 'Clue feed'}
        description={stage === 'results' ? 'See how the room voted and who was accused.' : 'A quick reference for the room without burying the main action.'}
        summary={stage === 'results' ? `${results?.voteTally?.length ?? 0} players` : `${publicState.clues.length} clues`}
        defaultOpen={stage === 'results'}
      >
        {stage === 'results' && results ? (
          <ul className="player-list">
            {results.voteTally.map((entry) => (
              <li key={entry.playerId} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{playersById.get(entry.playerId)?.name ?? 'Player'}</span>
                  <div className="player-row__meta">
                    {entry.playerId === results.imposterId && <span className="badge badge--host">Imposter</span>}
                    {results.accusedPlayerId === entry.playerId && <span className="badge badge--self">Accused</span>}
                  </div>
                </div>
                <span className="badge">{entry.votes} vote(s)</span>
              </li>
            ))}
          </ul>
        ) : publicState.clues.length > 0 ? (
          <ul className="player-list">
            {publicState.clues.map((clue) => (
              <li key={`${clue.playerId}-${clue.text}`} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{playersById.get(clue.playerId)?.name ?? 'Player'}</span>
                  <span className="helper-text">{clue.text}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">Clues will appear here as they are submitted.</p>
        )}
      </DisclosurePanel>

      <DisclosurePanel title="Players" description="Host, turn order, and active status in one place." summary={`${roomState.players.length} connected`}>
        <GameplayPlayerList
          players={roomState.players}
          playerId={playerId}
          hostId={roomState.hostId}
          getStatus={(player) => ({
            text: player.id === publicState.currentTurnPlayerId && stage === 'clues' ? 'Current' : 'Waiting',
            tone: player.id === publicState.currentTurnPlayerId && stage === 'clues' ? 'ready' : 'default'
          })}
        />
      </DisclosurePanel>
    </div>
  );
}

function WhoWhatWherePlay({
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
  const activeTeam = getTeamById(teams, publicState.activeTeamId);
  const myTeam = getTeamById(teams, privateState?.teamId);
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
              <p>{activeTeam?.name ?? 'Your team'} is live. Speak only and keep the round moving.</p>
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
                No spelling, rhyming, or part words. Tap the result the moment your team gets it.
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
              <p>{publicState.activeDescriberName} is describing. Say answers out loud as fast as you can.</p>
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
              <p>Only the describer sees the word. Your job is just to listen and call the answer.</p>
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
            <p>The current word stays hidden. You&apos;ll get a clean handoff before your team starts.</p>
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
            <p className="status-pill">Match complete</p>
            <h2>{results?.isTie ? 'Tie game' : 'Final leaderboard'}</h2>
            <p>
              {results?.isTie
                ? 'Two or more teams finished level on points.'
                : `${getTeamById(teams, results?.winnerTeamIds?.[0])?.name ?? 'Winner'} finished on top.`}
            </p>
          </div>

          <ul className="player-list">
            {(results?.leaderboard ?? []).map((entry) => (
              <li key={entry.teamId} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{entry.teamName}</span>
                  <span className="helper-text">
                    {(results?.winnerTeamIds ?? []).includes(entry.teamId) ? 'Top score' : 'Final standing'}
                  </span>
                </div>
                <span className={(results?.winnerTeamIds ?? []).includes(entry.teamId) ? 'badge badge--ready' : 'badge'}>
                  {entry.score} pts
                </span>
              </li>
            ))}
          </ul>

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
              <p>Start the timer only when everyone on your team is ready to listen and guess.</p>
            </div>
            <button disabled={pendingAction === 'start-turn'} onClick={() => sendGameAction(roomCode, 'start-turn')}>
              Start turn
            </button>
          </div>
        ) : privateState?.isActiveTeam ? (
          <div className="notice-card">
            <strong>Your team is on deck</strong>
            <p>Stay ready. The describer will start the clock when your team is set.</p>
          </div>
        ) : (
          <div className="notice-card">
            <strong>{activeTeam?.name ?? 'The next team'} is preparing</strong>
            <p>You are waiting until it is {myTeam?.name ?? 'your'} team&apos;s turn.</p>
          </div>
        )}
      </section>

      <section className="panel panel--stacked">
        <div className="panel-heading">
          <h2>Scoreboard</h2>
          <p>Scores and the latest turn stay visible between rounds, not during the live turn.</p>
        </div>

        <ul className="player-list">
          {teamRosters.map((team) => (
            <li key={team.id} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{team.name}</span>
                <span className="helper-text">
                  {team.players.map((player) => player.name).join(', ') || 'No players'}
                </span>
              </div>
              <span className={team.id === publicState.activeTeamId ? 'badge badge--ready' : 'badge'}>
                {team.score} pts
              </span>
            </li>
          ))}
        </ul>

        {publicState.lastTurnSummary ? (
          <div className="field-stack">
            <div className="panel-heading">
              <h3>Latest turn</h3>
              <p>
                {publicState.lastTurnSummary.teamName} with {publicState.lastTurnSummary.describerName}
              </p>
            </div>

            <SummaryChips
              items={[
                { label: 'Score change', value: publicState.lastTurnSummary.scoreDelta },
                { label: 'Correct', value: publicState.lastTurnSummary.correctCount },
                { label: 'Skipped', value: publicState.lastTurnSummary.skippedCount }
              ]}
            />

            <ul className="player-list">
              {publicState.lastTurnSummary.words.map((entry, index) => (
                <li key={`${entry.word}-${index}`} className="player-row player-row--compact">
                  <div className="player-row__identity">
                    <span className="player-row__name">{entry.word}</span>
                  </div>
                  <span className={entry.status === 'correct' ? 'badge badge--ready' : 'badge'}>
                    {entry.status === 'correct' ? 'Correct' : 'Skipped'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function HatGamePlay({
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
                  ? 'A skipped clue is in the queue and must come back before you can skip again.'
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
                <strong>Skip is locked until the skipped clue comes back</strong>
                <p>The current skip-with-return rule is active for this turn.</p>
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
                <strong>A skipped clue is still waiting in the deck</strong>
                <p>The describer cannot skip again until that clue is answered.</p>
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

          <ul className="player-list">
            {(results?.leaderboard ?? []).map((entry) => (
              <li key={entry.teamId} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{entry.teamName}</span>
                  <span className="helper-text">
                    {(results?.winnerTeamIds ?? []).includes(entry.teamId) ? 'Top score' : 'Final standing'}
                  </span>
                </div>
                <span className={(results?.winnerTeamIds ?? []).includes(entry.teamId) ? 'badge badge--ready' : 'badge'}>
                  {entry.score} pts
                </span>
              </li>
            ))}
          </ul>

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
            <p>Stay close. The describer will start when everyone is ready.</p>
          </div>
        ) : (
          <div className="notice-card">
            <strong>{activeTeam?.name ?? 'The next team'} is preparing</strong>
            <p>You are waiting until it is {myTeam?.name ?? 'your'} team&apos;s turn.</p>
          </div>
        )}
      </section>

      <section className="panel panel--stacked">
        <div className="panel-heading">
          <h2>Scoreboard</h2>
          <p>Phase progress and the latest turn stay visible between turns.</p>
        </div>

        <ul className="player-list">
          {teamRosters.map((team) => (
            <li key={team.id} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{team.name}</span>
                <span className="helper-text">
                  {team.players.map((player) => player.name).join(', ') || 'No players'}
                </span>
              </div>
              <span className={team.id === publicState.activeTeamId ? 'badge badge--ready' : 'badge'}>
                {team.score} pts
              </span>
            </li>
          ))}
        </ul>

        {publicState.lastTurnSummary ? (
          <div className="field-stack">
            <div className="panel-heading">
              <h3>Latest turn</h3>
              <p>
                {publicState.lastTurnSummary.teamName} with {publicState.lastTurnSummary.describerName}
              </p>
            </div>

            <SummaryChips
              items={[
                { label: 'Score change', value: publicState.lastTurnSummary.scoreDelta },
                { label: 'Correct', value: publicState.lastTurnSummary.correctCount },
                { label: 'Skipped', value: publicState.lastTurnSummary.skippedCount }
              ]}
            />

            <ul className="player-list">
              {publicState.lastTurnSummary.clues.map((entry, index) => (
                <li key={`${entry.clue}-${index}`} className="player-row player-row--compact">
                  <div className="player-row__identity">
                    <span className="player-row__name">{entry.clue}</span>
                  </div>
                  <span className={entry.status === 'correct' ? 'badge badge--ready' : 'badge'}>
                    {entry.status === 'correct' ? 'Correct' : 'Skipped'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DrawingPad({ prompt, disabled, onSubmit }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const width = 320;
    const height = 220;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = '100%';
    canvas.style.maxWidth = '420px';
    canvas.style.height = 'auto';

    context.resetTransform?.();
    context.scale(ratio, ratio);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.lineWidth = 4;
    context.strokeStyle = '#111111';
  }, []);

  useEffect(() => {
    initializeCanvas();
  }, [initializeCanvas, prompt]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 320,
      y: ((event.clientY - rect.top) / rect.height) * 220
    };
  };

  const handlePointerDown = (event) => {
    if (disabled) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const point = getPoint(event);
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const handlePointerMove = (event) => {
    if (!drawingRef.current || disabled) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const endDrawing = (event) => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div className="field-stack">
      <div className="role-card">
        <span className="helper-text">Draw this prompt</span>
        <strong className="role-card__title">{prompt}</strong>
        <span className="role-card__body">Keep the sketch readable. The next player only sees your drawing.</span>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          className="drawing-surface"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrawing}
          onPointerLeave={endDrawing}
        />
      </div>
      <div className="actions actions--stretch">
        <button className="secondary-action" disabled={disabled} onClick={initializeCanvas}>
          Clear sketch
        </button>
        <button disabled={disabled} onClick={() => onSubmit(canvasRef.current?.toDataURL('image/png'))}>
          Submit drawing
        </button>
      </div>
    </div>
  );
}

function DrawNGuessPlay({
  roomCode,
  roomState,
  privateState,
  playersById,
  playerId,
  isHost,
  pendingAction,
  sendGameAction,
  returnRoomToLobby
}) {
  const [guessText, setGuessText] = useState('');
  const publicState = roomState.gamePublicState;
  const stage = publicState?.stage;
  const results = publicState?.results;
  const activePlayerName = playersById.get(publicState.activePlayerId)?.name ?? 'Waiting';

  useStageCue(stage, {
    draw: 'handoff',
    guess: 'handoff',
    results: 'results-reveal'
  });

  useEffect(() => {
    setGuessText('');
  }, [stage, publicState?.activePlayerId]);

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">{stage === 'results' ? 'Reveal' : stage === 'draw' ? 'Draw step' : 'Guess step'}</p>
          <h2>
            {privateState?.mode === 'draw'
              ? 'Draw the prompt'
              : privateState?.mode === 'guess'
                ? 'Guess the drawing'
                : stage === 'results'
                  ? 'Chain complete'
                  : 'Waiting'}
          </h2>
          <p>Put the current task first and keep the reveal chain below the fold until it matters.</p>
        </div>

        <SummaryChips
          items={[
            { label: 'Active', value: activePlayerName },
            stage !== 'results'
              ? { label: 'Step', value: `${publicState.stageNumber} / ${publicState.totalStages}` }
              : { label: 'Entries', value: results?.chain?.length ?? 0 },
            { label: 'Submissions', value: publicState.submissions }
          ]}
        />

        {privateState?.mode === 'draw' && (
          <DrawingPad
            prompt={privateState.prompt}
            disabled={pendingAction === 'submit-drawing'}
            onSubmit={(imageData) => sendGameAction(roomCode, 'submit-drawing', { imageData })}
          />
        )}

        {privateState?.mode === 'guess' && (
          <div className="field-stack">
            <div className="canvas-wrap">
              <img className="drawing-preview" src={privateState.drawing} alt="Sketch to guess" />
            </div>
            <label>
              <span className="helper-text">What do you think this drawing says?</span>
              <input
                placeholder="Enter your guess"
                value={guessText}
                maxLength={100}
                onChange={(event) => setGuessText(event.target.value)}
              />
            </label>
            <button disabled={pendingAction === 'submit-guess'} onClick={() => sendGameAction(roomCode, 'submit-guess', { text: guessText })}>
              Submit guess
            </button>
          </div>
        )}

        {privateState?.mode === 'wait' && stage !== 'results' && (
          <div className="notice-card">
            <strong>{activePlayerName} is up</strong>
            <p>{activePlayerName} is working through the current {stage} step.</p>
          </div>
        )}

        {stage === 'results' && (
          <ResultsActions
            isHost={isHost}
            roomCode={roomCode}
            onReturnToLobby={returnRoomToLobby}
            pendingAction={pendingAction}
          />
        )}
      </section>

      <DisclosurePanel
        title="Reveal chain"
        description="Collapsed during play so the current action stays visible first on mobile."
        summary={results ? `${results.chain.length} entries` : 'Pending'}
        defaultOpen={stage === 'results'}
      >
        {results ? (
          <div className="results-chain">
            {results.chain.map((entry, index) => (
              <article key={`${entry.type}-${index}`} className="chain-item">
                <p className="chain-item__eyebrow">
                  {entry.type === 'prompt' ? 'Original prompt' : entry.type === 'drawing' ? 'Drawing' : 'Guess'}
                </p>
                {entry.type === 'drawing' ? (
                  <img className="drawing-preview" src={entry.imageData} alt={`Chain step ${index + 1}`} />
                ) : (
                  <p className="stage-summary">{entry.text}</p>
                )}
                {entry.submittedBy && (
                  <p className="helper-text">Submitted by {playersById.get(entry.submittedBy)?.name ?? 'Player'}</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="helper-text">The finished prompt chain appears here once the round is complete.</p>
        )}
      </DisclosurePanel>

      <DisclosurePanel title="Players" description="See whose turn it is without crowding the drawing or guessing area." summary={`${roomState.players.length} connected`}>
        <GameplayPlayerList
          players={roomState.players}
          playerId={playerId}
          hostId={roomState.hostId}
          getStatus={(player) => ({
            text: player.id === publicState.activePlayerId && stage !== 'results' ? 'Active' : 'Waiting',
            tone: player.id === publicState.activePlayerId && stage !== 'results' ? 'ready' : 'default'
          })}
        />
      </DisclosurePanel>
    </div>
  );
}

export function GamePlayScreen() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const {
    game,
    playerName,
    playerId,
    roomState,
    privateState,
    ensureRoom,
    sendGameAction,
    returnRoomToLobby,
    pendingAction
  } = usePlaySession();

  useEffect(() => {
    let ignore = false;

    if (!roomCode) {
      return undefined;
    }

    if (!playerName.trim()) {
      navigate(`/play/${game.id}/join/${roomCode}`, { replace: true });
      return undefined;
    }

    if (roomState?.code === roomCode && roomState.phase === 'in-progress' && playerId) {
      return undefined;
    }

    ensureRoom(roomCode).then((response) => {
      if (!ignore && response.error) {
        navigate(`/play/${game.id}/join/${roomCode}`, { replace: true });
      }
    });

    return () => {
      ignore = true;
    };
  }, [ensureRoom, game.id, navigate, playerId, playerName, roomCode, roomState?.code, roomState?.phase]);

  useEffect(() => {
    if (roomState?.code === roomCode && roomState.phase !== 'in-progress') {
      navigate(`/play/${game.id}/lobby/${roomCode}`, { replace: true });
    }
  }, [game.id, navigate, roomCode, roomState?.code, roomState?.phase]);

  const playersById = useMemo(
    () => new Map((roomState?.players ?? []).map((player) => [player.id, player])),
    [roomState?.players]
  );
  const isHost = roomState?.hostId === playerId;
  const gameplayLead =
    game.gameplayView === 'whowhatwhere'
      ? 'Each turn is split into setup, live play, and between-turn recap so phones stay focused.'
      : game.gameplayView === 'hatgame'
        ? 'Three phases share the same clue pool, so the screen keeps phase rules and the live clue front and center.'
      : 'The primary move stays above the fold. Logs, rosters, and reveal data are still there, just no longer competing for attention.';

  if (!roomState || roomState.code !== roomCode || roomState.phase !== 'in-progress') {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Gameplay</p>
        <h1 className="scene__title">{game.name}</h1>
        <p className="scene__lead">Restoring the active round and your private game state.</p>
      </main>
    );
  }

  return (
    <main className="scene scene--gameplay">
      <header className="scene__header scene__header--compact">
        <p className="scene__eyebrow">{game.name} in play</p>
        <h1 className="scene__title">Room {roomState.code}</h1>
        <p className="scene__lead">{gameplayLead}</p>
      </header>

      {game.gameplayView === 'imposter' && (
        <ImposterPlay
          roomCode={roomCode}
          roomState={roomState}
          privateState={privateState}
          playersById={playersById}
          playerId={playerId}
          isHost={isHost}
          pendingAction={pendingAction}
          sendGameAction={sendGameAction}
          returnRoomToLobby={returnRoomToLobby}
        />
      )}

      {game.gameplayView === 'whowhatwhere' && (
        <WhoWhatWherePlay
          roomCode={roomCode}
          roomState={roomState}
          privateState={privateState}
          playersById={playersById}
          playerId={playerId}
          isHost={isHost}
          pendingAction={pendingAction}
          sendGameAction={sendGameAction}
          returnRoomToLobby={returnRoomToLobby}
        />
      )}

      {game.gameplayView === 'drawnguess' && (
        <DrawNGuessPlay
          roomCode={roomCode}
          roomState={roomState}
          privateState={privateState}
          playersById={playersById}
          playerId={playerId}
          isHost={isHost}
          pendingAction={pendingAction}
          sendGameAction={sendGameAction}
          returnRoomToLobby={returnRoomToLobby}
        />
      )}

      {game.gameplayView === 'hatgame' && (
        <HatGamePlay
          roomCode={roomCode}
          roomState={roomState}
          privateState={privateState}
          playerId={playerId}
          isHost={isHost}
          pendingAction={pendingAction}
          sendGameAction={sendGameAction}
          returnRoomToLobby={returnRoomToLobby}
        />
      )}
    </main>
  );
}

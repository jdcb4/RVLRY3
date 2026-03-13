import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SoundToggle } from '../audio/SoundToggle';
import { useAudioCues } from '../audio/AudioCueContext';
import { useStageCue, useTimedTurnAudio } from '../audio/useGameAudio';
import {
  DrawingPad,
  SummaryChips
} from '../components/gameplay/SharedGameUi';
import { getGameById } from '../games/config';
import {
  fetchHatGameSuggestions,
  fetchRandomWord,
  fetchWordDeck
} from '../games/contentApi';
import { getGameModule } from '../games/registry';
import { formatCountdown, getCountdownSeconds } from '../games/timedTurns';
import {
  applyLocalAction,
  buildLocalSession,
  buildLocalTeams,
  createLocalPlayers,
  DEFAULT_LOCAL_HATGAME_SETTINGS,
  DEFAULT_LOCAL_PLAYER_COUNT,
  DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS,
  getActiveImposterPlayer,
  getHatGamePhaseMeta,
  getImposterSecretForPlayer,
  getLocalStartError,
  getLocalWordType,
  getWhoWhatWhereContext,
  MAX_LOCAL_CLUE_LENGTH,
  MAX_LOCAL_GUESS_LENGTH,
  MAX_LOCAL_HATGAME_CLUE_LENGTH,
  rebalanceWhoWhatWherePlayers
} from '../local/session';

const LOCAL_PLAYER_LIMIT = 8;
const EMPTY_TEAMS = [];

const createLocalPlayerId = () =>
  window.crypto?.randomUUID?.() ?? `local-${Math.random().toString(36).slice(2, 10)}`;

const getInitialPlayers = (gameId, settings = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS) =>
  createLocalPlayers(DEFAULT_LOCAL_PLAYER_COUNT[gameId] ?? 4, {
    teamCount: gameId === 'whowhatwhere' || gameId === 'hatgame' ? settings.teamCount : null
  });

const getInitialSettingsForGame = (gameId) =>
  gameId === 'hatgame' ? DEFAULT_LOCAL_HATGAME_SETTINGS : DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS;

const buildEmptyHatGameClues = (count) => Array.from({ length: count }, () => '');

const syncHatGameClueSubmissions = (currentSubmissions, players, cluesPerPlayer) =>
  players.reduce((nextSubmissions, player) => {
    const currentClues = currentSubmissions[player.id]?.clues ?? [];
    nextSubmissions[player.id] = {
      clues: Array.from({ length: cluesPerPlayer }, (_, index) => currentClues[index] ?? '')
    };
    return nextSubmissions;
  }, {});

const buildWhoWhatWhereRosters = (players, teams) =>
  (teams ?? []).map((team) => ({
    ...team,
    players: players.filter((player) => player.teamId === team.id)
  }));

function HandoffPanel({
  pill,
  title,
  description,
  isRevealed,
  onReveal,
  onHide,
  children,
  footer = null
}) {
  return (
    <section className="panel panel--hero panel--stacked">
      <div className="panel-heading">
        <p className="status-pill">{pill}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {!isRevealed ? (
        <div className="notice-card local-handoff">
          <strong>Keep this hidden while you pass the device.</strong>
          <p>Reveal only when the correct player has the phone and everyone else looks away.</p>
        </div>
      ) : (
        children
      )}

      <div className="actions actions--stretch">
        <button onClick={isRevealed ? onHide : onReveal}>{isRevealed ? 'Hide again' : 'Reveal'}</button>
        {footer}
      </div>
    </section>
  );
}

function LocalPlayersEditor({
  players,
  teams,
  onRenamePlayer,
  onTeamChange,
  onAddPlayer,
  onRemovePlayer,
  onAutoBalance
}) {
  return (
    <section className="panel panel--stacked">
      <div className="panel-heading">
        <h2>Players</h2>
        <p>Name everyone first so handoffs stay clear.</p>
      </div>

      <div className="local-toolbar">
        <button className="secondary-action" disabled={players.length >= LOCAL_PLAYER_LIMIT} onClick={onAddPlayer}>
          Add player
        </button>
        {teams.length > 0 && (
          <button className="secondary-action" onClick={onAutoBalance}>
            Auto-balance teams
          </button>
        )}
      </div>

      <div className="local-player-grid">
        {players.map((player, index) => (
          <article key={player.id} className="local-player-card">
            <label className="settings-field">
              <span className="helper-text">Player {index + 1}</span>
              <input
                value={player.name}
                maxLength={24}
                onChange={(event) => onRenamePlayer(player.id, event.target.value)}
              />
            </label>

            {teams.length > 0 && (
              <label className="settings-field">
                <span className="helper-text">Team</span>
                <select value={player.teamId ?? teams[0]?.id ?? ''} onChange={(event) => onTeamChange(player.id, event.target.value)}>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button className="secondary-action" disabled={players.length <= 2} onClick={() => onRemovePlayer(player.id)}>
              Remove
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function LocalHatGameClueEditor({
  players,
  clueSubmissions,
  cluesPerPlayer,
  busyAction,
  onChangeClue,
  onGenerateClues
}) {
  return (
    <section className="panel panel--stacked">
      <div className="panel-heading">
        <h2>Clue packs</h2>
        <p>Add person names here. The Who list button gives each player an editable draft.</p>
      </div>

      <div className="local-player-grid">
        {players.map((player) => {
          const clues = clueSubmissions[player.id]?.clues ?? buildEmptyHatGameClues(cluesPerPlayer);

          return (
            <article key={`hat-setup-${player.id}`} className="local-player-card">
              <div className="panel-heading">
                <h3>{player.name}</h3>
                <p>{clues.filter((clue) => clue.trim().length > 0).length} / {cluesPerPlayer} ready</p>
              </div>

              <div className="field-stack">
                {clues.map((clue, index) => (
                  <label key={`${player.id}-clue-${index}`} className="settings-field">
                    <span className="helper-text">Clue {index + 1}</span>
                    <input
                      value={clue}
                      maxLength={MAX_LOCAL_HATGAME_CLUE_LENGTH}
                      placeholder="Enter a person name"
                      onChange={(event) => onChangeClue(player.id, index, event.target.value)}
                    />
                  </label>
                ))}
              </div>

              <button
                className="secondary-action"
                disabled={busyAction === `generate-hat-clues:${player.id}`}
                onClick={() => onGenerateClues(player.id)}
              >
                {busyAction === `generate-hat-clues:${player.id}`
                  ? 'Loading suggestions'
                  : 'Generate from Who list'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ResultsActions({ onPlayAgain, onResetSetup, busyAction }) {
  return (
    <div className="actions actions--stretch">
      <button disabled={busyAction === 'restart'} onClick={onPlayAgain}>
        Play another round
      </button>
      <button className="secondary-action" onClick={onResetSetup}>
        Back to setup
      </button>
    </div>
  );
}

function LocalImposterView({
  session,
  applyAction,
  busyAction,
  onPlayAgain,
  onResetSetup
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [clueText, setClueText] = useState('');
  const activePlayer = getActiveImposterPlayer(session);
  const secret = activePlayer ? getImposterSecretForPlayer(session, activePlayer.id) : null;

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
                {session.revealIndex === session.players.length - 1 ? 'Start clue round' : 'Lock and pass'}
              </button>
            ) : null
          }
        >
          <div className="role-card">
            <span className="helper-text">Role</span>
            <strong className="role-card__title">{secret.role === 'imposter' ? 'Imposter' : 'Crew'}</strong>
            <span className="helper-text">Word</span>
            <strong className="role-card__body">{secret.word ?? 'No word. Bluff through the clues.'}</strong>
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
              { label: 'Clue turn', value: `${session.clueIndex + 1} / ${session.players.length}` },
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

          <button onClick={() => applyAction({ type: 'submit-clue', payload: { text: clueText } })}>
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
                  <li key={`${clue.playerId}-${clue.text}`} className="player-row player-row--compact">
                    <div className="player-row__identity">
                      <span className="player-row__name">{player?.name ?? 'Player'}</span>
                      <span className="helper-text">{clue.text}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="helper-text">Saved clues will appear here as the round progresses.</p>
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
            {session.players.find((player) => player.id === session.results?.imposterId)?.name ?? 'Player'} was the imposter.
          </span>
        </div>

        <ResultsActions busyAction={busyAction} onPlayAgain={onPlayAgain} onResetSetup={onResetSetup} />
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
                    {entry.playerId === session.results?.imposterId && <span className="badge badge--host">Imposter</span>}
                    {entry.playerId === session.results?.accusedPlayerId && <span className="badge badge--self">Accused</span>}
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

function LocalWhoWhatWhereView({
  session,
  applyAction,
  busyAction,
  onStartTurn,
  onPlayAgain,
  onResetSetup
}) {
  const [handoffVisible, setHandoffVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(() => getCountdownSeconds(session.activeTurn?.endsAt));
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
    const currentWord = session.activeTurn?.wordQueue[session.activeTurn?.queueIndex] ?? 'Loading';

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">Live turn</p>
            <h2>{context.activeDescriberName} is describing</h2>
            <p>Keep the word on this device with the describer while the team guesses out loud.</p>
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
              Score it the moment the team gets there, or skip and accept the configured penalty.
            </span>
          </div>

          <SummaryChips
            items={[
              { label: 'Team', value: context.activeTeam?.name ?? 'Team' },
              { label: 'Score', value: session.activeTurn?.score ?? 0 },
              { label: 'Free skips', value: session.activeTurn?.freeSkipsRemaining ?? 0 }
            ]}
          />

          <div className="actions actions--stretch">
            <button onClick={() => applyAction({ type: 'mark-correct' })}>Correct</button>
            <button className="secondary-action" onClick={() => applyAction({ type: 'skip-word' })}>
              Skip
            </button>
            <button className="secondary-action" onClick={() => applyAction({ type: 'end-turn' })}>
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

          <ul className="player-list">
            {(session.results?.leaderboard ?? []).map((entry) => (
              <li key={entry.teamId} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{entry.teamName}</span>
                  <span className="helper-text">
                    {(session.results?.winnerTeamIds ?? []).includes(entry.teamId) ? 'Top score' : 'Final standing'}
                  </span>
                </div>
                <span className={(session.results?.winnerTeamIds ?? []).includes(entry.teamId) ? 'badge badge--ready' : 'badge'}>
                  {entry.score} pts
                </span>
              </li>
            ))}
          </ul>

          <ResultsActions busyAction={busyAction} onPlayAgain={onPlayAgain} onResetSetup={onResetSetup} />
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
            { label: 'Round', value: `${session.roundNumber} / ${session.settings.totalRounds}` },
            { label: 'Describer', value: context.activeDescriberName },
            { label: 'Turn length', value: `${session.settings.turnDurationSeconds}s` }
          ]}
        />

        <HandoffPanel
          pill="Pass to describer"
          title={`Give the phone to ${context.activeDescriberName}`}
          description={`${context.activeTeam?.name ?? 'The next team'} should be ready to guess before the clock starts.`}
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
            <p>The timer begins as soon as the turn starts and this device shows the first word.</p>
          </div>
        </HandoffPanel>
      </section>

      <section className="panel panel--stacked">
        <div className="panel-heading">
          <h2>Scoreboard</h2>
        </div>

        <ul className="player-list">
          {teamRosters.map((team) => (
            <li key={team.id} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{team.name}</span>
                <span className="helper-text">{team.players.map((player) => player.name).join(', ')}</span>
              </div>
              <span className={team.id === context.activeTeamId ? 'badge badge--ready' : 'badge'}>{team.score} pts</span>
            </li>
          ))}
        </ul>

        {session.lastTurnSummary && (
          <div className="field-stack">
            <div className="panel-heading">
              <h3>Latest turn</h3>
              <p>
                {session.lastTurnSummary.teamName} with {session.lastTurnSummary.describerName}
              </p>
            </div>
            <SummaryChips
              items={[
                { label: 'Score change', value: session.lastTurnSummary.scoreDelta },
                { label: 'Correct', value: session.lastTurnSummary.correctCount },
                { label: 'Skipped', value: session.lastTurnSummary.skippedCount }
              ]}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function LocalDrawNGuessView({
  session,
  applyAction,
  busyAction,
  onPlayAgain,
  onResetSetup
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [guessText, setGuessText] = useState('');
  const activePlayer = session.players.find((player) => player.id === session.activePlayerId) ?? null;
  const previousEntry = session.chain.at(-1);

  useStageCue(session.stage, {
    draw: 'handoff',
    guess: 'handoff',
    results: 'results-reveal'
  });

  useEffect(() => {
    setIsRevealed(false);
    setGuessText('');
  }, [session.stage, session.activePlayerId, session.stageIndex]);

  if (session.stage !== 'results' && activePlayer) {
    const isDrawStage = session.stage === 'draw';
    return (
      <div className="gameplay-stack">
        <HandoffPanel
          pill={isDrawStage ? 'Draw step' : 'Guess step'}
          title={`Pass to ${activePlayer.name}`}
          description={
            isDrawStage
              ? 'Only this player should see the prompt before they sketch it.'
              : 'Only this player should see the drawing before they enter a guess.'
          }
          isRevealed={isRevealed}
          onReveal={() => setIsRevealed(true)}
          onHide={() => setIsRevealed(false)}
        >
          {isDrawStage ? (
            <DrawingPad
              prompt={previousEntry?.text ?? session.prompt}
              disabled={busyAction === 'submit-drawing'}
              onSubmit={(imageData) => applyAction({ type: 'submit-drawing', payload: { imageData } })}
            />
          ) : (
            <div className="field-stack">
              <div className="canvas-wrap">
                <img className="drawing-preview" src={previousEntry?.imageData} alt="Sketch to guess" />
              </div>
              <label className="settings-field">
                <span className="helper-text">What does this drawing say?</span>
                <input
                  value={guessText}
                  maxLength={MAX_LOCAL_GUESS_LENGTH}
                  placeholder="Enter the next guess"
                  onChange={(event) => setGuessText(event.target.value)}
                />
              </label>
              <button onClick={() => applyAction({ type: 'submit-guess', payload: { text: guessText } })}>
                Save guess
              </button>
            </div>
          )}
        </HandoffPanel>
      </div>
    );
  }

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">Chain complete</p>
          <h2>Reveal the whole drift</h2>
          <p>The original prompt and every drawing or guess are now visible for the full table.</p>
        </div>

        <SummaryChips
          items={[
            { label: 'Players', value: session.players.length },
            { label: 'Entries', value: session.results?.chain?.length ?? 0 },
            { label: 'Submissions', value: session.submissions }
          ]}
        />

        <ResultsActions busyAction={busyAction} onPlayAgain={onPlayAgain} onResetSetup={onResetSetup} />
      </section>

      <section className="panel panel--stacked">
        <div className="panel-heading">
          <h2>Reveal chain</h2>
        </div>

        <div className="results-chain">
          {(session.results?.chain ?? []).map((entry, index) => (
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
                <p className="helper-text">
                  Submitted by {session.players.find((player) => player.id === entry.submittedBy)?.name ?? 'Player'}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function LocalHatGameView({
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

  useTimedTurnAudio({
    active: session.stage === 'turn',
    turnKey: `${session.phaseNumber}:${session.roundNumber}:${context.activeTeamId}:${context.activeDescriberId}`,
    endsAt: session.activeTurn?.endsAt
  });
  useStageCue(session.stage, {
    results: 'results-reveal'
  });

  useEffect(() => {
    if (session.phaseNumber > previousPhaseRef.current) {
      playCue('phase-change');
    }

    previousPhaseRef.current = session.phaseNumber;
  }, [playCue, session.phaseNumber]);

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
    const currentClue = session.activeTurn?.clueQueue[session.activeTurn?.queueIndex]?.text ?? 'Loading';

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">Phase {session.phaseNumber}: {phaseMeta.name}</p>
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

          <div className="role-card">
            <span className="helper-text">Current clue</span>
            <strong className="role-card__title">{currentClue}</strong>
            <span className="role-card__body">
              {session.activeTurn?.skippedCluePoolIndex !== null
                ? 'A skipped clue is in the deck and must be solved before another skip.'
                : phaseMeta.instruction}
            </span>
          </div>

          <SummaryChips
            items={[
              { label: 'Team', value: context.activeTeam?.name ?? 'Team' },
              { label: 'Score', value: session.activeTurn?.score ?? 0 },
              { label: 'Correct', value: session.activeTurn?.correctCount ?? 0 }
            ]}
          />

          <div className="actions actions--stretch">
            <button onClick={() => applyAction({ type: 'mark-correct' })}>Correct</button>
            <button
              className="secondary-action"
              disabled={session.activeTurn?.skippedCluePoolIndex !== null || session.activeTurn?.skipsRemaining <= 0}
              onClick={() => applyAction({ type: 'skip-clue' })}
            >
              Skip
            </button>
            <button className="secondary-action" onClick={() => applyAction({ type: 'end-turn' })}>
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

          <ul className="player-list">
            {(session.results?.leaderboard ?? []).map((entry) => (
              <li key={entry.teamId} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{entry.teamName}</span>
                </div>
                <span className={(session.results?.winnerTeamIds ?? []).includes(entry.teamId) ? 'badge badge--ready' : 'badge'}>
                  {entry.score} pts
                </span>
              </li>
            ))}
          </ul>

          <ResultsActions busyAction={busyAction} onPlayAgain={onPlayAgain} onResetSetup={onResetSetup} />
        </section>
      </div>
    );
  }

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">Phase {session.phaseNumber}: {phaseMeta.name}</p>
          <h2>{context.activeTeam?.name ?? 'Next team'} are up next</h2>
          <p>{context.activeDescriberName} is the describer for this turn.</p>
        </div>

        <SummaryChips
          items={[
            { label: 'Rule', value: phaseMeta.name },
            { label: 'Describer', value: context.activeDescriberName },
            { label: 'Turn length', value: `${session.settings.turnDurationSeconds}s` }
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
          description={`${context.activeTeam?.name ?? 'The next team'} should be ready to guess before the clock starts.`}
          isRevealed={handoffVisible}
          onReveal={() => setHandoffVisible(true)}
          onHide={() => setHandoffVisible(false)}
          footer={
            handoffVisible ? (
              <button disabled={busyAction === 'start-turn'} onClick={onStartTurn}>
                Start turn
              </button>
            ) : null
          }
        >
          <div className="notice-card">
            <strong>Reuse the same clue pool with a new rule</strong>
            <p>{phaseMeta.instruction}</p>
          </div>
        </HandoffPanel>
      </section>

      <section className="panel panel--stacked">
        <div className="panel-heading">
          <h2>Scoreboard</h2>
        </div>

        <ul className="player-list">
          {teamRosters.map((team) => (
            <li key={team.id} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{team.name}</span>
                <span className="helper-text">{team.players.map((player) => player.name).join(', ')}</span>
              </div>
              <span className={team.id === context.activeTeamId ? 'badge badge--ready' : 'badge'}>
                {team.score} pts
              </span>
            </li>
          ))}
        </ul>

        {session.lastTurnSummary && (
          <div className="field-stack">
            <div className="panel-heading">
              <h3>Latest turn</h3>
              <p>
                {session.lastTurnSummary.teamName} with {session.lastTurnSummary.describerName}
              </p>
            </div>
            <SummaryChips
              items={[
                { label: 'Score change', value: session.lastTurnSummary.scoreDelta },
                { label: 'Correct', value: session.lastTurnSummary.correctCount },
                { label: 'Skipped', value: session.lastTurnSummary.skippedCount }
              ]}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function WhoWhatWhereSettingsCard({ settings, onChange }) {
  return (
    <section className="settings-card">
      <div className="panel-heading">
        <h3>Match settings</h3>
      </div>

      <div className="settings-grid">
        <label className="settings-field">
          <span className="helper-text">Teams</span>
          <select value={settings.teamCount} onChange={(event) => onChange('teamCount', Number.parseInt(event.target.value, 10))}>
            <option value={2}>2 teams</option>
            <option value={3}>3 teams</option>
            <option value={4}>4 teams</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="helper-text">Turn length</span>
          <select value={settings.turnDurationSeconds} onChange={(event) => onChange('turnDurationSeconds', Number.parseInt(event.target.value, 10))}>
            <option value={30}>30 seconds</option>
            <option value={45}>45 seconds</option>
            <option value={60}>60 seconds</option>
            <option value={75}>75 seconds</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="helper-text">Rounds</span>
          <select value={settings.totalRounds} onChange={(event) => onChange('totalRounds', Number.parseInt(event.target.value, 10))}>
            <option value={1}>1 round</option>
            <option value={2}>2 rounds</option>
            <option value={3}>3 rounds</option>
            <option value={4}>4 rounds</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="helper-text">Free skips</span>
          <select value={settings.freeSkips} onChange={(event) => onChange('freeSkips', Number.parseInt(event.target.value, 10))}>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="helper-text">Skip penalty</span>
          <select value={settings.skipPenalty} onChange={(event) => onChange('skipPenalty', Number.parseInt(event.target.value, 10))}>
            <option value={0}>0 points</option>
            <option value={1}>1 point</option>
            <option value={2}>2 points</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function HatGameSettingsCard({ settings, onChange }) {
  return (
    <section className="settings-card">
      <div className="panel-heading">
        <h3>Round settings</h3>
      </div>

      <div className="settings-grid">
        <label className="settings-field">
          <span className="helper-text">Teams</span>
          <select value={settings.teamCount} onChange={(event) => onChange('teamCount', Number.parseInt(event.target.value, 10))}>
            <option value={2}>2 teams</option>
            <option value={3}>3 teams</option>
            <option value={4}>4 teams</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="helper-text">Turn length</span>
          <select value={settings.turnDurationSeconds} onChange={(event) => onChange('turnDurationSeconds', Number.parseInt(event.target.value, 10))}>
            <option value={30}>30 seconds</option>
            <option value={45}>45 seconds</option>
            <option value={60}>60 seconds</option>
            <option value={90}>90 seconds</option>
            <option value={120}>120 seconds</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="helper-text">Clues each</span>
          <select value={settings.cluesPerPlayer} onChange={(event) => onChange('cluesPerPlayer', Number.parseInt(event.target.value, 10))}>
            <option value={3}>3 clues</option>
            <option value={4}>4 clues</option>
            <option value={5}>5 clues</option>
            <option value={6}>6 clues</option>
            <option value={7}>7 clues</option>
            <option value={8}>8 clues</option>
            <option value={9}>9 clues</option>
            <option value={10}>10 clues</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="helper-text">Skips per turn</span>
          <select value={settings.skipsPerTurn} onChange={(event) => onChange('skipsPerTurn', Number.parseInt(event.target.value, 10))}>
            <option value={0}>0 skips</option>
            <option value={1}>1 skip</option>
            <option value={2}>2 skips</option>
            <option value={3}>3 skips</option>
            <option value={4}>4 skips</option>
            <option value={5}>5 skips</option>
          </select>
        </label>
      </div>
    </section>
  );
}

const LOCAL_VIEW_COMPONENTS = {
  imposter: LocalImposterView,
  whowhatwhere: LocalWhoWhatWhereView,
  drawnguess: LocalDrawNGuessView,
  hatgame: LocalHatGameView
};

const LOCAL_SETTINGS_COMPONENTS = {
  whowhatwhere: WhoWhatWhereSettingsCard,
  hatgame: HatGameSettingsCard
};

export function LocalMode() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { playCue } = useAudioCues();
  const game = getGameById(gameId);
  const gameModule = getGameModule(gameId);
  const [settings, setSettings] = useState(() => getInitialSettingsForGame(gameId));
  const [players, setPlayers] = useState(() =>
    getInitialPlayers(gameId, getInitialSettingsForGame(gameId))
  );
  const [hatClueSubmissions, setHatClueSubmissions] = useState(() =>
    syncHatGameClueSubmissions(
      {},
      getInitialPlayers(gameId, getInitialSettingsForGame(gameId)),
      getInitialSettingsForGame(gameId).cluesPerPlayer ?? DEFAULT_LOCAL_HATGAME_SETTINGS.cluesPerPlayer
    )
  );
  const [session, setSession] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const nextSettings = getInitialSettingsForGame(gameId);
    const nextPlayers = getInitialPlayers(gameId, nextSettings);

    setSettings(nextSettings);
    setPlayers(nextPlayers);
    setHatClueSubmissions(
      syncHatGameClueSubmissions(
        {},
        nextPlayers,
        nextSettings.cluesPerPlayer ?? DEFAULT_LOCAL_HATGAME_SETTINGS.cluesPerPlayer
      )
    );
    setSession(null);
    setBusyAction('');
    setError('');
  }, [gameId]);

  useEffect(() => {
    if (gameId !== 'hatgame') {
      setHatClueSubmissions({});
      return;
    }

    setHatClueSubmissions((currentSubmissions) =>
      syncHatGameClueSubmissions(
        currentSubmissions,
        players,
        settings.cluesPerPlayer ?? DEFAULT_LOCAL_HATGAME_SETTINGS.cluesPerPlayer
      )
    );
  }, [gameId, players, settings.cluesPerPlayer]);

  const teams = useMemo(
    () => (gameModule.requiresTeams ? buildLocalTeams(settings.teamCount) : EMPTY_TEAMS),
    [gameModule.requiresTeams, settings.teamCount]
  );

  const startHint = useMemo(
    () =>
      getLocalStartError({
        gameId,
        players,
        settings,
        lobbyState: { clueSubmissions: hatClueSubmissions }
      }),
    [gameId, hatClueSubmissions, players, settings]
  );
  const SettingsCard = LOCAL_SETTINGS_COMPONENTS[gameModule.localSettingsVariant] ?? null;
  const ActiveLocalView = LOCAL_VIEW_COMPONENTS[gameModule.localVariant] ?? LocalImposterView;

  const replacePlayers = useCallback((updater) => {
    setPlayers((currentPlayers) =>
      updater(currentPlayers).map((player, index) => ({
        ...player,
        seat: index
      }))
    );
  }, []);

  const applyAction = useCallback((action) => {
    setError('');
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      const result = applyLocalAction(currentSession, action);
      if (result?.error) {
        setError(result.error);
        return currentSession;
      }

      return result;
    });
  }, []);

  const startSession = useCallback(async () => {
    if (startHint) {
      setError(startHint);
      return;
    }

    setBusyAction('start-session');
    setError('');

    try {
      const prompt =
        gameId === 'whowhatwhere' || gameId === 'hatgame'
          ? ''
          : await fetchRandomWord(getLocalWordType(gameId));
      setSession(
        buildLocalSession({
          gameId,
          players,
          prompt,
          settings,
          lobbyState: { clueSubmissions: hatClueSubmissions }
        })
      );
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to start local session');
    } finally {
      setBusyAction('');
    }
  }, [gameId, hatClueSubmissions, players, settings, startHint]);

  const playAgain = useCallback(async () => {
    setBusyAction('restart');
    setError('');

    try {
      const prompt =
        gameId === 'whowhatwhere' || gameId === 'hatgame'
          ? ''
          : await fetchRandomWord(getLocalWordType(gameId));
      setSession(
        buildLocalSession({
          gameId,
          players,
          prompt,
          settings,
          lobbyState: { clueSubmissions: hatClueSubmissions }
        })
      );
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to start another round');
    } finally {
      setBusyAction('');
    }
  }, [gameId, hatClueSubmissions, players, settings]);

  const startTimedTeamTurn = useCallback(async () => {
    setBusyAction('start-turn');
    setError('');

    try {
      const payload =
        gameId === 'whowhatwhere'
          ? await fetchWordDeck({ type: 'guessing', count: 30 })
          : {};
      setSession((currentSession) => {
        if (!currentSession) {
          return currentSession;
        }

        const result = applyLocalAction(currentSession, {
          type: 'start-turn',
          payload
        });

        if (result?.error) {
          setError(result.error);
          return currentSession;
        }

        return result;
      });
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : 'Unable to start this turn');
    } finally {
      setBusyAction('');
    }
  }, [gameId]);

  const handleRenamePlayer = (playerId, name) => {
    replacePlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name
            }
          : player
      )
    );
  };

  const handleChangeTeam = (playerId, teamId) => {
    replacePlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              teamId
            }
          : player
      )
    );
  };

  const handleAddPlayer = () => {
    replacePlayers((currentPlayers) => [
      ...currentPlayers,
      {
        id: createLocalPlayerId(),
        seat: currentPlayers.length,
        name: `Player ${currentPlayers.length + 1}`,
        teamId: teams.length > 0 ? teams[currentPlayers.length % teams.length]?.id ?? null : null
      }
    ]);
  };

  const handleRemovePlayer = (playerId) => {
    replacePlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
  };

  const handleUpdateTeamSetting = (key, value) => {
    const nextSettings = {
      ...settings,
      [key]: value
    };
    setSettings(nextSettings);

    if (key === 'teamCount' && gameModule.requiresTeams) {
      setPlayers((currentPlayers) => rebalanceWhoWhatWherePlayers(currentPlayers, value));
    }
  };

  const handleChangeHatGameClue = (playerId, clueIndex, value) => {
    setHatClueSubmissions((currentSubmissions) => ({
      ...currentSubmissions,
      [playerId]: {
        clues: (currentSubmissions[playerId]?.clues ?? buildEmptyHatGameClues(settings.cluesPerPlayer)).map(
          (clue, index) => (index === clueIndex ? value : clue)
        )
      }
    }));
  };

  const handleGenerateHatGameClues = useCallback(
    async (playerId) => {
      setBusyAction(`generate-hat-clues:${playerId}`);
      setError('');

      try {
        const suggestions = await fetchHatGameSuggestions(settings.cluesPerPlayer);
        setHatClueSubmissions((currentSubmissions) => ({
          ...currentSubmissions,
          [playerId]: {
            clues: Array.from(
              { length: settings.cluesPerPlayer },
              (_, index) => suggestions[index] ?? currentSubmissions[playerId]?.clues?.[index] ?? ''
            )
          }
        }));
        playCue('submit');
      } catch (generateError) {
        setError(
          generateError instanceof Error
            ? generateError.message
            : 'Unable to load HatGame clue suggestions'
        );
      } finally {
        setBusyAction('');
      }
    },
    [playCue, settings.cluesPerPlayer]
  );

  const handleResetSetup = () => {
    setSession(null);
    setBusyAction('');
    setError('');
  };

  if (!game?.supportsLocal) {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Pass and play</p>
        <h1 className="scene__title">Local mode unavailable</h1>
        <p className="scene__lead">This game is currently tuned for online play only.</p>
        <div className="actions">
          <button onClick={() => navigate(`/play/${gameId}`)}>Back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="scene scene--local">
      <header className="scene__header scene__header--compact">
        <p className="scene__eyebrow">Pass and play</p>
        <h1 className="scene__title">{game.name}</h1>
        <p className="scene__lead">{gameModule.localLead}</p>
        <div className="actions">
          <SoundToggle />
        </div>
      </header>

      {!session ? (
        <div className="panel-grid panel-grid--local">
          <section className="panel panel--hero panel--stacked">
            <div className="panel-heading">
              <h2>Setup</h2>
              <p>Set the table once, then pass the phone as needed.</p>
            </div>

            <SummaryChips
              items={[
                { label: 'Players', value: players.length },
                { label: 'Mode', value: 'Single device' },
                gameModule.requiresTeams
                  ? { label: 'Teams', value: settings.teamCount }
                  : { label: 'Word type', value: getLocalWordType(game.id) }
              ]}
            />

            {SettingsCard ? <SettingsCard settings={settings} onChange={handleUpdateTeamSetting} /> : null}

            {error && <p className="connection-banner connection-banner--error">{error}</p>}

            <div className="actions actions--stretch">
              <button disabled={busyAction === 'start-session' || Boolean(startHint)} onClick={startSession}>
                {busyAction === 'start-session' ? 'Preparing round' : 'Start local round'}
              </button>
              <button className="secondary-action" onClick={() => navigate(`/play/${game.id}`)}>
                Back to online flow
              </button>
            </div>
            <p className="helper-text">
              {startHint ?? (gameModule.requiresHatClues ? 'Ready once teams and clue packs are set.' : 'Ready once names and teams look right.')}
            </p>
          </section>

          <LocalPlayersEditor
            players={players}
            teams={teams}
            onRenamePlayer={handleRenamePlayer}
            onTeamChange={handleChangeTeam}
            onAddPlayer={handleAddPlayer}
            onRemovePlayer={handleRemovePlayer}
            onAutoBalance={() => setPlayers((currentPlayers) => rebalanceWhoWhatWherePlayers(currentPlayers, settings.teamCount))}
          />

          {gameModule.requiresHatClues && (
            <LocalHatGameClueEditor
              players={players}
              clueSubmissions={hatClueSubmissions}
              cluesPerPlayer={settings.cluesPerPlayer}
              busyAction={busyAction}
              onChangeClue={handleChangeHatGameClue}
              onGenerateClues={handleGenerateHatGameClues}
            />
          )}
        </div>
      ) : (
        <>
          {error && <p className="connection-banner connection-banner--error">{error}</p>}

          <ActiveLocalView
            session={session}
            applyAction={applyAction}
            busyAction={busyAction}
            onStartTurn={startTimedTeamTurn}
            onPlayAgain={playAgain}
            onResetSetup={handleResetSetup}
          />
        </>
      )}
    </main>
  );
}

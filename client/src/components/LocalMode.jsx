import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGameById } from '../games/config';
import {
  applyLocalAction,
  buildLocalSession,
  buildLocalTeams,
  createLocalPlayers,
  DEFAULT_LOCAL_PLAYER_COUNT,
  DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS,
  getActiveImposterPlayer,
  getImposterSecretForPlayer,
  getLocalStartError,
  getLocalWordType,
  getWhoWhatWhereContext,
  MAX_LOCAL_CLUE_LENGTH,
  MAX_LOCAL_GUESS_LENGTH,
  rebalanceWhoWhatWherePlayers
} from '../local/session';

const LOCAL_PLAYER_LIMIT = 8;
const EMPTY_TEAMS = [];

const localInstructions = {
  imposter:
    'Set the room on one device, reveal each secret role privately, then pass the phone for clues and votes.',
  whowhatwhere:
    'Build the teams on one screen, hand the phone to the describer, and run the timer locally.',
  drawnguess:
    'Pass the device from player to player, alternating hidden drawings and guesses until the chain is revealed.'
};

const createLocalPlayerId = () =>
  window.crypto?.randomUUID?.() ?? `local-${Math.random().toString(36).slice(2, 10)}`;

const getInitialPlayers = (gameId, settings = DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS) =>
  createLocalPlayers(DEFAULT_LOCAL_PLAYER_COUNT[gameId] ?? 4, {
    teamCount: gameId === 'whowhatwhere' ? settings.teamCount : null
  });

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Unable to load game content');
  }

  return response.json();
};

const fetchPrompt = async (gameId) => {
  const type = getLocalWordType(gameId);
  const payload = await fetchJson(`/api/words/random?type=${encodeURIComponent(type)}`);
  const prompt = String(payload.word ?? '').trim();
  if (!prompt) {
    throw new Error('No prompt available right now');
  }

  return prompt;
};

const fetchWhoWhatWhereDeck = async (count = 30) => {
  const payload = await fetchJson(`/api/words/deck?type=guessing&count=${count}`);
  const words = Array.isArray(payload.words)
    ? payload.words.map((word) => String(word ?? '').trim()).filter(Boolean)
    : [];

  if (words.length === 0) {
    throw new Error('No words available for this turn');
  }

  return {
    category: String(payload.category ?? '').trim() || 'Mixed deck',
    words
  };
};

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

const buildWhoWhatWhereRosters = (players, teams) =>
  (teams ?? []).map((team) => ({
    ...team,
    players: players.filter((player) => player.teamId === team.id)
  }));

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
        <span className="role-card__body">Keep it readable. The next player only sees your sketch.</span>
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
        <p>Name everyone here first so the handoff prompts and scoreboards stay clear.</p>
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
            <p>Speak the clue out loud, then capture it here so the room can review the round later.</p>
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

export function LocalMode() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const game = getGameById(gameId);
  const [settings, setSettings] = useState(DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS);
  const [players, setPlayers] = useState(() => getInitialPlayers(gameId, DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS));
  const [session, setSession] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setSettings(DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS);
    setPlayers(getInitialPlayers(gameId, DEFAULT_LOCAL_WHOWHATWHERE_SETTINGS));
    setSession(null);
    setBusyAction('');
    setError('');
  }, [gameId]);

  const teams = useMemo(
    () => (gameId === 'whowhatwhere' ? buildLocalTeams(settings.teamCount) : EMPTY_TEAMS),
    [gameId, settings.teamCount]
  );

  const startWarning = useMemo(
    () => getLocalStartError({ gameId, players, settings }),
    [gameId, players, settings]
  );

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
    if (startWarning) {
      setError(startWarning);
      return;
    }

    setBusyAction('start-session');
    setError('');

    try {
      const prompt = gameId === 'whowhatwhere' ? '' : await fetchPrompt(gameId);
      setSession(
        buildLocalSession({
          gameId,
          players,
          prompt,
          settings
        })
      );
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to start local session');
    } finally {
      setBusyAction('');
    }
  }, [gameId, players, settings, startWarning]);

  const playAgain = useCallback(async () => {
    setBusyAction('restart');
    setError('');

    try {
      const prompt = gameId === 'whowhatwhere' ? '' : await fetchPrompt(gameId);
      setSession(
        buildLocalSession({
          gameId,
          players,
          prompt,
          settings
        })
      );
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to start another round');
    } finally {
      setBusyAction('');
    }
  }, [gameId, players, settings]);

  const startWhoWhatWhereTurn = useCallback(async () => {
    setBusyAction('start-turn');
    setError('');

    try {
      const deck = await fetchWhoWhatWhereDeck(30);
      setSession((currentSession) => {
        if (!currentSession) {
          return currentSession;
        }

        const result = applyLocalAction(currentSession, {
          type: 'start-turn',
          payload: deck
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
  }, []);

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

  const handleUpdateWhoWhatWhereSetting = (key, value) => {
    const nextSettings = {
      ...settings,
      [key]: value
    };
    setSettings(nextSettings);

    if (key === 'teamCount') {
      setPlayers((currentPlayers) => rebalanceWhoWhatWherePlayers(currentPlayers, value));
    }
  };

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
        <p className="scene__lead">{localInstructions[game.id]}</p>
      </header>

      {!session ? (
        <div className="panel-grid panel-grid--local">
          <section className="panel panel--hero panel--stacked">
            <div className="panel-heading">
              <h2>Setup</h2>
              <p>Configure the table once, then the phone becomes the handoff device for the whole round.</p>
            </div>

            <SummaryChips
              items={[
                { label: 'Players', value: players.length },
                { label: 'Mode', value: 'Single device' },
                game.id === 'whowhatwhere'
                  ? { label: 'Teams', value: settings.teamCount }
                  : { label: 'Word type', value: getLocalWordType(game.id) }
              ]}
            />

            {game.id === 'whowhatwhere' && (
              <section className="settings-card">
                <div className="panel-heading">
                  <h3>Match settings</h3>
                </div>

                <div className="settings-grid">
                  <label className="settings-field">
                    <span className="helper-text">Teams</span>
                    <select value={settings.teamCount} onChange={(event) => handleUpdateWhoWhatWhereSetting('teamCount', Number.parseInt(event.target.value, 10))}>
                      <option value={2}>2 teams</option>
                      <option value={3}>3 teams</option>
                      <option value={4}>4 teams</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span className="helper-text">Turn length</span>
                    <select value={settings.turnDurationSeconds} onChange={(event) => handleUpdateWhoWhatWhereSetting('turnDurationSeconds', Number.parseInt(event.target.value, 10))}>
                      <option value={30}>30 seconds</option>
                      <option value={45}>45 seconds</option>
                      <option value={60}>60 seconds</option>
                      <option value={75}>75 seconds</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span className="helper-text">Rounds</span>
                    <select value={settings.totalRounds} onChange={(event) => handleUpdateWhoWhatWhereSetting('totalRounds', Number.parseInt(event.target.value, 10))}>
                      <option value={1}>1 round</option>
                      <option value={2}>2 rounds</option>
                      <option value={3}>3 rounds</option>
                      <option value={4}>4 rounds</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span className="helper-text">Free skips</span>
                    <select value={settings.freeSkips} onChange={(event) => handleUpdateWhoWhatWhereSetting('freeSkips', Number.parseInt(event.target.value, 10))}>
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span className="helper-text">Skip penalty</span>
                    <select value={settings.skipPenalty} onChange={(event) => handleUpdateWhoWhatWhereSetting('skipPenalty', Number.parseInt(event.target.value, 10))}>
                      <option value={0}>0 points</option>
                      <option value={1}>1 point</option>
                      <option value={2}>2 points</option>
                    </select>
                  </label>
                </div>
              </section>
            )}

            {startWarning ? (
              <p className="connection-banner connection-banner--error">{startWarning}</p>
            ) : (
              <p className="connection-banner">Ready to start once the names and teams look right.</p>
            )}

            {error && <p className="connection-banner connection-banner--error">{error}</p>}

            <div className="actions actions--stretch">
              <button disabled={busyAction === 'start-session'} onClick={startSession}>
                {busyAction === 'start-session' ? 'Preparing round' : 'Start local round'}
              </button>
              <button className="secondary-action" onClick={() => navigate(`/play/${game.id}`)}>
                Back to online flow
              </button>
            </div>
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
        </div>
      ) : (
        <>
          {error && <p className="connection-banner connection-banner--error">{error}</p>}

          {game.id === 'imposter' && (
            <LocalImposterView
              session={session}
              applyAction={applyAction}
              busyAction={busyAction}
              onPlayAgain={playAgain}
              onResetSetup={handleResetSetup}
            />
          )}

          {game.id === 'whowhatwhere' && (
            <LocalWhoWhatWhereView
              session={session}
              applyAction={applyAction}
              busyAction={busyAction}
              onStartTurn={startWhoWhatWhereTurn}
              onPlayAgain={playAgain}
              onResetSetup={handleResetSetup}
            />
          )}

          {game.id === 'drawnguess' && (
            <LocalDrawNGuessView
              session={session}
              applyAction={applyAction}
              busyAction={busyAction}
              onPlayAgain={playAgain}
              onResetSetup={handleResetSetup}
            />
          )}
        </>
      )}
    </main>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePlaySession } from './PlaySessionContext';

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
  playersById,
  playerId,
  isHost,
  pendingAction,
  sendGameAction,
  returnRoomToLobby
}) {
  const publicState = roomState.gamePublicState;
  const stage = publicState?.stage;
  const results = publicState?.results;
  const activePlayerName = playersById.get(publicState.activePlayerId)?.name ?? 'Waiting';

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">{stage === 'turn' ? 'Live turn' : 'Results'}</p>
          <h2>{privateState?.isActive ? 'Your prompt' : 'Room focus'}</h2>
          <p>Keep the active describer in control while the rest of the room stays oriented.</p>
        </div>

        <SummaryChips
          items={[
            { label: 'Describer', value: activePlayerName },
            stage === 'turn'
              ? { label: 'Turn', value: `${publicState.turnNumber} / ${publicState.totalTurns}` }
              : { label: 'Turns', value: publicState.turnSummary.length },
            { label: 'Guessed', value: publicState.guessed },
            { label: 'Skipped', value: publicState.skipped }
          ]}
        />

        {privateState?.isActive ? (
          <div className="role-card">
            <span className="helper-text">Describe this prompt</span>
            <strong className="role-card__title">{privateState.word}</strong>
            <span className="role-card__body">Speak clearly without saying the answer itself.</span>
          </div>
        ) : (
          <div className="notice-card">
            <strong>{activePlayerName} is live</strong>
            <p>
              {stage === 'turn'
                ? `${activePlayerName} is describing a ${publicState.currentWordLength}-letter word.`
                : 'The round has finished and the full prompt log is ready below.'}
            </p>
          </div>
        )}

        {privateState?.isActive && stage === 'turn' && (
          <div className="actions actions--stretch">
            <button disabled={pendingAction === 'mark-guessed'} onClick={() => sendGameAction(roomCode, 'mark-guessed')}>
              Mark guessed
            </button>
            <button
              className="secondary-action"
              disabled={pendingAction === 'mark-skipped'}
              onClick={() => sendGameAction(roomCode, 'mark-skipped')}
            >
              Skip word
            </button>
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
        title={stage === 'results' ? 'Resolved prompts' : 'Turn summary'}
        description={stage === 'results' ? 'Every completed prompt from the round.' : 'Recent turn outcomes so the room can stay in sync.'}
        summary={`${publicState.turnSummary.length} logged`}
        defaultOpen={stage === 'results'}
      >
        {stage === 'results' && results ? (
          <ul className="player-list">
            {results.turns.map((turn, index) => (
              <li key={`${turn.playerId}-${turn.word}-${index}`} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{playersById.get(turn.playerId)?.name ?? 'Player'}</span>
                  <span className="helper-text">{turn.word}</span>
                </div>
                <span className={turn.outcome === 'guessed' ? 'badge badge--ready' : 'badge'}>{turn.outcome}</span>
              </li>
            ))}
          </ul>
        ) : publicState.turnSummary.length > 0 ? (
          <ul className="player-list">
            {publicState.turnSummary.map((entry, index) => (
              <li key={`${entry.playerId}-${entry.outcome}-${index}`} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{playersById.get(entry.playerId)?.name ?? 'Player'}</span>
                  <span className="helper-text">{entry.wordLength}-letter prompt</span>
                </div>
                <span className={entry.outcome === 'guessed' ? 'badge badge--ready' : 'badge'}>
                  {entry.outcome === 'guessed' ? 'Guessed' : 'Skipped'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">Each resolved prompt will be recorded here.</p>
        )}
      </DisclosurePanel>

      <DisclosurePanel title="Players" description="Active turn ownership without crowding the main prompt area." summary={`${roomState.players.length} connected`}>
        <GameplayPlayerList
          players={roomState.players}
          playerId={playerId}
          hostId={roomState.hostId}
          getStatus={(player) => ({
            text: player.id === publicState.activePlayerId && stage === 'turn' ? 'Active' : 'Waiting',
            tone: player.id === publicState.activePlayerId && stage === 'turn' ? 'ready' : 'default'
          })}
        />
      </DisclosurePanel>
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
        <p className="scene__lead">
          The primary move stays above the fold. Logs, rosters, and reveal data are still there, just no longer competing for attention.
        </p>
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
    </main>
  );
}

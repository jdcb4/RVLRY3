import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePlaySession } from './PlaySessionContext';

function ResultsActions({ isHost, roomCode, onReturnToLobby, pendingAction }) {
  if (!isHost) {
    return <p className="helper-text">The host can return the room to the lobby for another round.</p>;
  }

  return (
    <div className="actions">
      <button disabled={pendingAction === 'return-to-lobby'} onClick={() => onReturnToLobby(roomCode)}>
        Return to lobby
      </button>
    </div>
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
  const stage = roomState.gamePublicState?.stage;
  const results = roomState.gamePublicState?.results;

  useEffect(() => {
    setClueText('');
  }, [stage, roomState.gamePublicState?.currentTurnPlayerId]);

  const handleSubmitClue = async () => {
    const response = await sendGameAction(roomCode, 'submit-clue', { text: clueText });
    if (!response.error) {
      setClueText('');
    }
  };

  return (
    <div className="gameplay-grid">
      <section className="panel panel--hero">
        <h2>Round state</h2>
        <div className="stat-row">
          <span>Stage</span>
          <span>{stage === 'clues' ? 'Clue round' : stage === 'voting' ? 'Voting' : 'Results'}</span>
        </div>
        {stage === 'clues' && (
          <div className="stat-row">
            <span>Current player</span>
            <span>{playersById.get(roomState.gamePublicState.currentTurnPlayerId)?.name ?? 'Waiting'}</span>
          </div>
        )}
        {stage === 'voting' && (
          <div className="stat-row">
            <span>Votes submitted</span>
            <span>
              {roomState.gamePublicState.votesSubmitted} / {roomState.players.length}
            </span>
          </div>
        )}
        <div className="stat-row">
          <span>Clues given</span>
          <span>{roomState.gamePublicState.clueCount}</span>
        </div>
      </section>

      <section className="panel">
        <h2>Your role</h2>
        <div className="stat-row">
          <span>Role</span>
          <span>{privateState?.role ?? 'Waiting'}</span>
        </div>
        <div className="stat-row">
          <span>Word</span>
          <span>{privateState?.word ?? 'No word. Blend in.'}</span>
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
          <p className="helper-text">Wait for the active player to submit their clue.</p>
        )}

        {stage === 'voting' && privateState?.canVote && (
          <div className="field-stack">
            <p className="helper-text">Vote for the player you think is bluffing.</p>
            <div className="actions actions--stack">
              {roomState.players
                .filter((player) => player.id !== playerId)
                .map((player) => (
                  <button
                    key={player.id}
                    className="secondary-action"
                    disabled={player.id === privateState.votedForPlayerId}
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

        {stage === 'results' && (
          <>
            <p className="stage-summary">
              {results?.outcome === 'crew' ? 'Crew wins' : 'Imposter wins'}: {results?.reason}
            </p>
            <ResultsActions
              isHost={isHost}
              roomCode={roomCode}
              onReturnToLobby={returnRoomToLobby}
              pendingAction={pendingAction}
            />
          </>
        )}
      </section>

      <section className="panel">
        <h2>Clues</h2>
        {roomState.gamePublicState.clues.length === 0 ? (
          <p className="helper-text">Clues will appear here as the round moves around the room.</p>
        ) : (
          <ul className="player-list">
            {roomState.gamePublicState.clues.map((clue) => (
              <li key={`${clue.playerId}-${clue.text}`} className="player-row">
                <div className="player-row__identity">
                  <span className="player-row__name">{playersById.get(clue.playerId)?.name ?? 'Player'}</span>
                  <span className="helper-text">{clue.text}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>{stage === 'results' ? 'Vote outcome' : 'Players'}</h2>
        {stage === 'results' && results ? (
          <ul className="player-list">
            {results.voteTally.map((entry) => (
              <li key={entry.playerId} className="player-row">
                <div className="player-row__identity">
                  <span className="player-row__name">{playersById.get(entry.playerId)?.name ?? 'Player'}</span>
                  <span className="helper-text">
                    {entry.playerId === results.imposterId ? 'Imposter' : 'Crew'} {results.accusedPlayerId === entry.playerId ? '| accused' : ''}
                  </span>
                </div>
                <span className="badge">{entry.votes} vote(s)</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="player-list">
            {roomState.players.map((player) => (
              <li key={player.id} className="player-row">
                <div className="player-row__identity">
                  <span className="player-row__name">{player.name}</span>
                </div>
                <span className="badge">{player.id === roomState.gamePublicState.currentTurnPlayerId ? 'Current' : 'Waiting'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function WhoWhatWherePlay({
  roomCode,
  roomState,
  privateState,
  playersById,
  isHost,
  pendingAction,
  sendGameAction,
  returnRoomToLobby
}) {
  const stage = roomState.gamePublicState?.stage;
  const results = roomState.gamePublicState?.results;

  return (
    <div className="gameplay-grid">
      <section className="panel panel--hero">
        <h2>Round state</h2>
        <div className="stat-row">
          <span>Stage</span>
          <span>{stage === 'turn' ? 'Live turn' : 'Results'}</span>
        </div>
        {stage === 'turn' && (
          <>
            <div className="stat-row">
              <span>Active describer</span>
              <span>{playersById.get(roomState.gamePublicState.activePlayerId)?.name ?? 'Waiting'}</span>
            </div>
            <div className="stat-row">
              <span>Turn</span>
              <span>
                {roomState.gamePublicState.turnNumber} / {roomState.gamePublicState.totalTurns}
              </span>
            </div>
          </>
        )}
        <div className="stat-row">
          <span>Guessed</span>
          <span>{roomState.gamePublicState.guessed}</span>
        </div>
        <div className="stat-row">
          <span>Skipped</span>
          <span>{roomState.gamePublicState.skipped}</span>
        </div>
      </section>

      <section className="panel">
        <h2>{privateState?.isActive ? 'Your prompt' : 'Waiting on describer'}</h2>
        {privateState?.isActive ? (
          <>
            <p className="stage-summary">{privateState.word}</p>
            <p className="helper-text">Describe this clearly without saying the word itself.</p>
            <div className="actions">
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
          </>
        ) : (
          <p className="helper-text">
            {stage === 'turn'
              ? `${playersById.get(roomState.gamePublicState.activePlayerId)?.name ?? 'A player'} is describing a ${roomState.gamePublicState.currentWordLength}-letter word.`
              : 'The round has finished.'}
          </p>
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

      <section className="panel">
        <h2>Turn summary</h2>
        {roomState.gamePublicState.turnSummary.length === 0 ? (
          <p className="helper-text">Each resolved prompt will be recorded here.</p>
        ) : (
          <ul className="player-list">
            {roomState.gamePublicState.turnSummary.map((entry, index) => (
              <li key={`${entry.playerId}-${entry.outcome}-${index}`} className="player-row">
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
        )}
      </section>

      <section className="panel">
        <h2>{stage === 'results' ? 'Resolved prompts' : 'Room focus'}</h2>
        {stage === 'results' && results ? (
          <ul className="player-list">
            {results.turns.map((turn, index) => (
              <li key={`${turn.playerId}-${turn.word}-${index}`} className="player-row">
                <div className="player-row__identity">
                  <span className="player-row__name">{playersById.get(turn.playerId)?.name ?? 'Player'}</span>
                  <span className="helper-text">{turn.word}</span>
                </div>
                <span className={turn.outcome === 'guessed' ? 'badge badge--ready' : 'badge'}>
                  {turn.outcome}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">
            Keep callouts moving. The active describer resolves the turn as soon as the room lands the word or decides to pass.
          </p>
        )}
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
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

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
      <p className="stage-summary">Prompt: {prompt}</p>
      <canvas
        ref={canvasRef}
        className="drawing-surface"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrawing}
        onPointerLeave={endDrawing}
      />
      <div className="actions">
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
  isHost,
  pendingAction,
  sendGameAction,
  returnRoomToLobby
}) {
  const [guessText, setGuessText] = useState('');
  const stage = roomState.gamePublicState?.stage;
  const results = roomState.gamePublicState?.results;

  useEffect(() => {
    setGuessText('');
  }, [stage, roomState.gamePublicState?.activePlayerId]);

  return (
    <div className="gameplay-grid">
      <section className="panel panel--hero">
        <h2>Chain state</h2>
        <div className="stat-row">
          <span>Stage</span>
          <span>{stage === 'results' ? 'Reveal' : stage === 'draw' ? 'Draw' : 'Guess'}</span>
        </div>
        {stage !== 'results' && (
          <>
            <div className="stat-row">
              <span>Active player</span>
              <span>{playersById.get(roomState.gamePublicState.activePlayerId)?.name ?? 'Waiting'}</span>
            </div>
            <div className="stat-row">
              <span>Step</span>
              <span>
                {roomState.gamePublicState.stageNumber} / {roomState.gamePublicState.totalStages}
              </span>
            </div>
          </>
        )}
        <div className="stat-row">
          <span>Submissions</span>
          <span>{roomState.gamePublicState.submissions}</span>
        </div>
      </section>

      <section className="panel">
        <h2>
          {privateState?.mode === 'draw'
            ? 'Draw the prompt'
            : privateState?.mode === 'guess'
              ? 'Guess the drawing'
              : stage === 'results'
                ? 'Chain complete'
                : 'Waiting'}
        </h2>

        {privateState?.mode === 'draw' && (
          <DrawingPad
            prompt={privateState.prompt}
            disabled={pendingAction === 'submit-drawing'}
            onSubmit={(imageData) => sendGameAction(roomCode, 'submit-drawing', { imageData })}
          />
        )}

        {privateState?.mode === 'guess' && (
          <div className="field-stack">
            <img className="drawing-preview" src={privateState.drawing} alt="Sketch to guess" />
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
          <p className="helper-text">
            {playersById.get(roomState.gamePublicState.activePlayerId)?.name ?? 'A player'} is on the current {stage} step.
          </p>
        )}

        {stage === 'results' && (
          <>
            <p className="stage-summary">The full chain is ready to review.</p>
            <ResultsActions
              isHost={isHost}
              roomCode={roomCode}
              onReturnToLobby={returnRoomToLobby}
              pendingAction={pendingAction}
            />
          </>
        )}
      </section>

      <section className="panel chain-panel">
        <h2>Reveal chain</h2>
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
          <p className="helper-text">The finished prompt chain will appear here once everyone has taken a turn.</p>
        )}
      </section>

      <section className="panel">
        <h2>Players</h2>
        <ul className="player-list">
          {roomState.players.map((player) => (
            <li key={player.id} className="player-row">
              <div className="player-row__identity">
                <span className="player-row__name">{player.name}</span>
              </div>
              <span className="badge">
                {player.id === roomState.gamePublicState.activePlayerId && stage !== 'results' ? 'Active' : 'Waiting'}
              </span>
            </li>
          ))}
        </ul>
      </section>
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
      <header className="scene__header">
        <p className="scene__eyebrow">{game.name} in play</p>
        <h1 className="scene__title">Room {roomState.code}</h1>
        <p className="scene__lead">
          Each game now runs its own live round flow from active turns through results.
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
          isHost={isHost}
          pendingAction={pendingAction}
          sendGameAction={sendGameAction}
          returnRoomToLobby={returnRoomToLobby}
        />
      )}
    </main>
  );
}

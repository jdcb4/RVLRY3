import { useCallback, useEffect, useRef, useState } from 'react';

export function SummaryChips({ items }) {
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

export function TeamScoreboard({
  title = 'Scoreboard',
  description = null,
  teams,
  activeTeamId = null,
  children = null,
  defaultOpen = false,
  summary = null
}) {
  const [isOpen, setIsOpen] = useState(() => defaultOpen);
  const activeTeam = teams.find((team) => team.id === activeTeamId);
  const summaryLabel =
    summary ?? (activeTeam ? `${activeTeam.name} up` : `${teams.length} teams`);

  return (
    <details
      className="panel disclosure"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="disclosure__summary">
        <div className="disclosure__summary-copy">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {summaryLabel ? <span className="badge">{summaryLabel}</span> : null}
      </summary>
      <div className="disclosure__body field-stack">
        <ul className="player-list">
          {teams.map((team) => (
            <li key={team.id} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{team.name}</span>
                <span className="helper-text">
                  {team.players.map((player) => player.name).join(', ') || 'No players'}
                </span>
              </div>
              <span className={team.id === activeTeamId ? 'badge badge--ready' : 'badge'}>
                {team.score} pts
              </span>
            </li>
          ))}
        </ul>

        {children}
      </div>
    </details>
  );
}

export function TeamTurnOrder({
  title = 'Turn order',
  teams,
  activeDescriberName = null
}) {
  if (!teams?.length) {
    return null;
  }

  return (
    <div className="turn-order">
      <div className="panel-heading">
        <h3>{title}</h3>
      </div>
      <ul className="player-list">
        {teams.map((team, index) => (
          <li
            key={team.id}
            aria-current={index === 0 ? 'step' : undefined}
            className={`player-row player-row--compact ${index === 0 ? 'player-row--active' : ''}`}
          >
            <div className="player-row__identity">
              <span className="player-row__name">{team.name}</span>
              <span className="helper-text">
                {index === 0
                  ? activeDescriberName
                    ? `${activeDescriberName} is up now`
                    : 'Active team'
                  : index === 1
                    ? 'Next up'
                    : 'Later in the round'}
              </span>
            </div>
            <div className="turn-order__meta">
              {index === 0 ? (
                <span className="badge badge--ready">Now</span>
              ) : index === 1 ? (
                <span className="badge">Next</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LeaderboardList({ leaderboard, winnerTeamIds = [] }) {
  return (
    <ul className="player-list">
      {leaderboard.map((entry) => (
        <li key={entry.teamId} className="player-row player-row--compact">
          <div className="player-row__identity">
            <span className="player-row__name">{entry.teamName}</span>
            <span className="helper-text">
              {winnerTeamIds.includes(entry.teamId) ? 'Top score' : 'Final standing'}
            </span>
          </div>
          <span className={winnerTeamIds.includes(entry.teamId) ? 'badge badge--ready' : 'badge'}>
            {entry.score} pts
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TurnSummaryPanel({
  summary,
  entries = null,
  getEntryKey = (entry, index) => `${index}`,
  getEntryLabel = (entry) => entry.word ?? entry.clue ?? '',
  getEntryStatus = (entry) => entry.status
}) {
  if (!summary) {
    return null;
  }

  return (
    <div className="field-stack">
      <div className="panel-heading">
        <h3>Latest turn</h3>
        <p>
          {summary.teamName} with {summary.describerName}
        </p>
      </div>
      <SummaryChips
        items={[
          { label: 'Score change', value: summary.scoreDelta },
          { label: 'Correct', value: summary.correctCount },
          { label: 'Skipped', value: summary.skippedCount }
        ]}
      />

      {entries?.length ? (
        <ul className="player-list">
          {entries.map((entry, index) => (
            <li key={getEntryKey(entry, index)} className="player-row player-row--compact">
              <div className="player-row__identity">
                <span className="player-row__name">{getEntryLabel(entry)}</span>
              </div>
              <span className={getEntryStatus(entry) === 'correct' ? 'badge badge--ready' : 'badge'}>
                {getEntryStatus(entry) === 'correct' ? 'Correct' : 'Skipped'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DrawingPad({
  prompt,
  disabled,
  onSubmit,
  promptLabel = 'Draw this prompt',
  hintText = 'Keep it readable. The next player only sees your sketch.',
  clearLabel = 'Clear sketch',
  submitLabel = 'Submit drawing'
}) {
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
        <span className="helper-text">{promptLabel}</span>
        <strong className="role-card__title">{prompt}</strong>
        <span className="role-card__body">{hintText}</span>
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
          {clearLabel}
        </button>
        <button disabled={disabled} onClick={() => onSubmit(canvasRef.current?.toDataURL('image/png'))}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

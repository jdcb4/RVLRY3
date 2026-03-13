import { useCallback, useEffect, useRef } from 'react';

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

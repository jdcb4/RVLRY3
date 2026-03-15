import { useEffect, useMemo, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
import { exportDrawNGuessChainImage } from '../../games/drawNGuessExport';
import { MAX_LOCAL_GUESS_LENGTH } from '../../local/session';
import { DrawingPad } from '../gameplay/SharedGameUi';
import { HandoffPanel, ResultsActions } from './common';

export function DrawNGuessLocalView({
  session,
  applyAction,
  busyAction,
  onPlayAgain,
  onResetSetup
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [guessText, setGuessText] = useState('');
  const activePlayer =
    session.players.find((player) => player.id === session.activePlayerId) ?? null;
  const previousEntry = session.chain.at(-1);
  const [shareError, setShareError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const playersById = useMemo(
    () => new Map(session.players.map((player) => [player.id, player.name])),
    [session.players]
  );

  useStageCue(session.stage, {
    draw: 'handoff',
    guess: 'handoff',
    results: 'results-reveal'
  });

  useEffect(() => {
    setIsRevealed(false);
    setGuessText('');
    setShareError('');
    setIsExporting(false);
  }, [session.stage, session.activePlayerId, session.stageIndex]);

  const handleExportChain = async () => {
    setShareError('');
    setIsExporting(true);

    try {
      await exportDrawNGuessChainImage({
        entries: session.results?.chain ?? [],
        playersById,
        title: `DrawNGuess: ${session.players[0]?.name ?? 'Local game'}`,
        subtitle: 'RVLRY reveal chain',
        filename: 'drawnguess-reveal-chain.png'
      });
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : 'Could not export the reveal chain'
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (session.stage !== 'results' && activePlayer) {
    const isDrawStage = session.stage === 'draw';
    return (
      <div className="gameplay-stack">
        <HandoffPanel
          pill={isDrawStage ? 'Draw step' : 'Guess step'}
          title={`Pass to ${activePlayer.name}`}
          targetName={activePlayer.name}
          description={
            isDrawStage
              ? 'Only this player should see the prompt.'
              : 'Only this player should see the drawing.'
          }
          isRevealed={isRevealed}
          onReveal={() => setIsRevealed(true)}
          onHide={() => setIsRevealed(false)}
          showHideButton={false}
        >
          {isDrawStage ? (
            <DrawingPad
              prompt={previousEntry?.text ?? session.prompt}
              disabled={busyAction === 'submit-drawing'}
              onSubmit={(imageData) =>
                applyAction({ type: 'submit-drawing', payload: { imageData } })
              }
            />
          ) : (
            <div className="field-stack">
              <div className="canvas-wrap">
                <img
                  className="drawing-preview"
                  src={previousEntry?.imageData}
                  alt="Sketch to guess"
                />
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
              <button
                onClick={() =>
                  applyAction({ type: 'submit-guess', payload: { text: guessText } })
                }
              >
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
          <p className="status-pill">Reveal chain</p>
          <h2>Reveal the whole drift</h2>
        </div>

        <div className="actions actions--stretch">
          <button
            className="secondary-action"
            disabled={isExporting}
            onClick={handleExportChain}
          >
            {isExporting ? 'Exporting image' : 'Share or export image'}
          </button>
        </div>

        {shareError ? <p className="connection-banner connection-banner--error">{shareError}</p> : null}

        <div className="results-chain">
          {(session.results?.chain ?? []).map((entry, index) => (
            <article key={`${entry.type}-${index}`} className="chain-item">
              <p className="chain-item__eyebrow">
                {entry.type === 'prompt'
                  ? 'Original prompt'
                  : entry.type === 'drawing'
                    ? 'Drawing'
                    : 'Guess'}
              </p>
              {entry.type === 'drawing' ? (
                <img
                  className="drawing-preview"
                  src={entry.imageData}
                  alt={`Chain step ${index + 1}`}
                />
              ) : (
                <p className="stage-summary">{entry.text}</p>
              )}
              {entry.submittedBy ? (
                <p className="helper-text">
                  Submitted by {playersById.get(entry.submittedBy) ?? 'Player'}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="panel panel--stacked">
        <ResultsActions
          busyAction={busyAction}
          onPlayAgain={onPlayAgain}
          onResetSetup={onResetSetup}
        />
      </section>
    </div>
  );
}

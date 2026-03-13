import { useEffect, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
import { DrawingPad, SummaryChips } from '../../components/gameplay/SharedGameUi';
import { DisclosurePanel, GameplayPlayerList, ResultsActions } from './common';

export function DrawNGuessPlay({
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
          <p>Focus on the active step first.</p>
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
            hintText="Keep it readable. The next player only sees your drawing."
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
        description="Opened at the end so the active step stays clear."
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

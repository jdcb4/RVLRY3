import { useEffect, useMemo, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
import { DrawingPad, SummaryChips } from '../../components/gameplay/SharedGameUi';
import { exportDrawNGuessChainImage } from '../../games/drawNGuessExport';
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
  const [selectedBookId, setSelectedBookId] = useState(null);
  const publicState = roomState.gamePublicState;
  const results = publicState?.results;
  const books = results?.books ?? privateState?.books ?? [];
  const selectedBook =
    books.find((book) => book.id === selectedBookId) ??
    books.find((book) => book.id === privateState?.ownBookId) ??
    books[0] ??
    null;

  useStageCue(publicState?.stage, {
    results: 'results-reveal'
  });

  useEffect(() => {
    setGuessText('');
  }, [publicState?.roundNumber, privateState?.bookId, privateState?.mode]);

  useEffect(() => {
    if (!selectedBookId && selectedBook?.id) {
      setSelectedBookId(selectedBook.id);
    }
  }, [selectedBook?.id, selectedBookId]);

  if (publicState?.stage !== 'results') {
    const submittedNames = new Set(publicState?.submittedPlayerIds ?? []);
    const roundMode = privateState?.mode;
    const isWaiting = privateState?.hasSubmitted;

    return (
      <div className="gameplay-stack">
        <section className="panel panel--hero panel--stacked gameplay-primary">
          <div className="panel-heading">
            <p className="status-pill">Round {publicState?.roundNumber} / {publicState?.totalRounds}</p>
            <h2>
              {roundMode === 'draw'
                ? 'Draw now'
                : roundMode === 'guess'
                  ? 'Guess now'
                  : roundMode === 'pass'
                    ? 'Pass your starter word'
                    : 'Waiting'}
            </h2>
            <p>
              {roundMode === 'draw'
                ? 'Everyone is drawing at the same time.'
                : roundMode === 'guess'
                  ? 'Everyone is guessing at the same time.'
                  : 'This setup pass keeps the game ending on a drawing round.'}
            </p>
          </div>

          <SummaryChips
            items={[
              { label: 'Round type', value: publicState?.roundMode ?? 'Waiting' },
              { label: 'Submitted', value: `${publicState?.submittedCount ?? 0} / ${roomState.players.length}` },
              { label: 'Round length', value: `${publicState?.roundDurationSeconds ?? 45}s` }
            ]}
          />

          {isWaiting ? (
            <div className="notice-card notice-card--focus">
              <strong>Submitted</strong>
              <p>Waiting for the rest of the room to finish this round.</p>
            </div>
          ) : roundMode === 'draw' ? (
            <DrawingPad
              prompt={privateState?.prompt}
              disabled={pendingAction === 'submit-drawing'}
              onSubmit={(imageData) => sendGameAction(roomCode, 'submit-drawing', { imageData })}
              hintText="Draw the latest prompt in your book."
            />
          ) : roundMode === 'guess' ? (
            <div className="field-stack">
              <div className="canvas-wrap">
                <img className="drawing-preview" src={privateState?.drawing} alt="Sketch to guess" />
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
              <button
                disabled={pendingAction === 'submit-guess'}
                onClick={() => sendGameAction(roomCode, 'submit-guess', { text: guessText })}
              >
                Submit guess
              </button>
            </div>
          ) : roundMode === 'pass' ? (
            <div className="field-stack">
              <div className="role-card">
                <span className="helper-text">Starter word</span>
                <strong className="role-card__title">{privateState?.prompt}</strong>
                <span className="role-card__body">Take a look, then pass it along. No input this round.</span>
              </div>
              <button
                disabled={pendingAction === 'pass-book'}
                onClick={() => sendGameAction(roomCode, 'pass-book')}
              >
                Pass book on
              </button>
            </div>
          ) : (
            <div className="notice-card">
              <strong>Waiting</strong>
              <p>Your next book is loading.</p>
            </div>
          )}
        </section>

        <DisclosurePanel
          title="Round status"
          description="See who has already submitted this round."
          summary={`${publicState?.submittedCount ?? 0} submitted`}
        >
          <GameplayPlayerList
            players={roomState.players}
            playerId={playerId}
            hostId={roomState.hostId}
            getStatus={(player) => ({
              text: submittedNames.has(player.id) ? 'Done' : 'Working',
              tone: submittedNames.has(player.id) ? 'ready' : 'default'
            })}
          />
        </DisclosurePanel>
      </div>
    );
  }

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="panel-heading">
          <p className="status-pill">Reveal</p>
          <h2>All books are ready</h2>
          <p>Start with your own book, then scroll through everyone else&apos;s.</p>
        </div>

        <SummaryChips
          items={[
            { label: 'Books', value: books.length },
            { label: 'Rounds', value: publicState?.totalRounds ?? books[0]?.entries?.length ?? 0 },
            { label: 'Entries', value: selectedBook?.entries?.length ?? 0 }
          ]}
        />

        <div className="actions actions--stretch">
          <button
            className="secondary-action"
            disabled={!selectedBook}
            onClick={() =>
              exportDrawNGuessChainImage({
                entries: selectedBook.entries,
                playersById: new Map(
                  [...playersById.entries()].map(([id, player]) => [id, player?.name ?? 'Player'])
                ),
                title: `DrawNGuess: ${playersById.get(selectedBook.originPlayerId)?.name ?? 'Book'}`,
                subtitle: 'RVLRY reveal chain',
                filename: `drawnguess-${playersById.get(selectedBook.originPlayerId)?.name ?? 'book'}.png`
              })
            }
          >
            Export current book
          </button>
        </div>

        <ResultsActions
          isHost={isHost}
          roomCode={roomCode}
          gameId={roomState.gameId}
          onReturnToLobby={returnRoomToLobby}
          pendingAction={pendingAction}
        />
      </section>

      <DisclosurePanel
        title="Books"
        description="Pick any starting word and read its full chain."
        summary={`${books.length} books`}
        defaultOpen
      >
        <div className="actions actions--stretch">
          {books.map((book) => (
            <button
              key={book.id}
              className={selectedBook?.id === book.id ? '' : 'secondary-action'}
              onClick={() => setSelectedBookId(book.id)}
            >
              {book.id === privateState?.ownBookId ? 'Your book' : playersById.get(book.originPlayerId)?.name ?? 'Book'}
            </button>
          ))}
        </div>

        {selectedBook ? (
          <div className="results-chain">
            {selectedBook.entries.map((entry, index) => (
              <article key={`${selectedBook.id}-${entry.type}-${index}`} className="chain-item">
                <p className="chain-item__eyebrow">
                  {entry.type === 'prompt'
                    ? 'Original prompt'
                    : entry.type === 'drawing'
                      ? 'Drawing'
                      : 'Guess'}
                </p>
                {entry.type === 'drawing' ? (
                  <img className="drawing-preview" src={entry.imageData} alt={`Book step ${index + 1}`} />
                ) : (
                  <p className="stage-summary">{entry.text}</p>
                )}
                {entry.submittedBy ? (
                  <p className="helper-text">
                    Submitted by {playersById.get(entry.submittedBy)?.name ?? 'Player'}
                  </p>
                ) : (
                  <p className="helper-text">
                    Started by {playersById.get(selectedBook.originPlayerId)?.name ?? 'Player'}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="helper-text">Select a book to reveal its full chain.</p>
        )}
      </DisclosurePanel>
    </div>
  );
}

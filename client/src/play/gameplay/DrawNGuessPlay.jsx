import { useEffect, useMemo, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
import { DrawingPad, SummaryChips } from '../../components/gameplay/SharedGameUi';
import { DisclosurePanel, GameplayPlayerList, ResultsActions } from './common';

const exportBookAsImage = async ({ book, playersById }) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const width = 1080;
  const padding = 48;
  const blockGap = 28;
  const titleHeight = 140;
  const rowHeights = book.entries.map((entry) => (entry.type === 'drawing' ? 420 : 140));
  const height =
    titleHeight + padding * 2 + rowHeights.reduce((total, value) => total + value, 0) + blockGap * (rowHeights.length - 1);
  canvas.width = width;
  canvas.height = height;

  context.fillStyle = '#f4efe5';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#13211d';
  context.font = '700 46px Georgia, serif';
  context.fillText(
    `DrawNGuess: ${playersById.get(book.originPlayerId)?.name ?? 'Book'}`,
    padding,
    90
  );
  context.font = '500 28px Arial, sans-serif';
  context.fillText('RVLRY reveal chain', padding, 128);

  let y = titleHeight;
  for (const [index, entry] of book.entries.entries()) {
    const blockHeight = rowHeights[index];
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#d6cdbf';
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(padding, y, width - padding * 2, blockHeight, 28);
    context.fill();
    context.stroke();

    context.fillStyle = '#5b6059';
    context.font = '600 24px Arial, sans-serif';
    const label =
      entry.type === 'prompt' ? 'Prompt' : entry.type === 'drawing' ? 'Drawing' : 'Guess';
    context.fillText(label, padding + 26, y + 42);
    context.fillStyle = '#13211d';
    context.font = '600 26px Arial, sans-serif';
    if (entry.submittedBy) {
      context.fillText(
        playersById.get(entry.submittedBy)?.name ?? 'Player',
        padding + 150,
        y + 42
      );
    }

    if (entry.type === 'drawing') {
      const image = await new Promise((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = reject;
        nextImage.src = entry.imageData;
      });
      context.drawImage(image, padding + 26, y + 64, width - padding * 2 - 52, blockHeight - 90);
    } else {
      context.fillStyle = '#13211d';
      context.font = '500 36px Arial, sans-serif';
      context.fillText(entry.text ?? '', padding + 26, y + 92, width - padding * 2 - 52);
    }

    y += blockHeight + blockGap;
  }

  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `drawnguess-${playersById.get(book.originPlayerId)?.name ?? 'book'}.png`;
  link.click();
};

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
            onClick={() => exportBookAsImage({ book: selectedBook, playersById })}
          >
            Export current book
          </button>
        </div>

        <ResultsActions
          isHost={isHost}
          roomCode={roomCode}
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

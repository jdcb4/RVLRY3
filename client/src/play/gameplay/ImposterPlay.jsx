import { useEffect, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
import { SummaryChips } from '../../components/gameplay/SharedGameUi';
import { DisclosurePanel, GameplayPlayerList, ResultsActions } from './common';

export function ImposterPlay({
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

  useStageCue(stage, {
    voting: 'phase-change',
    results: 'results-reveal'
  });

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
          <p>Focus on the current move first.</p>
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

      <DisclosurePanel title="Players" description="See who is up next." summary={`${roomState.players.length} connected`}>
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

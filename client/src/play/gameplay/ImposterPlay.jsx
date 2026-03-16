import { useEffect, useState } from 'react';
import { useStageCue } from '../../audio/useGameAudio';
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
  const [selectedVotes, setSelectedVotes] = useState([]);
  const publicState = roomState.gamePublicState;
  const stage = publicState?.stage;
  const results = publicState?.results;
  const currentTurnName = playersById.get(publicState.currentTurnPlayerId)?.name ?? 'Waiting';
  const turnsTakenByPlayer = roomState.players.reduce((counts, player) => {
    counts[player.id] = publicState.clueTurns.filter((turn) => turn.playerId === player.id).length;
    return counts;
  }, {});

  useStageCue(stage, {
    discussion: 'phase-change',
    voting: 'phase-change',
    results: 'results-reveal'
  });

  useEffect(() => {
    setSelectedVotes(privateState?.votedForPlayerIds ?? []);
  }, [privateState?.votedForPlayerIds, stage, publicState?.currentTurnPlayerId]);

  const toggleVoteTarget = (targetPlayerId) => {
    const requiredVotes = privateState?.voteTargetCount ?? 1;
    setSelectedVotes((currentVotes) => {
      if (currentVotes.includes(targetPlayerId)) {
        return currentVotes.filter((playerId) => playerId !== targetPlayerId);
      }

      if (currentVotes.length >= requiredVotes) {
        return [...currentVotes.slice(1), targetPlayerId];
      }

      return [...currentVotes, targetPlayerId];
    });
  };

  return (
    <div className="gameplay-stack">
      <section className="panel panel--hero panel--stacked gameplay-primary">
        <div className="role-card">
          <span className="helper-text">Role</span>
          <strong className="role-card__title">{privateState?.role ?? 'Waiting'}</strong>
          <span className="helper-text">Word</span>
          <strong className="role-card__body">{privateState?.word ?? 'No word. Blend in.'}</strong>
        </div>

        <div className="panel-heading">
          <p className="status-pill">
            {stage === 'clues'
              ? `Round ${publicState.clueRound}`
              : stage === 'discussion'
                ? 'Discuss'
                : stage === 'voting'
                  ? 'Voting'
                  : 'Results'}
          </p>
        </div>

        {stage === 'clues' && privateState?.canAdvanceClueTurn && (
          <div className="field-stack">
            <div className="notice-card notice-card--focus">
              <strong>Your turn</strong>
              <p>Say one word out loud, then tap next.</p>
            </div>
            <button
              disabled={pendingAction === 'advance-clue-turn'}
              onClick={() => sendGameAction(roomCode, 'advance-clue-turn')}
            >
              Next player
            </button>
          </div>
        )}

        {stage === 'clues' && !privateState?.canAdvanceClueTurn && (
          <div className="notice-card">
            <strong>Listen</strong>
            <p>Listen to the other players while waiting for your turn.</p>
          </div>
        )}

        {stage === 'discussion' && (
          <div className="field-stack">
            <div className="notice-card notice-card--focus">
              <strong>Discuss as a group</strong>
              <p>Talk it through out loud, then open voting in the app.</p>
            </div>
            {privateState?.canStartVoting ? (
              <button
                disabled={pendingAction === 'start-voting'}
                onClick={() => sendGameAction(roomCode, 'start-voting')}
              >
                Start voting
              </button>
            ) : (
              <p className="helper-text">Waiting for the host to open voting.</p>
            )}
          </div>
        )}

        {stage === 'voting' && privateState?.canVote && (
          <div className="field-stack">
            <div className="notice-card">
              <strong>Discussed? Vote now.</strong>
              <p>
                Pick {privateState.voteTargetCount}{' '}
                {privateState.voteTargetCount === 1
                  ? 'player you think is the imposter.'
                  : 'players you think are the imposters.'}
              </p>
            </div>
            <div className="actions actions--stretch">
              {roomState.players
                .filter((player) => player.id !== playerId)
                .map((player) => (
                  <button
                    key={player.id}
                    className={selectedVotes.includes(player.id) ? '' : 'secondary-action'}
                    disabled={pendingAction === 'cast-vote'}
                    onClick={() => toggleVoteTarget(player.id)}
                  >
                    {selectedVotes.includes(player.id) ? 'Selected' : 'Select'} {player.name}
                  </button>
                ))}
            </div>
            <button
              disabled={
                pendingAction === 'cast-vote' ||
                selectedVotes.length !== (privateState?.voteTargetCount ?? 1)
              }
              onClick={() => sendGameAction(roomCode, 'cast-vote', { targetPlayerIds: selectedVotes })}
            >
              Lock vote
            </button>
          </div>
        )}

        {stage === 'voting' && privateState?.hasVoted && (
          <p className="helper-text">
            Vote locked for{' '}
            {(privateState.votedForPlayerIds ?? [])
              .map((targetPlayerId) => playersById.get(targetPlayerId)?.name ?? 'Player')
              .join(', ')}
            .
          </p>
        )}

        {stage === 'results' && results && (
          <div className="field-stack">
            <p className="stage-summary">
              {results.outcome === 'crew' ? 'Crew wins' : 'Imposter wins'}: {results.reason}
            </p>
            <p className="helper-text">
              The word was {results.secretWord}.{' '}
              {(results.imposterIds ?? [results.imposterId])
                .map((imposterId) => playersById.get(imposterId)?.name ?? 'Imposter')
                .join(', ')}{' '}
              {results.imposterIds?.length > 1 ? 'were the imposters.' : 'was the imposter.'}
            </p>
            <ResultsActions
              isHost={isHost}
              roomCode={roomCode}
              gameId={roomState.gameId}
              onReturnToLobby={returnRoomToLobby}
              pendingAction={pendingAction}
            />
          </div>
        )}
      </section>

      <DisclosurePanel
        title={stage === 'results' ? 'Vote board' : 'Players'}
        description={stage === 'results' ? 'See how the room voted and who was accused.' : null}
        summary={
          stage === 'results'
            ? `${results?.voteTally?.length ?? 0} players`
            : `${publicState.clueCount} / ${publicState.totalTurns} turns`
        }
        defaultOpen={stage === 'results'}
      >
        {stage === 'results' && results ? (
          <ul className="player-list">
            {results.voteTally.map((entry) => (
              <li key={entry.playerId} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{playersById.get(entry.playerId)?.name ?? 'Player'}</span>
                  <div className="player-row__meta">
                    {(results.imposterIds ?? [results.imposterId]).includes(entry.playerId) && <span className="badge badge--host">Imposter</span>}
                    {(results.accusedPlayerIds ?? [results.accusedPlayerId]).includes(entry.playerId) && <span className="badge badge--self">Accused</span>}
                  </div>
                </div>
                <span className="badge">{entry.votes} vote(s)</span>
              </li>
            ))}
          </ul>
        ) : (
          <GameplayPlayerList
            players={roomState.players}
            playerId={playerId}
            hostId={roomState.hostId}
            getStatus={(player) => ({
              text:
                stage === 'clues'
                  ? `${turnsTakenByPlayer[player.id] ?? 0}/${publicState.totalClueRounds}`
                  : stage === 'voting' && (privateState?.votedForPlayerIds ?? []).includes(player.id)
                    ? 'Accused'
                    : stage === 'discussion'
                      ? 'Discuss'
                      : 'Waiting',
              tone:
                player.id === publicState.currentTurnPlayerId && stage === 'clues' ? 'ready' : 'default'
            })}
          />
        )}
      </DisclosurePanel>
    </div>
  );
}

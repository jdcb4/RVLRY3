import { useEffect, useMemo, useState } from 'react';
import { fetchHatGameSuggestions } from '../../games/contentApi';
import { InfoIcon, ShuffleIcon, UsersIcon } from '../../components/Icons';
import { HATGAME_MAX_CLUE_LENGTH, buildTeamRosters } from './helpers';
import { LobbyDisclosure, TeamCard } from './common';

export function HatGameLobby({
  roomCode,
  roomState,
  currentPlayer,
  isHost,
  pendingAction,
  teamNameDrafts,
  setTeamNameDraft,
  settingsForm,
  updateSetting,
  updateTeamName,
  assignTeam,
  rebalanceTeams,
  lobbyPrivateState,
  submitHatClues,
  setError,
  error,
  onToast,
  onPlaySubmitCue
}) {
  const teamRosters = useMemo(() => buildTeamRosters(roomState), [roomState]);
  const requiredClues =
    roomState.lobbyState?.requiredCluesPerPlayer ??
    roomState.settings?.cluesPerPlayer ??
    settingsForm.cluesPerPlayer ??
    6;
  const clueCountsByPlayerId = roomState.lobbyState?.clueCountsByPlayerId ?? {};
  const [clueDrafts, setClueDrafts] = useState(() =>
    Array.from({ length: requiredClues }, () => '')
  );
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const submittedClues = Array.isArray(lobbyPrivateState?.clues) ? lobbyPrivateState.clues : [];

    setClueDrafts((currentDrafts) => {
      if (submittedClues.length > 0) {
        return Array.from({ length: requiredClues }, (_, index) => submittedClues[index] ?? '');
      }

      if (currentDrafts.length !== requiredClues) {
        return Array.from({ length: requiredClues }, (_, index) => currentDrafts[index] ?? '');
      }

      return currentDrafts.length > 0
        ? currentDrafts
        : Array.from({ length: requiredClues }, () => '');
    });
  }, [lobbyPrivateState?.clues, requiredClues]);

  const savedCount = lobbyPrivateState?.submittedCount ?? 0;

  const handleGenerateSuggestions = async () => {
    setError('');
    setLoadingSuggestions(true);

    try {
      const suggestions = await fetchHatGameSuggestions(requiredClues);
      setClueDrafts((currentDrafts) =>
        Array.from(
          { length: requiredClues },
          (_, index) => suggestions[index] ?? currentDrafts[index] ?? ''
        )
      );
      onToast('Who-list suggestions loaded');
      onPlaySubmitCue();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Unable to generate HatGame clues right now'
      );
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleClueChange = (index, value) => {
    setClueDrafts((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) => (draftIndex === index ? value : draft))
    );
  };

  const handleSubmit = async () => {
    const normalizedClues = clueDrafts.map((clue) => clue.trim());
    if (normalizedClues.some((clue) => clue.length === 0)) {
      setError('Fill in every clue before saving');
      return;
    }

    const response = await submitHatClues(normalizedClues);
    if (response.ok) {
      onToast('Clues saved');
      onPlaySubmitCue();
    }
  };

  const handleRebalance = async () => {
    const response = await rebalanceTeams(roomCode);
    if (response.ok) {
      onToast('Teams rebalanced');
    }
  };

  return (
    <section className="panel panel--stacked">
      <div className="panel-heading">
        <h2>Teams</h2>
        <p>Join a team first, then finish your clue pack.</p>
      </div>

      {error && <p className="connection-banner connection-banner--error">{error}</p>}

      <div className="team-grid">
        {teamRosters.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            currentPlayer={currentPlayer}
            isHost={isHost}
            roomCode={roomCode}
            pendingAction={pendingAction}
            teamNameDraft={teamNameDrafts[team.id] ?? team.name}
            setTeamNameDraft={setTeamNameDraft}
            onSaveTeamName={updateTeamName}
            onAssignTeam={assignTeam}
          />
        ))}
      </div>

      <LobbyDisclosure
        title="Team options"
        summary={`${settingsForm.teamCount} teams`}
        icon={<UsersIcon />}
      >
        <div className="field-stack">
          <label className="settings-field">
            <span className="helper-text">Teams</span>
            <select
              value={settingsForm.teamCount}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('teamCount', Number.parseInt(event.target.value, 10))}
            >
              <option value={2}>2 teams</option>
              <option value={3}>3 teams</option>
              <option value={4}>4 teams</option>
            </select>
          </label>

          {isHost ? (
            <button
              className="secondary-action"
              disabled={pendingAction === 'rebalance-teams'}
              onClick={handleRebalance}
            >
              <ShuffleIcon />
              Rebalance teams
            </button>
          ) : null}
        </div>
      </LobbyDisclosure>

      <LobbyDisclosure
        title="Round options"
        summary={`${settingsForm.turnDurationSeconds}s turns, ${settingsForm.cluesPerPlayer} clues each`}
        icon={<InfoIcon />}
      >
        <div className="settings-grid">
          <label className="settings-field">
            <span className="helper-text">Turn length</span>
            <select
              value={settingsForm.turnDurationSeconds}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) =>
                updateSetting('turnDurationSeconds', Number.parseInt(event.target.value, 10))
              }
            >
              <option value={30}>30 seconds</option>
              <option value={45}>45 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
              <option value={120}>120 seconds</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="helper-text">Clues each</span>
            <select
              value={settingsForm.cluesPerPlayer}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) =>
                updateSetting('cluesPerPlayer', Number.parseInt(event.target.value, 10))
              }
            >
              <option value={3}>3 clues</option>
              <option value={4}>4 clues</option>
              <option value={5}>5 clues</option>
              <option value={6}>6 clues</option>
              <option value={7}>7 clues</option>
              <option value={8}>8 clues</option>
              <option value={9}>9 clues</option>
              <option value={10}>10 clues</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="helper-text">Skips per turn</span>
            <select
              value={settingsForm.skipsPerTurn}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) =>
                updateSetting('skipsPerTurn', Number.parseInt(event.target.value, 10))
              }
            >
              <option value={0}>0 skips</option>
              <option value={1}>1 skip</option>
              <option value={2}>2 skips</option>
              <option value={3}>3 skips</option>
              <option value={4}>4 skips</option>
              <option value={5}>5 skips</option>
            </select>
          </label>
        </div>
      </LobbyDisclosure>

      <LobbyDisclosure
        title="Your clues"
        summary={`${savedCount} / ${requiredClues} saved on this device`}
        icon={<InfoIcon />}
        open={savedCount < requiredClues}
      >
        <div className="field-stack">
          {clueDrafts.map((clue, index) => (
            <label key={`hat-clue-${index}`} className="settings-field">
              <span className="helper-text">Clue {index + 1}</span>
              <input
                value={clue}
                maxLength={HATGAME_MAX_CLUE_LENGTH}
                placeholder="Enter a person name"
                onChange={(event) => handleClueChange(index, event.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="actions actions--stretch">
          <button
            className="secondary-action"
            disabled={loadingSuggestions}
            onClick={handleGenerateSuggestions}
          >
            {loadingSuggestions ? 'Loading suggestions' : 'Who list'}
          </button>
          <button disabled={pendingAction === 'submit-hat-clues'} onClick={handleSubmit}>
            Save clues
          </button>
        </div>
      </LobbyDisclosure>

      <LobbyDisclosure
        title="Submission status"
        summary={`${Object.values(clueCountsByPlayerId).filter((count) => count === requiredClues).length} ready`}
        icon={<InfoIcon />}
      >
        <ul className="player-list">
          {roomState.players.map((player) => {
            const clueCount = clueCountsByPlayerId[player.id] ?? 0;
            const isSubmitted = clueCount === requiredClues;

            return (
              <li key={player.id} className="player-row player-row--compact">
                <div className="player-row__identity">
                  <span className="player-row__name">{player.name}</span>
                  <div className="player-row__meta">
                    {player.id === currentPlayer?.id && <span className="badge badge--self">You</span>}
                    {player.id === roomState.hostId && <span className="badge badge--host">Host</span>}
                  </div>
                </div>
                <span className={isSubmitted ? 'badge badge--ready' : 'badge'}>
                  {clueCount} / {requiredClues}
                </span>
              </li>
            );
          })}
        </ul>
      </LobbyDisclosure>
    </section>
  );
}

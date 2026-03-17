import { useCallback, useEffect, useMemo, useState } from 'react';
import { InfoPopover } from '../../components/InfoPopover';
import { InfoIcon, ShuffleIcon, UsersIcon } from '../../components/Icons';
import { fetchHatGameSuggestions } from '../../games/contentApi';
import { HATGAME_MAX_CLUE_LENGTH, buildTeamRosters } from './helpers';
import { LobbyDisclosure, LobbySettingList, TeamCard } from './common';

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
  kickPlayer,
  lobbyPrivateState,
  submitHatClues,
  registerHatReadyHandler,
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
  const optionsSummary = `${settingsForm.teamCount} teams / ${settingsForm.turnDurationSeconds}s / ${settingsForm.cluesPerPlayer} clues / ${settingsForm.skipsPerTurn} skip${settingsForm.skipsPerTurn === 1 ? '' : 's'}`;
  const optionsList = [
    { label: 'Teams', value: `${settingsForm.teamCount}` },
    { label: 'Turn length', value: `${settingsForm.turnDurationSeconds}s` },
    { label: 'Clues each', value: `${settingsForm.cluesPerPlayer}` },
    { label: 'Skips per turn', value: `${settingsForm.skipsPerTurn}` }
  ];

  const handleGenerateSuggestions = async () => {
    setError('');
    setLoadingSuggestions(true);

    try {
      const suggestions = await fetchHatGameSuggestions(requiredClues);
      setClueDrafts((currentDrafts) =>
        Array.from(
          { length: requiredClues },
          (_, index) =>
            currentDrafts[index]?.trim().length > 0
              ? currentDrafts[index]
              : suggestions[index] ?? currentDrafts[index] ?? ''
        )
      );
      onToast('Suggestions loaded');
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

  const handleSubmit = useCallback(async () => {
    const normalizedClues = clueDrafts.map((clue) => clue.trim());
    if (normalizedClues.some((clue) => clue.length === 0)) {
      onToast(`Fill in all ${requiredClues} clues before readying up.`);
      return { error: 'Fill in every clue before saving' };
    }

    const response = await submitHatClues(normalizedClues);
    if (response.ok) {
      onPlaySubmitCue();
      return response;
    }

    onToast(response.error ?? 'Unable to save clues right now');
    return response;
  }, [clueDrafts, onPlaySubmitCue, onToast, requiredClues, submitHatClues]);

  useEffect(() => {
    if (!registerHatReadyHandler) {
      return undefined;
    }

    return registerHatReadyHandler(handleSubmit);
  }, [handleSubmit, registerHatReadyHandler]);

  const handleRebalance = async () => {
    const response = await rebalanceTeams(roomCode);
    if (response.ok) {
      onToast('Teams rebalanced');
    }
  };

  return (
    <section className="panel panel--stacked">
      {error ? <p className="connection-banner connection-banner--error">{error}</p> : null}

      <LobbyDisclosure
        title="Your clues"
        summary={`${savedCount} / ${requiredClues} saved on this device`}
        icon={<InfoIcon />}
        open={savedCount < requiredClues}
      >
        <div className="inline-heading">
          <strong>Clue pack</strong>
          <InfoPopover
            label="Hat Game clue writing tips"
            title="What belongs in a Hat Game clue pack?"
          >
            <ul className="compact-list">
              <li>Write names most of the room should know, real or fictional.</li>
              <li>Use one specific person per clue, not a group or category.</li>
              <li>You should be able to explain why they are famous in five seconds.</li>
              <li>Mix history, pop culture, athletes, and fictional characters.</li>
            </ul>
          </InfoPopover>
        </div>

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
            {loadingSuggestions ? 'Loading suggestions' : 'Give me suggestions'}
          </button>
        </div>
      </LobbyDisclosure>

      <LobbyDisclosure title="Teams" summary={`${teamRosters.length} teams`} icon={<UsersIcon />}>
        <div className="team-grid">
          {teamRosters.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              currentPlayer={currentPlayer}
              hostId={roomState.hostId}
              isHost={isHost}
              roomCode={roomCode}
              pendingAction={pendingAction}
              teamNameDraft={teamNameDrafts[team.id] ?? team.name}
              setTeamNameDraft={setTeamNameDraft}
              onSaveTeamName={updateTeamName}
              onAssignTeam={assignTeam}
              onKickPlayer={kickPlayer}
              onToast={onToast}
            />
          ))}
        </div>
      </LobbyDisclosure>

      <LobbyDisclosure
        title="Options"
        summary={optionsSummary}
        icon={<InfoIcon />}
        open={isHost}
      >
        {isHost ? (
          <div className="field-stack">
            <div className="settings-grid">
              <label className="settings-field">
                <span className="helper-text">Teams</span>
                <select
                  value={settingsForm.teamCount}
                  disabled={pendingAction === 'update-settings'}
                  onChange={(event) =>
                    updateSetting('teamCount', Number.parseInt(event.target.value, 10))
                  }
                >
                  <option value={2}>2 teams</option>
                  <option value={3}>3 teams</option>
                  <option value={4}>4 teams</option>
                </select>
              </label>

              <label className="settings-field">
                <span className="helper-text">Turn length</span>
                <select
                  value={settingsForm.turnDurationSeconds}
                  disabled={pendingAction === 'update-settings'}
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
                  disabled={pendingAction === 'update-settings'}
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
                  disabled={pendingAction === 'update-settings'}
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

            <button
              className="secondary-action"
              disabled={pendingAction === 'rebalance-teams'}
              onClick={handleRebalance}
            >
              <ShuffleIcon />
              Rebalance teams
            </button>
          </div>
        ) : (
          <LobbySettingList items={optionsList} />
        )}
      </LobbyDisclosure>
    </section>
  );
}

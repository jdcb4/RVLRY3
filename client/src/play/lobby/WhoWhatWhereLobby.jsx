import { useMemo } from 'react';
import { InfoIcon, ShuffleIcon, UsersIcon } from '../../components/Icons';
import { buildTeamRosters } from './helpers';
import { LobbyDisclosure, LobbySettingList, TeamCard } from './common';

export function WhoWhatWhereLobby({
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
  error,
  onToast
}) {
  const teamRosters = useMemo(() => buildTeamRosters(roomState), [roomState]);
  const optionsSummary = `${settingsForm.teamCount} teams / ${settingsForm.turnDurationSeconds}s`;
  const optionsList = [
    { label: 'Teams', value: `${settingsForm.teamCount}` },
    { label: 'Turn length', value: `${settingsForm.turnDurationSeconds}s` },
    { label: 'Rounds', value: `${settingsForm.totalRounds}` },
    {
      label: 'Skipped words',
      value: settingsForm.skipLimit < 0 ? 'Unlimited' : `${settingsForm.skipLimit}`
    }
  ];

  const handleRebalance = async () => {
    const response = await rebalanceTeams(roomCode);
    if (response.ok) {
      onToast('Teams rebalanced');
    }
  };

  return (
    <section className="panel panel--stacked">
      {error ? <p className="connection-banner connection-banner--error">{error}</p> : null}

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
                  <option value={75}>75 seconds</option>
                </select>
              </label>

              <label className="settings-field">
                <span className="helper-text">Rounds</span>
                <select
                  value={settingsForm.totalRounds}
                  disabled={pendingAction === 'update-settings'}
                  onChange={(event) =>
                    updateSetting('totalRounds', Number.parseInt(event.target.value, 10))
                  }
                >
                  <option value={2}>2 rounds</option>
                  <option value={3}>3 rounds</option>
                  <option value={4}>4 rounds</option>
                  <option value={5}>5 rounds</option>
                </select>
              </label>

              <label className="settings-field">
                <span className="helper-text">Skips allowed</span>
                <select
                  value={String(settingsForm.skipLimit)}
                  disabled={pendingAction === 'update-settings'}
                  onChange={(event) =>
                    updateSetting(
                      'skipLimit',
                      event.target.value === 'unlimited'
                        ? 'unlimited'
                        : Number.parseInt(event.target.value, 10)
                    )
                  }
                >
                  <option value={1}>1 skip</option>
                  <option value={2}>2 skips</option>
                  <option value={3}>3 skips</option>
                  <option value="unlimited">Unlimited</option>
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

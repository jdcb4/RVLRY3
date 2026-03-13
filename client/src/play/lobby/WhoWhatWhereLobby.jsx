import { useMemo } from 'react';
import { InfoIcon, ShuffleIcon, UsersIcon } from '../../components/Icons';
import { buildTeamRosters } from './helpers';
import { LobbyDisclosure, TeamCard } from './common';

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
  error,
  onToast
}) {
  const teamRosters = useMemo(() => buildTeamRosters(roomState), [roomState]);

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
        <p>Pick a team. The host can rebalance if the room gets uneven.</p>
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
        title="Match options"
        summary={`${settingsForm.turnDurationSeconds}s turns, ${settingsForm.totalRounds} rounds`}
        icon={<InfoIcon />}
      >
        <div className="settings-grid">
          <label className="settings-field">
            <span className="helper-text">Turn length</span>
            <select
              value={settingsForm.turnDurationSeconds}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('turnDurationSeconds', Number.parseInt(event.target.value, 10))}
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
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('totalRounds', Number.parseInt(event.target.value, 10))}
            >
              <option value={2}>2 rounds</option>
              <option value={3}>3 rounds</option>
              <option value={4}>4 rounds</option>
              <option value={5}>5 rounds</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="helper-text">Free skips</span>
            <select
              value={settingsForm.freeSkips}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('freeSkips', Number.parseInt(event.target.value, 10))}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="helper-text">Skip penalty</span>
            <select
              value={settingsForm.skipPenalty}
              disabled={!isHost || pendingAction === 'update-settings'}
              onChange={(event) => updateSetting('skipPenalty', Number.parseInt(event.target.value, 10))}
            >
              <option value={0}>0 points</option>
              <option value={1}>1 point</option>
              <option value={2}>2 points</option>
            </select>
          </label>
        </div>
      </LobbyDisclosure>
    </section>
  );
}

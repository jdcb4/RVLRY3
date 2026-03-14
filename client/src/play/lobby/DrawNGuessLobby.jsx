import { InfoIcon } from '../../components/Icons';
import { LobbyDisclosure, LobbySettingList } from './common';
import { StandardLobby } from './StandardLobby';

export function DrawNGuessLobby({
  isHost,
  pendingAction,
  settingsForm,
  updateSetting,
  ...props
}) {
  const options = [{ label: 'Round length', value: `${settingsForm.roundDurationSeconds}s` }];

  return (
    <>
      <StandardLobby {...props} isHost={isHost} pendingAction={pendingAction} />
      <section className="panel panel--stacked">
        <LobbyDisclosure
          title="Options"
          summary={`${settingsForm.roundDurationSeconds}s rounds`}
          icon={<InfoIcon />}
        >
          {isHost ? (
            <div className="settings-grid">
              <label className="settings-field">
                <span className="helper-text">Round length</span>
                <select
                  value={settingsForm.roundDurationSeconds}
                  disabled={pendingAction === 'update-settings'}
                  onChange={(event) =>
                    updateSetting('roundDurationSeconds', Number.parseInt(event.target.value, 10))
                  }
                >
                  <option value={30}>30 seconds</option>
                  <option value={45}>45 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </label>
            </div>
          ) : (
            <LobbySettingList items={options} />
          )}
        </LobbyDisclosure>
      </section>
    </>
  );
}

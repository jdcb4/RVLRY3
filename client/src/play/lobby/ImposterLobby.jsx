import { InfoIcon } from '../../components/Icons';
import { LobbyDisclosure, LobbySettingList } from './common';
import { StandardLobby } from './StandardLobby';

export function ImposterLobby({
  isHost,
  pendingAction,
  settingsForm,
  updateSetting,
  ...props
}) {
  const options = [
    { label: 'Spoken rounds', value: `${settingsForm.rounds}` },
    { label: 'Imposters', value: `${settingsForm.imposterCount}` }
  ];

  return (
    <>
      <StandardLobby {...props} isHost={isHost} pendingAction={pendingAction} />
      <section className="panel panel--stacked">
        <LobbyDisclosure title="Options" summary={`${settingsForm.rounds} rounds`} icon={<InfoIcon />}>
          {isHost ? (
            <div className="settings-grid">
              <label className="settings-field">
                <span className="helper-text">Spoken rounds</span>
                <select
                  value={settingsForm.rounds}
                  disabled={pendingAction === 'update-settings'}
                  onChange={(event) =>
                    updateSetting('rounds', Number.parseInt(event.target.value, 10))
                  }
                >
                  <option value={1}>1 round</option>
                  <option value={2}>2 rounds</option>
                  <option value={3}>3 rounds</option>
                  <option value={4}>4 rounds</option>
                </select>
              </label>

              <label className="settings-field">
                <span className="helper-text">Imposters</span>
                <select
                  value={settingsForm.imposterCount}
                  disabled={pendingAction === 'update-settings'}
                  onChange={(event) =>
                    updateSetting('imposterCount', Number.parseInt(event.target.value, 10))
                  }
                >
                  <option value={1}>1 imposter</option>
                  <option value={2}>2 imposters</option>
                  <option value={3}>3 imposters</option>
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

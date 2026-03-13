import {
  MAX_LOCAL_HATGAME_CLUE_LENGTH
} from '../../local/session';
import { buildEmptyHatGameClues, LOCAL_PLAYER_LIMIT } from './helpers';

export function HandoffPanel({
  pill,
  title,
  description,
  targetName,
  isRevealed,
  onReveal,
  onHide,
  children,
  footer = null,
  revealLabel,
  hideLabel = 'Hide screen'
}) {
  const nextRevealLabel =
    revealLabel ?? (targetName ? `${targetName} ready` : 'Ready');

  return (
    <section className="panel panel--hero panel--stacked">
      <div className="panel-heading">
        <p className="status-pill">{pill}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {!isRevealed ? (
        <div className="notice-card local-handoff">
          <strong>{targetName ? `Pass phone to ${targetName}.` : 'Pass the phone.'}</strong>
          <p>{targetName ? `${targetName} taps ready when everyone else is looking away.` : 'Reveal only when the correct player has the phone.'}</p>
        </div>
      ) : (
        children
      )}

      <div className="actions actions--stretch">
        <button onClick={isRevealed ? onHide : onReveal}>
          {isRevealed ? hideLabel : nextRevealLabel}
        </button>
        {footer}
      </div>
    </section>
  );
}

export function LocalPlayersEditor({
  players,
  teams,
  onRenamePlayer,
  onTeamChange,
  onAddPlayer,
  onRemovePlayer,
  onAutoBalance,
  showHeading = true
}) {
  return (
    <section className="panel panel--stacked">
      {showHeading ? (
        <div className="panel-heading">
          <h2>Players</h2>
          <p>Name everyone first so handoffs stay clear.</p>
        </div>
      ) : null}

      <div className="local-toolbar">
        <button
          className="secondary-action"
          disabled={players.length >= LOCAL_PLAYER_LIMIT}
          onClick={onAddPlayer}
        >
          Add player
        </button>
        {teams.length > 0 && (
          <button className="secondary-action" onClick={onAutoBalance}>
            Auto-balance teams
          </button>
        )}
      </div>

      <div className="local-player-grid">
        {players.map((player, index) => (
          <article key={player.id} className="local-player-card">
            <label className="settings-field">
              <span className="helper-text">Player {index + 1}</span>
              <input
                value={player.name}
                maxLength={24}
                onChange={(event) => onRenamePlayer(player.id, event.target.value)}
              />
            </label>

            {teams.length > 0 && (
              <label className="settings-field">
                <span className="helper-text">Team</span>
                <select
                  value={player.teamId ?? teams[0]?.id ?? ''}
                  onChange={(event) => onTeamChange(player.id, event.target.value)}
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              className="secondary-action"
              disabled={players.length <= 2}
              onClick={() => onRemovePlayer(player.id)}
            >
              Remove
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LocalHatGameClueEditor({
  players,
  clueSubmissions,
  cluesPerPlayer,
  busyAction,
  onChangeClue,
  onGenerateClues,
  showHeading = true
}) {
  return (
    <section className="panel panel--stacked">
      {showHeading ? (
        <div className="panel-heading">
          <h2>Clue packs</h2>
          <p>Add person names here. The Who list button gives each player an editable draft.</p>
        </div>
      ) : null}

      <div className="local-player-grid">
        {players.map((player) => {
          const clues =
            clueSubmissions[player.id]?.clues ?? buildEmptyHatGameClues(cluesPerPlayer);
          const readyCount = clues.filter((clue) => clue.trim().length > 0).length;
          const isComplete = readyCount === cluesPerPlayer;

          return (
            <details
              key={`hat-setup-${player.id}`}
              className="local-player-card disclosure disclosure--subtle"
              open={!isComplete}
            >
              <summary className="disclosure__summary disclosure__summary--compact">
                <div className="disclosure__summary-copy">
                  <h3>{player.name}</h3>
                  <p>
                    {readyCount} / {cluesPerPlayer} ready
                  </p>
                </div>
                <span className={isComplete ? 'badge badge--ready' : 'badge'}>
                  {isComplete ? 'Ready' : 'Editing'}
                </span>
              </summary>
              <div className="disclosure__body field-stack">
                <div className="field-stack">
                  {clues.map((clue, index) => (
                    <label key={`${player.id}-clue-${index}`} className="settings-field">
                      <span className="helper-text">Clue {index + 1}</span>
                      <input
                        value={clue}
                        maxLength={MAX_LOCAL_HATGAME_CLUE_LENGTH}
                        placeholder="Enter a person name"
                        onChange={(event) =>
                          onChangeClue(player.id, index, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>

                <button
                  className="secondary-action"
                  disabled={busyAction === `generate-hat-clues:${player.id}`}
                  onClick={() => onGenerateClues(player.id)}
                >
                  {busyAction === `generate-hat-clues:${player.id}`
                    ? 'Loading suggestions'
                    : 'Generate from Who list'}
                </button>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export function ResultsActions({ onPlayAgain, onResetSetup, busyAction }) {
  return (
    <div className="actions actions--stretch">
      <button disabled={busyAction === 'restart'} onClick={onPlayAgain}>
        Play another round
      </button>
      <button className="secondary-action" onClick={onResetSetup}>
        Back to setup
      </button>
    </div>
  );
}

export function WhoWhatWhereSettingsCard({ settings, onChange, showHeading = true }) {
  return (
    <section className="settings-card">
      {showHeading ? (
        <div className="panel-heading">
          <h3>Match settings</h3>
        </div>
      ) : null}

      <div className="settings-grid">
        <label className="settings-field">
          <span className="helper-text">Teams</span>
          <select
            value={settings.teamCount}
            onChange={(event) =>
              onChange('teamCount', Number.parseInt(event.target.value, 10))
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
            value={settings.turnDurationSeconds}
            onChange={(event) =>
              onChange('turnDurationSeconds', Number.parseInt(event.target.value, 10))
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
            value={settings.totalRounds}
            onChange={(event) =>
              onChange('totalRounds', Number.parseInt(event.target.value, 10))
            }
          >
            <option value={1}>1 round</option>
            <option value={2}>2 rounds</option>
            <option value={3}>3 rounds</option>
            <option value={4}>4 rounds</option>
          </select>
        </label>

        <label className="settings-field">
          <span className="helper-text">Free skips</span>
          <select
            value={settings.freeSkips}
            onChange={(event) =>
              onChange('freeSkips', Number.parseInt(event.target.value, 10))
            }
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
            value={settings.skipPenalty}
            onChange={(event) =>
              onChange('skipPenalty', Number.parseInt(event.target.value, 10))
            }
          >
            <option value={0}>0 points</option>
            <option value={1}>1 point</option>
            <option value={2}>2 points</option>
          </select>
        </label>
      </div>
    </section>
  );
}

export function HatGameSettingsCard({ settings, onChange, showHeading = true }) {
  return (
    <section className="settings-card">
      {showHeading ? (
        <div className="panel-heading">
          <h3>Round settings</h3>
        </div>
      ) : null}

      <div className="settings-grid">
        <label className="settings-field">
          <span className="helper-text">Teams</span>
          <select
            value={settings.teamCount}
            onChange={(event) =>
              onChange('teamCount', Number.parseInt(event.target.value, 10))
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
            value={settings.turnDurationSeconds}
            onChange={(event) =>
              onChange('turnDurationSeconds', Number.parseInt(event.target.value, 10))
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
            value={settings.cluesPerPlayer}
            onChange={(event) =>
              onChange('cluesPerPlayer', Number.parseInt(event.target.value, 10))
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
            value={settings.skipsPerTurn}
            onChange={(event) =>
              onChange('skipsPerTurn', Number.parseInt(event.target.value, 10))
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
    </section>
  );
}

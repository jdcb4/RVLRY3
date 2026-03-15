import { useEffect, useState } from 'react';
import { ArrowRightIcon, CheckIcon, PencilIcon, ShuffleIcon } from '../Icons';
import { MAX_LOCAL_HATGAME_CLUE_LENGTH } from '../../local/session';
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
  hideLabel = 'Hide screen',
  showHideButton = true
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
          <p>
            {targetName
              ? `${targetName} taps ready when everyone else is looking away.`
              : 'Reveal only when the correct player has the phone.'}
          </p>
        </div>
      ) : (
        children
      )}

      <div className="actions actions--stretch">
        {!isRevealed || showHideButton ? (
          <button onClick={isRevealed ? onHide : onReveal}>
            {isRevealed ? hideLabel : nextRevealLabel}
          </button>
        ) : null}
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
  minimumPlayers = 2,
  showHeading = true,
  showAddButton = true,
  showRemoveButton = true,
  compactNames = false
}) {
  const [editingPlayerId, setEditingPlayerId] = useState(null);

  useEffect(() => {
    if (!editingPlayerId) {
      return;
    }

    if (!players.some((player) => player.id === editingPlayerId)) {
      setEditingPlayerId(null);
    }
  }, [editingPlayerId, players]);

  return (
    <section className="panel panel--stacked">
      {showHeading ? (
        <div className="panel-heading">
          <h2>Players</h2>
          <p>Name everyone first so handoffs stay clear.</p>
        </div>
      ) : null}

      {showAddButton || (teams.length > 0 && onAutoBalance) ? (
        <div className="local-toolbar">
          {showAddButton ? (
            <button
              className="secondary-action"
              disabled={players.length >= LOCAL_PLAYER_LIMIT}
              onClick={onAddPlayer}
            >
              Add player
            </button>
          ) : null}
          {teams.length > 0 && onAutoBalance ? (
            <button className="secondary-action" onClick={onAutoBalance}>
              Auto-balance teams
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="local-player-grid">
        {players.map((player, index) => (
          <article
            key={player.id}
            className={
              compactNames
                ? 'local-player-card local-player-card--compact-name'
                : 'local-player-card'
            }
          >
            {compactNames ? (
              <div className="local-player-inline">
                {editingPlayerId === player.id ? (
                  <input
                    autoFocus
                    value={player.name}
                    maxLength={24}
                    onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                  />
                ) : (
                  <strong className="local-player-inline__name">
                    {player.name || `Player ${index + 1}`}
                  </strong>
                )}

                <button
                  type="button"
                  className="secondary-action secondary-action--icon"
                  aria-label={
                    editingPlayerId === player.id
                      ? `Finish editing ${player.name || `Player ${index + 1}`}`
                      : `Edit ${player.name || `Player ${index + 1}`}`
                  }
                  onClick={() =>
                    setEditingPlayerId((currentId) =>
                      currentId === player.id ? null : player.id
                    )
                  }
                >
                  {editingPlayerId === player.id ? <CheckIcon /> : <PencilIcon />}
                </button>
              </div>
            ) : (
              <label className="settings-field">
                <span className="helper-text">Player {index + 1}</span>
                <input
                  value={player.name}
                  maxLength={24}
                  onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                />
              </label>
            )}

            {teams.length > 0 ? (
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
            ) : null}

            {showRemoveButton ? (
              <button
                className="secondary-action"
                disabled={players.length <= minimumPlayers}
                onClick={() => onRemovePlayer(player.id)}
              >
                Remove
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function LocalTeamRosterEditor({
  teams,
  players,
  onRenameTeam,
  onRenamePlayer,
  onMovePlayer,
  onAutoBalance,
  onToast,
  showHeading = true
}) {
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [movingPlayerId, setMovingPlayerId] = useState(null);

  useEffect(() => {
    if (editingTeamId && !teams.some((team) => team.id === editingTeamId)) {
      setEditingTeamId(null);
    }
  }, [editingTeamId, teams]);

  useEffect(() => {
    if (editingPlayerId && !players.some((player) => player.id === editingPlayerId)) {
      setEditingPlayerId(null);
    }
  }, [editingPlayerId, players]);

  useEffect(() => {
    if (movingPlayerId && !players.some((player) => player.id === movingPlayerId)) {
      setMovingPlayerId(null);
    }
  }, [movingPlayerId, players]);

  return (
    <section className="panel panel--stacked">
      <div className="team-setup__heading">
        <div className="panel-heading">
          {showHeading ? <h2>Teams</h2> : null}
          <p>Set up the teams</p>
        </div>
        <button
          type="button"
          className="icon-button icon-button--subtle"
          aria-label="Auto-balance teams"
          onClick={() => {
            onAutoBalance();
            onToast?.('Teams auto-balanced');
          }}
        >
          <ShuffleIcon />
        </button>
      </div>

      <div className="team-grid">
        {teams.map((team) => {
          const roster = players.filter((player) => player.teamId === team.id);
          return (
            <article key={team.id} className="team-card">
              <div className="team-card__title-inline">
                {editingTeamId === team.id ? (
                  <>
                    <input
                      autoFocus
                      value={team.name}
                      maxLength={24}
                      onChange={(event) => onRenameTeam(team.id, event.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-button icon-button--subtle"
                      aria-label={`Finish editing ${team.name}`}
                      onClick={() => setEditingTeamId(null)}
                    >
                      <CheckIcon />
                    </button>
                  </>
                ) : (
                  <>
                    <h3>{team.name}</h3>
                    <button
                      type="button"
                      className="icon-button icon-button--subtle"
                      aria-label={`Edit ${team.name}`}
                      onClick={() => setEditingTeamId(team.id)}
                    >
                      <PencilIcon />
                    </button>
                  </>
                )}
              </div>

              {roster.length > 0 ? (
                <ul className="player-list">
                  {roster.map((player, index) => (
                    <li
                      key={player.id}
                      className={
                        movingPlayerId === player.id
                          ? 'player-row player-row--compact player-row--stacked'
                          : 'player-row player-row--compact'
                      }
                    >
                      <div className="player-row__identity">
                        {editingPlayerId === player.id ? (
                          <input
                            autoFocus
                            value={player.name}
                            maxLength={24}
                            onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                          />
                        ) : (
                          <span className="player-row__name">{player.name || `Player ${index + 1}`}</span>
                        )}
                      </div>
                      <div className="team-card__player-actions">
                        <button
                          type="button"
                          className="icon-button icon-button--subtle"
                          aria-label={
                            editingPlayerId === player.id
                              ? `Finish editing ${player.name}`
                              : `Edit ${player.name}`
                          }
                          onClick={() =>
                            setEditingPlayerId((currentId) =>
                              currentId === player.id ? null : player.id
                            )
                          }
                        >
                          {editingPlayerId === player.id ? <CheckIcon /> : <PencilIcon />}
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--subtle"
                          aria-label={`Choose a team for ${player.name}`}
                          onClick={() =>
                            setMovingPlayerId((currentId) =>
                              currentId === player.id ? null : player.id
                            )
                          }
                        >
                          <ArrowRightIcon />
                        </button>
                      </div>
                      {movingPlayerId === player.id ? (
                        <div className="team-card__move-picker">
                          {teams
                            .filter((targetTeam) => targetTeam.id !== player.teamId)
                            .map((targetTeam) => (
                              <button
                                key={`${player.id}-${targetTeam.id}`}
                                type="button"
                                className="secondary-action secondary-action--compact"
                                onClick={() => {
                                  onMovePlayer(player.id, targetTeam.id);
                                  setMovingPlayerId(null);
                                }}
                              >
                                Move to {targetTeam.name}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="team-card__empty">No players yet</p>
              )}
            </article>
          );
        })}
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
                    : 'Give me suggestions'}
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

function renderSettingsSection(title, content, showHeading) {
  if (!showHeading) {
    return content;
  }

  return (
    <section className="settings-card">
      <div className="panel-heading">
        <h3>{title}</h3>
      </div>
      {content}
    </section>
  );
}

export function WhoWhatWhereSettingsCard({ settings, onChange, showHeading = true }) {
  const content = (
    <div className="settings-grid">
      <label className="settings-field">
        {showHeading ? <span className="helper-text">Teams</span> : null}
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
        {showHeading ? <span className="helper-text">Turn length</span> : null}
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
        {showHeading ? <span className="helper-text">Rounds</span> : null}
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
        {showHeading ? <span className="helper-text">Skips allowed</span> : null}
        <select
          value={String(settings.skipLimit)}
          onChange={(event) =>
            onChange(
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
  );

  return renderSettingsSection('Match settings', content, showHeading);
}

export function ImposterSettingsCard({ settings, onChange, showHeading = true }) {
  const content = (
    <div className="settings-grid">
      <label className="settings-field">
        {showHeading ? <span className="helper-text">Rounds</span> : null}
        <select
          value={settings.rounds}
          onChange={(event) =>
            onChange('rounds', Number.parseInt(event.target.value, 10))
          }
        >
          <option value={1}>1 round</option>
          <option value={2}>2 rounds</option>
          <option value={3}>3 rounds</option>
          <option value={4}>4 rounds</option>
        </select>
      </label>

      <label className="settings-field">
        {showHeading ? <span className="helper-text">Imposters</span> : null}
        <select
          value={settings.imposterCount}
          onChange={(event) =>
            onChange('imposterCount', Number.parseInt(event.target.value, 10))
          }
        >
          <option value={1}>1 imposter</option>
          <option value={2}>2 imposters</option>
          <option value={3}>3 imposters</option>
        </select>
      </label>
    </div>
  );

  return renderSettingsSection('Round settings', content, showHeading);
}

export function DrawNGuessSettingsCard({ settings, onChange, showHeading = true }) {
  const content = (
    <div className="settings-grid">
      <label className="settings-field">
        <span className="helper-text">Round length</span>
        <select
          value={settings.roundDurationSeconds}
          onChange={(event) =>
            onChange('roundDurationSeconds', Number.parseInt(event.target.value, 10))
          }
        >
          <option value={30}>30 seconds</option>
          <option value={45}>45 seconds</option>
          <option value={60}>60 seconds</option>
        </select>
      </label>
    </div>
  );

  return renderSettingsSection('Round settings', content, showHeading);
}

export function HatGameSettingsCard({ settings, onChange, showHeading = true }) {
  const content = (
    <div className="settings-grid">
      <label className="settings-field">
        {showHeading ? <span className="helper-text">Teams</span> : null}
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
        {showHeading ? <span className="helper-text">Turn length</span> : null}
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
        {showHeading ? <span className="helper-text">Clues each</span> : null}
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
        {showHeading ? <span className="helper-text">Skips per turn</span> : null}
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
  );

  return renderSettingsSection('Round settings', content, showHeading);
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAudioCues } from '../audio/AudioCueContext';
import { SoundToggle } from '../audio/SoundToggle';
import { ArrowLeftIcon } from '../components/Icons';
import { getGameById } from '../games/config';
import {
  fetchHatGameSuggestions,
  fetchRandomWord,
  fetchWordDeck
} from '../games/contentApi';
import { getGameModule } from '../games/registry';
import {
  applyLocalAction,
  buildLocalSession,
  buildLocalTeams,
  DEFAULT_LOCAL_HATGAME_SETTINGS,
  getLocalStartError,
  getLocalWordType,
  rebalanceWhoWhatWherePlayers
} from '../local/session';
import { LOCAL_SETTINGS_COMPONENTS, LOCAL_VIEW_COMPONENTS } from './local';
import {
  LocalHatGameClueEditor,
  HandoffPanel,
  LocalPlayersEditor,
} from './local/common';
import {
  EMPTY_TEAMS,
  LOCAL_PLAYER_LIMIT,
  buildEmptyHatGameClues,
  createLocalPlayerId,
  getNextLocalPlayerName,
  getInitialPlayers,
  getInitialSettingsForGame,
  rotateLocalRoundPlayers,
  syncHatGameClueSubmissions
} from './local/helpers';

export function LocalMode() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { playCue } = useAudioCues();
  const game = getGameById(gameId);
  const gameModule = getGameModule(gameId);
  const [settings, setSettings] = useState(() => getInitialSettingsForGame(gameId));
  const [players, setPlayers] = useState(() =>
    getInitialPlayers(gameId, getInitialSettingsForGame(gameId))
  );
  const [hatClueSubmissions, setHatClueSubmissions] = useState(() =>
    syncHatGameClueSubmissions(
      {},
      getInitialPlayers(gameId, getInitialSettingsForGame(gameId)),
      getInitialSettingsForGame(gameId).cluesPerPlayer ??
        DEFAULT_LOCAL_HATGAME_SETTINGS.cluesPerPlayer
    )
  );
  const [session, setSession] = useState(null);
  const [hatClueEntry, setHatClueEntry] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [playersPanelOpen, setPlayersPanelOpen] = useState(true);
  const [cluesPanelOpen, setCluesPanelOpen] = useState(gameId === 'hatgame');

  useEffect(() => {
    const nextSettings = getInitialSettingsForGame(gameId);
    const nextPlayers = getInitialPlayers(gameId, nextSettings);

    setSettings(nextSettings);
    setPlayers(nextPlayers);
    setHatClueSubmissions(
      syncHatGameClueSubmissions(
        {},
        nextPlayers,
        nextSettings.cluesPerPlayer ?? DEFAULT_LOCAL_HATGAME_SETTINGS.cluesPerPlayer
      )
    );
    setSession(null);
    setHatClueEntry(null);
    setBusyAction('');
    setError('');
    setPlayersPanelOpen(true);
    setCluesPanelOpen(gameId === 'hatgame');
  }, [gameId]);

  useEffect(() => {
    if (gameId !== 'hatgame') {
      setHatClueSubmissions({});
      return;
    }

    setHatClueSubmissions((currentSubmissions) =>
      syncHatGameClueSubmissions(
        currentSubmissions,
        players,
        settings.cluesPerPlayer ?? DEFAULT_LOCAL_HATGAME_SETTINGS.cluesPerPlayer
      )
    );
  }, [gameId, players, settings.cluesPerPlayer]);

  const teams = useMemo(
    () => (gameModule.requiresTeams ? buildLocalTeams(settings.teamCount) : EMPTY_TEAMS),
    [gameModule.requiresTeams, settings.teamCount]
  );

  const startHint = useMemo(
    () =>
      getLocalStartError({
        gameId,
        players,
        settings,
        lobbyState: { clueSubmissions: hatClueSubmissions }
      }),
    [gameId, hatClueSubmissions, players, settings]
  );

  const SettingsCard = LOCAL_SETTINGS_COMPONENTS[gameModule.localSettingsVariant] ?? null;
  const ActiveLocalView =
    LOCAL_VIEW_COMPONENTS[gameModule.localVariant] ?? LOCAL_VIEW_COMPONENTS.imposter;
  const replacePlayers = useCallback((updater) => {
    setPlayers((currentPlayers) =>
      updater(currentPlayers).map((player, index) => ({
        ...player,
        seat: index
      }))
    );
  }, []);

  const applyAction = useCallback((action) => {
    setError('');
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      const result = applyLocalAction(currentSession, action);
      if (result?.error) {
        setError(result.error);
        return currentSession;
      }

      return result;
    });
  }, []);

  const buildSession = useCallback(async (sessionPlayers = players) => {
    const prompt =
      gameId === 'whowhatwhere' || gameId === 'hatgame'
        ? ''
        : await fetchRandomWord(getLocalWordType(gameId));

    return buildLocalSession({
      gameId,
      players: sessionPlayers,
      prompt,
      settings,
      lobbyState: { clueSubmissions: hatClueSubmissions }
    });
  }, [gameId, hatClueSubmissions, players, settings]);

  const startSession = useCallback(async () => {
    if (startHint) {
      setError(startHint);
      return;
    }

    if (gameId === 'hatgame') {
      setError('');
      setHatClueEntry({ playerIndex: 0, isRevealed: false });
      return;
    }

    setBusyAction('start-session');
    setError('');

    try {
      setSession(await buildSession());
    } catch (sessionError) {
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : 'Unable to start local session'
      );
    } finally {
      setBusyAction('');
    }
  }, [buildSession, gameId, startHint]);

  const playAgain = useCallback(async () => {
    setBusyAction('restart');
    setError('');

    try {
      const nextPlayers =
        gameId === 'drawnguess' && session?.players?.length
          ? rotateLocalRoundPlayers(session.players)
          : players;
      setSession(await buildSession(nextPlayers));
    } catch (sessionError) {
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : 'Unable to start another round'
      );
    } finally {
      setBusyAction('');
    }
  }, [buildSession, gameId, players, session?.players]);

  const startTimedTeamTurn = useCallback(async () => {
    setBusyAction('start-turn');
    setError('');

    try {
      const payload =
        gameId === 'whowhatwhere'
          ? await fetchWordDeck({ type: 'guessing', count: 90 }).then((deck) => ({
              category: deck.category,
              words: deck.words.slice(0, 30),
              reserveWords: deck.words.slice(30)
            }))
          : {};

      setSession((currentSession) => {
        if (!currentSession) {
          return currentSession;
        }

        const result = applyLocalAction(currentSession, {
          type: 'start-turn',
          payload
        });

        if (result?.error) {
          setError(result.error);
          return currentSession;
        }

        return result;
      });
    } catch (turnError) {
      setError(
        turnError instanceof Error ? turnError.message : 'Unable to start this turn'
      );
    } finally {
      setBusyAction('');
    }
  }, [gameId]);

  const handleRenamePlayer = (playerId, name) => {
    replacePlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              name
            }
          : player
      )
    );
  };

  const handleChangeTeam = (playerId, teamId) => {
    replacePlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              teamId
            }
          : player
      )
    );
  };

  const handleAddPlayer = () => {
    replacePlayers((currentPlayers) => [
      ...currentPlayers,
      {
        id: createLocalPlayerId(),
        seat: currentPlayers.length,
        name: getNextLocalPlayerName(currentPlayers),
        teamId:
          teams.length > 0 ? teams[currentPlayers.length % teams.length]?.id ?? null : null
      }
    ]);
  };

  const handleRemovePlayer = (playerId) => {
    replacePlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== playerId)
    );
  };

  const handleSetPlayerCount = useCallback((nextCount) => {
    const normalizedCount = Number.parseInt(nextCount, 10);
    if (!Number.isFinite(normalizedCount) || normalizedCount < 1) {
      return;
    }

    replacePlayers((currentPlayers) => {
      if (normalizedCount === currentPlayers.length) {
        return currentPlayers;
      }

      if (normalizedCount < currentPlayers.length) {
        return currentPlayers.slice(0, normalizedCount);
      }

      const nextPlayers = [...currentPlayers];
      while (nextPlayers.length < normalizedCount) {
        nextPlayers.push({
          id: createLocalPlayerId(),
          seat: nextPlayers.length,
          name: getNextLocalPlayerName(nextPlayers),
          teamId:
            teams.length > 0
              ? teams[nextPlayers.length % teams.length]?.id ?? null
              : null
        });
      }

      return nextPlayers;
    });
  }, [replacePlayers, teams]);

  const handleUpdateTeamSetting = (key, value) => {
    const nextSettings = {
      ...settings,
      [key]: value
    };
    setSettings(nextSettings);

    if (key === 'teamCount' && gameModule.requiresTeams) {
      setPlayers((currentPlayers) => rebalanceWhoWhatWherePlayers(currentPlayers, value));
    }
  };

  const handleChangeHatGameClue = (playerId, clueIndex, value) => {
    setHatClueSubmissions((currentSubmissions) => ({
      ...currentSubmissions,
      [playerId]: {
        clues: (
          currentSubmissions[playerId]?.clues ??
          buildEmptyHatGameClues(settings.cluesPerPlayer)
        ).map((clue, index) => (index === clueIndex ? value : clue))
      }
    }));
  };

  const handleGenerateHatGameClues = useCallback(
    async (playerId) => {
      setBusyAction(`generate-hat-clues:${playerId}`);
      setError('');

      try {
        const suggestions = await fetchHatGameSuggestions(settings.cluesPerPlayer);
        setHatClueSubmissions((currentSubmissions) => ({
          ...currentSubmissions,
          [playerId]: {
            clues: Array.from(
              { length: settings.cluesPerPlayer },
              (_, index) =>
                currentSubmissions[playerId]?.clues?.[index]?.trim().length > 0
                  ? currentSubmissions[playerId].clues[index]
                  : suggestions[index] ??
                    currentSubmissions[playerId]?.clues?.[index] ??
                    ''
            )
          }
        }));
        playCue('submit');
      } catch (generateError) {
        setError(
          generateError instanceof Error
            ? generateError.message
            : 'Unable to load HatGame clue suggestions'
        );
      } finally {
        setBusyAction('');
      }
    },
    [playCue, settings.cluesPerPlayer]
  );

  const handleResetSetup = () => {
    setSession(null);
    setHatClueEntry(null);
    setBusyAction('');
    setError('');
  };

  const handleConfirmHatGameClues = useCallback(async () => {
    if (!hatClueEntry) {
      return;
    }

    const activePlayer = players[hatClueEntry.playerIndex];
    const clues = hatClueSubmissions[activePlayer.id]?.clues ?? buildEmptyHatGameClues(settings.cluesPerPlayer);
    const normalizedClues = clues.map((clue) => clue.trim());

    if (normalizedClues.some((clue) => clue.length === 0)) {
      setError(`Fill in every clue before handing the phone on to ${activePlayer.name}.`);
      return;
    }

    setError('');

    if (hatClueEntry.playerIndex >= players.length - 1) {
      setBusyAction('start-session');
      try {
        setSession(await buildSession());
        setHatClueEntry(null);
      } catch (sessionError) {
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : 'Unable to start local session'
        );
      } finally {
        setBusyAction('');
      }
      return;
    }

    setHatClueEntry({
      playerIndex: hatClueEntry.playerIndex + 1,
      isRevealed: false
    });
  }, [buildSession, hatClueEntry, hatClueSubmissions, players, settings.cluesPerPlayer]);

  if (!game?.supportsLocal) {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Pass and play</p>
        <h1 className="scene__title">Local mode unavailable</h1>
        <p className="scene__lead">This game is currently tuned for online play only.</p>
        <div className="actions">
          <button onClick={() => navigate(`/play/${gameId}`)}>Back</button>
        </div>
      </main>
    );
  }

  return (
    <main className="scene scene--local">
      <header className="scene__header scene__header--compact scene__header--inline">
        <div className="scene__header-row scene__header-row--between">
          <button
            type="button"
            aria-label={session || hatClueEntry ? 'Back to pass-and-play setup' : 'Back to game setup'}
            className="scene__back scene__back--icon"
            onClick={() => {
              if (session || hatClueEntry) {
                handleResetSetup();
                return;
              }

              navigate(`/play/${gameId}`);
            }}
          >
            <ArrowLeftIcon />
          </button>
          <h1 className="scene__title scene__title--inline">{game.name}</h1>
          <SoundToggle compact />
        </div>
      </header>

      {!session && !hatClueEntry ? (
        <div className="panel-grid panel-grid--local">
          <section className="panel panel--hero panel--stacked">
            <div className="panel-heading">
              <h2>Setup</h2>
            </div>

            <div className="settings-grid">
              <label className="settings-field">
                {gameId === 'imposter' ? null : <span className="helper-text">Players</span>}
                <select
                  value={players.length}
                  onChange={(event) => handleSetPlayerCount(event.target.value)}
                >
                  {Array.from(
                    { length: LOCAL_PLAYER_LIMIT - (game.minPlayers ?? 2) + 1 },
                    (_, index) => (game.minPlayers ?? 2) + index
                  ).map((count) => (
                    <option key={count} value={count}>
                      {count} players
                    </option>
                  ))}
                </select>
              </label>

              {SettingsCard ? (
                <SettingsCard
                  settings={settings}
                  onChange={handleUpdateTeamSetting}
                  showHeading={false}
                />
              ) : null}
            </div>
          </section>

          <details
            className="panel disclosure setup-disclosure"
            open={playersPanelOpen}
            onToggle={(event) => setPlayersPanelOpen(event.currentTarget.open)}
          >
            <summary className="disclosure__summary">
              <div className="disclosure__summary-copy">
                <h2>Players</h2>
                {gameModule.requiresTeams ? <p>{settings.teamCount} teams</p> : null}
              </div>
            </summary>
            <div className="disclosure__body">
              <LocalPlayersEditor
                players={players}
                teams={teams}
                onRenamePlayer={handleRenamePlayer}
                onTeamChange={handleChangeTeam}
                onAddPlayer={handleAddPlayer}
                onRemovePlayer={handleRemovePlayer}
                onAutoBalance={() =>
                  setPlayers((currentPlayers) =>
                    rebalanceWhoWhatWherePlayers(currentPlayers, settings.teamCount)
                  )
                }
                minimumPlayers={game.minPlayers ?? 2}
                showHeading={false}
                showAddButton={false}
                showRemoveButton={false}
                compactNames={!gameModule.requiresTeams}
              />
            </div>
          </details>

          {gameModule.requiresHatClues && (
            <details
              className="panel disclosure setup-disclosure"
              open={cluesPanelOpen}
              onToggle={(event) => setCluesPanelOpen(event.currentTarget.open)}
            >
              <summary className="disclosure__summary">
                <div className="disclosure__summary-copy">
                  <h2>Private clue entry</h2>
                  <p>
                    Phone-pass setup before the round starts
                  </p>
                </div>
              </summary>
              <div className="disclosure__body">
                <div className="notice-card">
                  <strong>Clues stay secret before the game starts</strong>
                  <p>
                    After you start, the phone passes around so each player can enter and
                    confirm their own clue pack privately.
                  </p>
                </div>
              </div>
            </details>
          )}

          <div className="local-action-dock">
            {error ? <p className="connection-banner connection-banner--error">{error}</p> : null}
            <button
              disabled={busyAction === 'start-session' || Boolean(startHint)}
              onClick={startSession}
            >
              {busyAction === 'start-session'
                ? 'Preparing round'
                : gameId === 'hatgame'
                  ? 'Start private clue entry'
                  : 'Start local round'}
            </button>
            {startHint ? <p className="helper-text">{startHint}</p> : null}
          </div>
        </div>
      ) : !session && hatClueEntry ? (
        <>
          {error && <p className="connection-banner connection-banner--error">{error}</p>}
          <HandoffPanel
            pill={`Clue pack ${hatClueEntry.playerIndex + 1} / ${players.length}`}
            title={`Pass to ${players[hatClueEntry.playerIndex]?.name ?? 'Next player'}`}
            targetName={players[hatClueEntry.playerIndex]?.name ?? 'Next player'}
            description="Only this player should enter and confirm their clues before handing the phone on."
            isRevealed={hatClueEntry.isRevealed}
            onReveal={() =>
              setHatClueEntry((currentFlow) =>
                currentFlow ? { ...currentFlow, isRevealed: true } : currentFlow
              )
            }
            onHide={() =>
              setHatClueEntry((currentFlow) =>
                currentFlow ? { ...currentFlow, isRevealed: false } : currentFlow
              )
            }
            showHideButton={false}
            footer={
              hatClueEntry.isRevealed ? (
                <button disabled={busyAction === 'start-session'} onClick={handleConfirmHatGameClues}>
                  {hatClueEntry.playerIndex === players.length - 1
                    ? busyAction === 'start-session'
                      ? 'Starting game'
                      : 'Confirm clues and start game'
                    : 'Confirm clues and pass on'}
                </button>
              ) : null
            }
          >
            <LocalHatGameClueEditor
              players={[players[hatClueEntry.playerIndex]].filter(Boolean)}
              clueSubmissions={hatClueSubmissions}
              cluesPerPlayer={settings.cluesPerPlayer}
              busyAction={busyAction}
              onChangeClue={handleChangeHatGameClue}
              onGenerateClues={handleGenerateHatGameClues}
              showHeading={false}
            />
          </HandoffPanel>
        </>
      ) : (
        <>
          {error && <p className="connection-banner connection-banner--error">{error}</p>}

          <ActiveLocalView
            session={session}
            applyAction={applyAction}
            busyAction={busyAction}
            onStartTurn={startTimedTeamTurn}
            onPlayAgain={playAgain}
            onResetSetup={handleResetSetup}
          />
        </>
      )}
    </main>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAudioCues } from '../audio/AudioCueContext';
import { SoundToggle } from '../audio/SoundToggle';
import { SummaryChips } from '../components/gameplay/SharedGameUi';
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
  LocalPlayersEditor,
} from './local/common';
import {
  EMPTY_TEAMS,
  buildEmptyHatGameClues,
  createLocalPlayerId,
  getInitialPlayers,
  getInitialSettingsForGame,
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
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');

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
    setBusyAction('');
    setError('');
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

  const buildSession = useCallback(async () => {
    const prompt =
      gameId === 'whowhatwhere' || gameId === 'hatgame'
        ? ''
        : await fetchRandomWord(getLocalWordType(gameId));

    return buildLocalSession({
      gameId,
      players,
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
  }, [buildSession, startHint]);

  const playAgain = useCallback(async () => {
    setBusyAction('restart');
    setError('');

    try {
      setSession(await buildSession());
    } catch (sessionError) {
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : 'Unable to start another round'
      );
    } finally {
      setBusyAction('');
    }
  }, [buildSession]);

  const startTimedTeamTurn = useCallback(async () => {
    setBusyAction('start-turn');
    setError('');

    try {
      const payload =
        gameId === 'whowhatwhere'
          ? await fetchWordDeck({ type: 'guessing', count: 30 })
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
        name: `Player ${currentPlayers.length + 1}`,
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
                suggestions[index] ??
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
    setBusyAction('');
    setError('');
  };

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
      <header className="scene__header scene__header--compact">
        <p className="scene__eyebrow">Pass and play</p>
        <h1 className="scene__title">{game.name}</h1>
        <p className="scene__lead">{gameModule.localLead}</p>
        <div className="actions">
          <SoundToggle />
        </div>
      </header>

      {!session ? (
        <div className="panel-grid panel-grid--local">
          <section className="panel panel--hero panel--stacked">
            <div className="panel-heading">
              <h2>Setup</h2>
              <p>Set the table, then pass the phone.</p>
            </div>

            <SummaryChips
              items={[
                { label: 'Players', value: players.length },
                { label: 'Mode', value: 'Single device' },
                gameModule.requiresTeams
                  ? { label: 'Teams', value: settings.teamCount }
                  : { label: 'Word type', value: getLocalWordType(game.id) }
              ]}
            />

            {SettingsCard ? (
              <SettingsCard settings={settings} onChange={handleUpdateTeamSetting} />
            ) : null}

            {error && <p className="connection-banner connection-banner--error">{error}</p>}

            <div className="actions actions--stretch">
              <button
                disabled={busyAction === 'start-session' || Boolean(startHint)}
                onClick={startSession}
              >
                {busyAction === 'start-session' ? 'Preparing round' : 'Start local round'}
              </button>
              <button className="secondary-action" onClick={() => navigate(`/play/${game.id}`)}>
                Back to online flow
              </button>
            </div>
            <p className="helper-text">
              {startHint ??
                (gameModule.requiresHatClues
                  ? 'Ready once teams and clue packs are set.'
                  : 'Ready once the names look right.')}
            </p>
          </section>

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
          />

          {gameModule.requiresHatClues && (
            <LocalHatGameClueEditor
              players={players}
              clueSubmissions={hatClueSubmissions}
              cluesPerPlayer={settings.cluesPerPlayer}
              busyAction={busyAction}
              onChangeClue={handleChangeHatGameClue}
              onGenerateClues={handleGenerateHatGameClues}
            />
          )}
        </div>
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

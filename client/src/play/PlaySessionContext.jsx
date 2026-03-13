/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { io } from 'socket.io-client';

const NAME_STORAGE_KEY = 'rvlry.playerName';
const LAST_ROOMS_STORAGE_KEY = 'rvlry.lastRooms';
const PLAYER_TOKENS_STORAGE_KEY = 'rvlry.playerTokens';
const SOCKET_TIMEOUT_MS = 5000;

const PlaySessionContext = createContext(null);

const normalizeCode = (code) => String(code ?? '').trim().toUpperCase();
const normalizePlayerName = (name) => String(name ?? '').trim() || 'Player';

const readJson = (key, fallback) => {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

const createPlayerToken = () =>
  window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);

const readPlayerToken = (gameId) => {
  const tokens = readJson(PLAYER_TOKENS_STORAGE_KEY, {});
  if (tokens[gameId]) {
    return tokens[gameId];
  }

  const nextToken = createPlayerToken();
  tokens[gameId] = nextToken;
  writeJson(PLAYER_TOKENS_STORAGE_KEY, tokens);
  return nextToken;
};

const readLastRoom = (gameId) => readJson(LAST_ROOMS_STORAGE_KEY, {})[gameId] ?? '';

function useStoredPlayerName() {
  return useState(() => window.localStorage.getItem(NAME_STORAGE_KEY) ?? '');
}

export function PlaySessionProvider({ children, game }) {
  const [playerName, setPlayerNameState] = useStoredPlayerName();
  const [playerToken, setPlayerToken] = useState(() => readPlayerToken(game.id));
  const [playerId, setPlayerId] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [privateState, setPrivateState] = useState(null);
  const [lobbyPrivateState, setLobbyPrivateState] = useState(null);
  const [lastRoomCode, setLastRoomCode] = useState(() => readLastRoom(game.id));
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [connectionState, setConnectionState] = useState('connecting');

  const socketRef = useRef(null);
  const joinInFlightRef = useRef(null);

  useEffect(() => {
    setPlayerToken(readPlayerToken(game.id));
    setPlayerId(null);
    setRoomState(null);
    setPrivateState(null);
    setLobbyPrivateState(null);
    setLastRoomCode(readLastRoom(game.id));
    setError('');
  }, [game.id]);

  useEffect(() => {
    const socket = io('/', { transports: ['websocket'] });
    socketRef.current = socket;
    setConnectionState(socket.connected ? 'connected' : 'connecting');

    const handleConnect = () => {
      setConnectionState('connected');
      setError('');
    };

    const handleDisconnect = () => {
      setConnectionState('disconnected');
    };

    const handleConnectError = () => {
      setConnectionState('error');
      setError('Unable to reach the RVLRY server right now.');
    };

    const handleRoomUpdate = (payload) => {
      if (payload.gameId !== game.id) {
        return;
      }

      setRoomState(payload);
      setLastRoomCode(payload.code);
      writeJson(LAST_ROOMS_STORAGE_KEY, {
        ...readJson(LAST_ROOMS_STORAGE_KEY, {}),
        [game.id]: payload.code
      });

      if (payload.phase !== 'in-progress') {
        setPrivateState(null);
      }

      if (payload.phase === 'in-progress' || payload.gameId !== 'hatgame') {
        setLobbyPrivateState(null);
      }
    };

    const handlePrivateState = (payload) => {
      if (payload.gameId !== game.id) {
        return;
      }

      setPrivateState(payload);
    };

    const handleLobbyPrivateState = (payload) => {
      if (payload.gameId !== game.id) {
        return;
      }

      setLobbyPrivateState(payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('room:update', handleRoomUpdate);
    socket.on('game:private', handlePrivateState);
    socket.on('room:private', handleLobbyPrivateState);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:private', handlePrivateState);
      socket.off('room:private', handleLobbyPrivateState);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [game.id]);

  const setPlayerName = useCallback((value) => {
    setPlayerNameState(value);
    window.localStorage.setItem(NAME_STORAGE_KEY, value);
  }, [setPlayerNameState]);

  const clearLastRoom = useCallback(
    (codeToClear) => {
      const storedRooms = readJson(LAST_ROOMS_STORAGE_KEY, {});
      if (storedRooms[game.id] !== codeToClear) {
        return;
      }

      delete storedRooms[game.id];
      writeJson(LAST_ROOMS_STORAGE_KEY, storedRooms);
      setLastRoomCode('');
    },
    [game.id]
  );

  const rememberLastRoom = useCallback(
    (code) => {
      const normalizedCode = normalizeCode(code);
      setLastRoomCode(normalizedCode);
      writeJson(LAST_ROOMS_STORAGE_KEY, {
        ...readJson(LAST_ROOMS_STORAGE_KEY, {}),
        [game.id]: normalizedCode
      });
    },
    [game.id]
  );

  const waitForConnection = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) {
      return Promise.reject(new Error('Socket unavailable'));
    }

    if (socket.connected) {
      return Promise.resolve(socket);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Connection timed out'));
      }, SOCKET_TIMEOUT_MS);

      const handleConnect = () => {
        cleanup();
        resolve(socket);
      };

      const handleError = () => {
        cleanup();
        reject(new Error('Unable to connect to the server'));
      };

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleError);
      };

      socket.on('connect', handleConnect);
      socket.on('connect_error', handleError);
    });
  }, []);

  const emitWithAck = useCallback(
    async (eventName, payload) => {
      const socket = await waitForConnection();
      return new Promise((resolve) => {
        socket.emit(eventName, payload, (response) => {
          resolve(response ?? {});
        });
      });
    },
    [waitForConnection]
  );

  const runRoomAction = useCallback(
    async (actionName, eventName, payload, { silent = false } = {}) => {
      setPendingAction(actionName);
      if (!silent) {
        setError('');
      }

      try {
        const response = await emitWithAck(eventName, payload);
        if (response.error && !silent) {
          setError(response.error);
        }
        return response;
      } catch (actionError) {
        const message = actionError instanceof Error ? actionError.message : 'Connection failed';
        if (!silent) {
          setError(message);
        }
        return { error: message };
      } finally {
        setPendingAction('');
      }
    },
    [emitWithAck]
  );

  const createRoom = useCallback(async () => {
    const response = await runRoomAction('create', 'room:create', {
      gameId: game.id,
      playerName: normalizePlayerName(playerName),
      playerToken
    });

    if (response.playerId) {
      setPlayerId(response.playerId);
    }

    if (response.code) {
      rememberLastRoom(response.code);
    }

    return response;
  }, [game.id, playerName, playerToken, rememberLastRoom, runRoomAction]);

  const joinRoom = useCallback(
    async (code, options = {}) => {
      const normalizedCode = normalizeCode(code);
      if (!normalizedCode) {
        const response = { error: 'Enter a room code' };
        if (!options.silent) {
          setError(response.error);
        }
        return response;
      }

      const response = await runRoomAction(
        options.actionName ?? 'join',
        'room:join',
        {
          code: normalizedCode,
          playerName: normalizePlayerName(playerName),
          playerToken
        },
        options
      );

      if (response.error) {
        if (response.error === 'Room not found') {
          clearLastRoom(normalizedCode);
        }
        return response;
      }

      if (response.playerId) {
        setPlayerId(response.playerId);
      }

      if (response.code) {
        rememberLastRoom(response.code);
      }

      return response;
    },
    [clearLastRoom, playerName, playerToken, rememberLastRoom, runRoomAction]
  );

  const ensureRoom = useCallback(
    async (code) => {
      const normalizedCode = normalizeCode(code);

      if (roomState?.code === normalizedCode && playerId) {
        return { ok: true, code: normalizedCode, playerId };
      }

      if (joinInFlightRef.current?.code === normalizedCode) {
        return joinInFlightRef.current.promise;
      }

      const promise = joinRoom(normalizedCode, { silent: true, actionName: 'rejoin' }).finally(() => {
        if (joinInFlightRef.current?.promise === promise) {
          joinInFlightRef.current = null;
        }
      });

      joinInFlightRef.current = {
        code: normalizedCode,
        promise
      };

      return promise;
    },
    [joinRoom, playerId, roomState?.code]
  );

  const setReady = useCallback(
    async (code, ready) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction('ready', 'room:ready', { code: normalizedCode, ready });
    },
    [runRoomAction]
  );

  const assignTeam = useCallback(
    async (code, teamId) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction('assign-team', 'room:assign-team', { code: normalizedCode, teamId });
    },
    [runRoomAction]
  );

  const updateTeamName = useCallback(
    async (code, teamId, name) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction('update-team-name', 'room:update-team-name', {
        code: normalizedCode,
        teamId,
        name
      });
    },
    [runRoomAction]
  );

  const rebalanceTeams = useCallback(
    async (code) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction('rebalance-teams', 'room:rebalance-teams', {
        code: normalizedCode
      });
    },
    [runRoomAction]
  );

  const updateRoomSettings = useCallback(
    async (code, settings) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction('update-settings', 'room:update-settings', {
        code: normalizedCode,
        settings
      });
    },
    [runRoomAction]
  );

  const submitHatClues = useCallback(
    async (code, clues) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction('submit-hat-clues', 'room:submit-hat-clues', {
        code: normalizedCode,
        clues
      });
    },
    [runRoomAction]
  );

  const startGame = useCallback(
    async (code) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction('start', 'room:start', { code: normalizedCode });
    },
    [runRoomAction]
  );

  const sendGameAction = useCallback(
    async (code, type, payload = {}) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction(type, 'game:action', { code: normalizedCode, type, payload });
    },
    [runRoomAction]
  );

  const returnRoomToLobby = useCallback(
    async (code) => {
      const normalizedCode = normalizeCode(code);
      return runRoomAction('return-to-lobby', 'room:return-to-lobby', { code: normalizedCode });
    },
    [runRoomAction]
  );

  const currentPlayer = useMemo(
    () => roomState?.players.find((player) => player.id === playerId) ?? null,
    [playerId, roomState?.players]
  );

  const value = useMemo(
    () => ({
      game,
      playerName,
      setPlayerName,
      playerId,
      currentPlayer,
      roomState,
      privateState,
      lobbyPrivateState,
      lastRoomCode,
      error,
      setError,
      pendingAction,
      connectionState,
      createRoom,
      joinRoom,
      ensureRoom,
      assignTeam,
      updateTeamName,
      rebalanceTeams,
      updateRoomSettings,
      submitHatClues,
      setReady,
      startGame,
      sendGameAction,
      returnRoomToLobby
    }),
    [
      assignTeam,
      connectionState,
      createRoom,
      currentPlayer,
      ensureRoom,
      error,
      game,
      joinRoom,
      lastRoomCode,
      lobbyPrivateState,
      pendingAction,
      playerId,
      playerName,
      privateState,
      rebalanceTeams,
      returnRoomToLobby,
      roomState,
      sendGameAction,
      setPlayerName,
      setReady,
      startGame,
      submitHatClues,
      updateRoomSettings,
      updateTeamName
    ]
  );

  return <PlaySessionContext.Provider value={value}>{children}</PlaySessionContext.Provider>;
}

export function usePlaySession() {
  const context = useContext(PlaySessionContext);
  if (!context) {
    throw new Error('usePlaySession must be used within a PlaySessionProvider');
  }
  return context;
}

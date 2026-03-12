import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { createAppServer } from './app.js';

const TEST_DATA = {
  describing: [
    { word: 'Volcano', category: 'Places' },
    { word: 'Lantern', category: 'Objects' },
    { word: 'Meteor', category: 'Space' },
    { word: 'Castle', category: 'Places' }
  ],
  guessing: [
    { word: 'Lion', category: 'Animals' },
    { word: 'Tiger', category: 'Animals' },
    { word: 'Panda', category: 'Animals' },
    { word: 'Falcon', category: 'Animals' },
    { word: 'Piano', category: 'Music' },
    { word: 'Guitar', category: 'Music' },
    { word: 'Trumpet', category: 'Music' },
    { word: 'Drums', category: 'Music' }
  ]
};

const TEST_DRAWING = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBgZVp0QAAAABJRU5ErkJggg==';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate, label, timeoutMs = 5000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await sleep(25);
  }

  throw new Error(`Timed out waiting for ${label}`);
};

const createTestWordStore = () => ({
  getRandomWord(type) {
    return TEST_DATA[type]?.[0]?.word ?? null;
  },
  getWords(type) {
    return (TEST_DATA[type] ?? []).map((entry) => entry.word);
  },
  getCategories(type) {
    return [...new Set((TEST_DATA[type] ?? []).map((entry) => entry.category).filter(Boolean))];
  },
  getWordsForCategory(type, category) {
    return (TEST_DATA[type] ?? [])
      .filter((entry) => entry.category === category)
      .map((entry) => entry.word);
  },
  initialize: async () => undefined,
  sync: async () => ({ lastSyncAt: '2026-03-12T00:00:00.000Z' }),
  startSchedule: () => undefined,
  status: () => ({
    lastSyncAt: '2026-03-12T00:00:00.000Z',
    loadedTypes: Object.keys(TEST_DATA),
    cacheFilePath: 'memory'
  })
});

const listen = (httpServer) =>
  new Promise((resolve) => {
    httpServer.listen(0, () => {
      resolve(httpServer.address().port);
    });
  });

const closeServer = (httpServer) =>
  new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const connectHarness = async (baseUrl) => {
  const state = {
    room: null,
    privateState: null
  };
  const socket = ioClient(baseUrl, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
    forceNew: true
  });

  socket.on('room:update', (payload) => {
    state.room = payload;
  });
  socket.on('game:private', (payload) => {
    state.privateState = payload;
  });

  socket.connect();
  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Socket connection timed out')), 2000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleError);
    };

    const handleConnect = () => {
      cleanup();
      resolve();
    };

    const handleError = (error) => {
      cleanup();
      reject(error);
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleError);
  });

  return {
    socket,
    state,
    playerId: null,
    emit(eventName, payload) {
      return new Promise((resolve) => {
        socket.emit(eventName, payload, (response) => resolve(response ?? {}));
      });
    }
  };
};

describe.sequential('RVLRY server integration', () => {
  let app;
  let httpServer;
  let baseUrl;
  let harnesses;

  beforeEach(async () => {
    const wordStore = createTestWordStore();
    const server = createAppServer({ wordStore, staticFiles: false });
    app = server.app;
    httpServer = server.httpServer;
    const port = await listen(httpServer);
    baseUrl = `http://127.0.0.1:${port}`;
    harnesses = [];
  });

  afterEach(async () => {
    await Promise.all(
      harnesses.map(
        (harness) =>
          new Promise((resolve) => {
            harness.socket.disconnect();
            resolve();
          })
      )
    );
    await closeServer(httpServer);
  });

  it('serves a category deck for local timed rounds', async () => {
    const response = await request(app).get('/api/words/deck?type=guessing&count=3');

    expect(response.status).toBe(200);
    expect(response.body.type).toBe('guessing');
    expect(response.body.category).toBeTruthy();
    expect(response.body.words).toHaveLength(3);
  });

  it('completes an Imposter room over websockets', async () => {
    harnesses = await Promise.all(Array.from({ length: 4 }, () => connectHarness(baseUrl)));
    const [host, ...guests] = harnesses;

    const createdRoom = await host.emit('room:create', {
      gameId: 'imposter',
      playerName: 'Ada',
      playerToken: 'token-ada'
    });
    host.playerId = createdRoom.playerId;

    const roomCode = createdRoom.code;
    expect(roomCode).toHaveLength(6);

    const guestNames = ['Bea', 'Cy', 'Dee'];
    for (const [index, guest] of guests.entries()) {
      const joinedRoom = await guest.emit('room:join', {
        code: roomCode,
        playerName: guestNames[index],
        playerToken: `token-${index + 1}`
      });
      guest.playerId = joinedRoom.playerId;
    }

    await waitFor(() => host.state.room?.players?.length === 4, 'all imposter players to join');

    for (const harness of harnesses) {
      const response = await harness.emit('room:ready', {
        code: roomCode,
        ready: true
      });
      expect(response.ok).toBe(true);
    }

    const started = await host.emit('room:start', { code: roomCode });
    expect(started.ok).toBe(true);

    await waitFor(
      () => harnesses.every((harness) => harness.state.room?.phase === 'in-progress' && harness.state.privateState),
      'imposter round to start'
    );

    const playersById = new Map(harnesses.map((harness) => [harness.playerId, harness]));
    const imposterHarness = harnesses.find((harness) => harness.state.privateState.role === 'imposter');
    expect(imposterHarness).toBeTruthy();

    while (host.state.room.gamePublicState.stage === 'clues') {
      const currentPlayerId = host.state.room.gamePublicState.currentTurnPlayerId;
      const actingHarness = playersById.get(currentPlayerId);
      const clueNumber = host.state.room.gamePublicState.clueCount + 1;
      const response = await actingHarness.emit('game:action', {
        code: roomCode,
        type: 'submit-clue',
        payload: { text: `clue-${clueNumber}` }
      });
      expect(response.ok).toBe(true);

      await waitFor(
        () =>
          host.state.room.gamePublicState.clueCount >= clueNumber ||
          host.state.room.gamePublicState.stage !== 'clues',
        'next imposter clue update'
      );
    }

    expect(host.state.room.gamePublicState.stage).toBe('voting');

    for (const harness of harnesses) {
      const targetPlayerId =
        harness.playerId === imposterHarness.playerId
          ? harnesses.find((entry) => entry.playerId !== imposterHarness.playerId).playerId
          : imposterHarness.playerId;
      const response = await harness.emit('game:action', {
        code: roomCode,
        type: 'cast-vote',
        payload: { targetPlayerId }
      });
      expect(response.ok).toBe(true);
    }

    await waitFor(() => host.state.room.gamePublicState.stage === 'results', 'imposter results');

    expect(host.state.room.gamePublicState.results.imposterId).toBe(imposterHarness.playerId);
    expect(host.state.room.gamePublicState.results.outcome).toBe('crew');

    const returned = await host.emit('room:return-to-lobby', { code: roomCode });
    expect(returned.ok).toBe(true);
    await waitFor(() => host.state.room.phase === 'lobby', 'imposter room to return to lobby');
  });

  it('completes a three-team WhoWhatWhere match with updated room settings', async () => {
    harnesses = await Promise.all(Array.from({ length: 6 }, () => connectHarness(baseUrl)));
    const [host, ...guests] = harnesses;

    const createdRoom = await host.emit('room:create', {
      gameId: 'whowhatwhere',
      playerName: 'Alex',
      playerToken: 'host-www'
    });
    host.playerId = createdRoom.playerId;
    const roomCode = createdRoom.code;

    const guestNames = ['Blair', 'Casey', 'Dev', 'Eden', 'Flynn'];
    for (const [index, guest] of guests.entries()) {
      const joinedRoom = await guest.emit('room:join', {
        code: roomCode,
        playerName: guestNames[index],
        playerToken: `guest-www-${index}`
      });
      guest.playerId = joinedRoom.playerId;
    }

    await waitFor(() => host.state.room?.players?.length === 6, 'all whowhatwhere players to join');

    const updatedSettings = await host.emit('room:update-settings', {
      code: roomCode,
      settings: {
        teamCount: 3,
        turnDurationSeconds: 30,
        totalRounds: 1,
        freeSkips: 1,
        skipPenalty: 1
      }
    });
    expect(updatedSettings.ok).toBe(true);

    await waitFor(() => host.state.room?.teams?.length === 3, 'three teams to be configured');
    expect(host.state.room.players.every((player) => player.teamId)).toBe(true);

    for (const harness of harnesses) {
      const response = await harness.emit('room:ready', {
        code: roomCode,
        ready: true
      });
      expect(response.ok).toBe(true);
    }

    const started = await host.emit('room:start', { code: roomCode });
    expect(started.ok).toBe(true);

    await waitFor(
      () => harnesses.every((harness) => harness.state.room?.phase === 'in-progress' && harness.state.privateState),
      'whowhatwhere match to start'
    );

    const playersById = new Map(harnesses.map((harness) => [harness.playerId, harness]));

    for (let turnIndex = 0; turnIndex < 3; turnIndex += 1) {
      await waitFor(() => host.state.room.gamePublicState.stage === 'ready', 'next team ready state');

      const describerId = host.state.room.gamePublicState.activeDescriberId;
      const describerHarness = playersById.get(describerId);
      const startTurn = await describerHarness.emit('game:action', {
        code: roomCode,
        type: 'start-turn',
        payload: {}
      });
      expect(startTurn.ok).toBe(true);

      await waitFor(() => host.state.room.gamePublicState.stage === 'turn', 'active timed turn');

      const scored = await describerHarness.emit('game:action', {
        code: roomCode,
        type: 'mark-correct',
        payload: {}
      });
      expect(scored.ok).toBe(true);

      if (turnIndex === 0) {
        const skipped = await describerHarness.emit('game:action', {
          code: roomCode,
          type: 'skip-word',
          payload: {}
        });
        expect(skipped.ok).toBe(true);
      }

      const ended = await describerHarness.emit('game:action', {
        code: roomCode,
        type: 'end-turn',
        payload: {}
      });
      expect(ended.ok).toBe(true);
    }

    await waitFor(() => host.state.room.gamePublicState.stage === 'game-over', 'whowhatwhere results');

    expect(host.state.room.teams).toHaveLength(3);
    expect(host.state.room.gamePublicState.results.leaderboard).toHaveLength(3);
    expect(
      host.state.room.gamePublicState.results.leaderboard.reduce((total, entry) => total + entry.score, 0)
    ).toBeGreaterThanOrEqual(3);

    const returned = await host.emit('room:return-to-lobby', { code: roomCode });
    expect(returned.ok).toBe(true);
    await waitFor(() => host.state.room.phase === 'lobby', 'whowhatwhere room to return to lobby');
  });

  it('completes a DrawNGuess chain over websockets', async () => {
    harnesses = await Promise.all(Array.from({ length: 4 }, () => connectHarness(baseUrl)));
    const [host, ...guests] = harnesses;

    const createdRoom = await host.emit('room:create', {
      gameId: 'drawnguess',
      playerName: 'Nova',
      playerToken: 'draw-host'
    });
    host.playerId = createdRoom.playerId;
    const roomCode = createdRoom.code;

    const guestNames = ['Oak', 'Pax', 'Quin'];
    for (const [index, guest] of guests.entries()) {
      const joinedRoom = await guest.emit('room:join', {
        code: roomCode,
        playerName: guestNames[index],
        playerToken: `draw-guest-${index}`
      });
      guest.playerId = joinedRoom.playerId;
    }

    await waitFor(() => host.state.room?.players?.length === 4, 'all drawnguess players to join');

    for (const harness of harnesses) {
      const response = await harness.emit('room:ready', {
        code: roomCode,
        ready: true
      });
      expect(response.ok).toBe(true);
    }

    const started = await host.emit('room:start', { code: roomCode });
    expect(started.ok).toBe(true);

    await waitFor(
      () => harnesses.every((harness) => harness.state.room?.phase === 'in-progress' && harness.state.privateState),
      'drawnguess round to start'
    );

    const playersById = new Map(harnesses.map((harness) => [harness.playerId, harness]));

    while (host.state.room.gamePublicState.stage !== 'results') {
      const { stage, activePlayerId, submissions } = host.state.room.gamePublicState;
      const actingHarness = playersById.get(activePlayerId);
      const response = await actingHarness.emit('game:action', {
        code: roomCode,
        type: stage === 'draw' ? 'submit-drawing' : 'submit-guess',
        payload:
          stage === 'draw'
            ? { imageData: TEST_DRAWING }
            : { text: `guess-${submissions + 1}` }
      });
      expect(response.ok).toBe(true);

      await waitFor(
        () =>
          host.state.room.gamePublicState.submissions > submissions ||
          host.state.room.gamePublicState.stage === 'results',
        'next drawnguess submission'
      );
    }

    const chain = host.state.room.gamePublicState.results.chain;
    expect(chain.map((entry) => entry.type)).toEqual(['prompt', 'drawing', 'guess', 'drawing', 'guess']);

    const returned = await host.emit('room:return-to-lobby', { code: roomCode });
    expect(returned.ok).toBe(true);
    await waitFor(() => host.state.room.phase === 'lobby', 'drawnguess room to return to lobby');
  });
});

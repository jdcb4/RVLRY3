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
    { word: 'Albert Einstein', category: 'Who' },
    { word: 'Wonder Woman', category: 'Who' },
    { word: 'Sherlock Holmes', category: 'Who' },
    { word: 'Beyonce', category: 'Who' },
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
    privateState: null,
    lobbyPrivateState: null,
    kickedNotice: null
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
  socket.on('room:private', (payload) => {
    state.lobbyPrivateState = payload;
  });
  socket.on('room:kicked', (payload) => {
    state.kickedNotice = payload;
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

  it('looks up a room by code for the home join flow', async () => {
    harnesses = [await connectHarness(baseUrl)];
    const [host] = harnesses;

    const createdRoom = await host.emit('room:create', {
      gameId: 'hatgame',
      playerName: 'Hana',
      playerToken: 'lookup-host'
    });
    host.playerId = createdRoom.playerId;

    const response = await request(app).get(`/api/rooms/${createdRoom.code}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: createdRoom.code,
      gameId: 'hatgame',
      phase: 'lobby'
    });
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

  it('rebalances team games from the lobby for the host', async () => {
    harnesses = await Promise.all(Array.from({ length: 4 }, () => connectHarness(baseUrl)));
    const [host, ...guests] = harnesses;

    const createdRoom = await host.emit('room:create', {
      gameId: 'whowhatwhere',
      playerName: 'Alex',
      playerToken: 'rebalance-host'
    });
    host.playerId = createdRoom.playerId;
    const roomCode = createdRoom.code;

    const guestNames = ['Blair', 'Casey', 'Drew'];
    for (const [index, guest] of guests.entries()) {
      const joinedRoom = await guest.emit('room:join', {
        code: roomCode,
        playerName: guestNames[index],
        playerToken: `rebalance-guest-${index}`
      });
      guest.playerId = joinedRoom.playerId;
    }

    await waitFor(() => host.state.room?.players?.length === 4, 'all rebalance players to join');

    const firstTeamId = host.state.room.teams[0].id;
    for (const harness of harnesses) {
      const response = await harness.emit('room:assign-team', {
        code: roomCode,
        teamId: firstTeamId
      });
      expect(response.ok).toBe(true);
    }

    await waitFor(
      () => host.state.room.players.every((player) => player.teamId === firstTeamId),
      'all players stacked on one team'
    );

    const rebalanced = await host.emit('room:rebalance-teams', { code: roomCode });
    expect(rebalanced.ok).toBe(true);

    await waitFor(
      () => {
        const counts = host.state.room.teams.map(
          (team) => host.state.room.players.filter((player) => player.teamId === team.id).length
        );
        return counts.every((count) => count >= 2);
      },
      'balanced teams after rebalance'
    );
  });

  it('lets team captains rename teams and hosts remove players from the lobby', async () => {
    harnesses = await Promise.all(Array.from({ length: 4 }, () => connectHarness(baseUrl)));
    const [host, captainBravo, guestTwo, guestThree] = harnesses;

    const createdRoom = await host.emit('room:create', {
      gameId: 'hatgame',
      playerName: 'Hana',
      playerToken: 'captain-host'
    });
    host.playerId = createdRoom.playerId;
    const roomCode = createdRoom.code;

    const joinData = [
      [captainBravo, 'Ivy', 'captain-bravo'],
      [guestTwo, 'Jules', 'captain-jules'],
      [guestThree, 'Kye', 'captain-kye']
    ];

    for (const [harness, name, token] of joinData) {
      const joinedRoom = await harness.emit('room:join', {
        code: roomCode,
        playerName: name,
        playerToken: token
      });
      harness.playerId = joinedRoom.playerId;
    }

    await waitFor(() => host.state.room?.players?.length === 4, 'all captain test players to join');

    const bravoTeam = host.state.room.teams.find((team) => team.captainId === captainBravo.playerId);
    expect(bravoTeam).toBeTruthy();

    const deniedRename = await host.emit('room:update-team-name', {
      code: roomCode,
      teamId: bravoTeam.id,
      name: 'Host Rename'
    });
    expect(deniedRename.error).toBe('Only the team captain can rename this team');

    const captainRename = await captainBravo.emit('room:update-team-name', {
      code: roomCode,
      teamId: bravoTeam.id,
      name: 'Bravo Legends'
    });
    expect(captainRename.ok).toBe(true);

    await waitFor(
      () => host.state.room?.teams?.some((team) => team.id === bravoTeam.id && team.name === 'Bravo Legends'),
      'team captain rename to propagate'
    );

    const kicked = await host.emit('room:kick-player', {
      code: roomCode,
      playerId: guestThree.playerId
    });
    expect(kicked.ok).toBe(true);

    await waitFor(
      () => guestThree.state.kickedNotice?.code === roomCode,
      'kicked notice for removed guest'
    );
    expect(guestThree.state.kickedNotice.message).toBe(`You were removed from room ${roomCode}.`);

    const deniedRejoin = await guestThree.emit('room:join', {
      code: roomCode,
      playerName: 'Kye',
      playerToken: 'captain-kye'
    });
    expect(deniedRejoin.error).toBe('You were removed from this room');
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

  it('completes a HatGame match across all three phases', async () => {
    harnesses = await Promise.all(Array.from({ length: 4 }, () => connectHarness(baseUrl)));
    const [host, ...guests] = harnesses;

    const createdRoom = await host.emit('room:create', {
      gameId: 'hatgame',
      playerName: 'Hana',
      playerToken: 'hat-host'
    });
    host.playerId = createdRoom.playerId;
    const roomCode = createdRoom.code;

    const guestNames = ['Ivy', 'Jules', 'Kye'];
    for (const [index, guest] of guests.entries()) {
      const joinedRoom = await guest.emit('room:join', {
        code: roomCode,
        playerName: guestNames[index],
        playerToken: `hat-guest-${index}`
      });
      guest.playerId = joinedRoom.playerId;
    }

    await waitFor(() => host.state.room?.players?.length === 4, 'all hatgame players to join');

    const updatedSettings = await host.emit('room:update-settings', {
      code: roomCode,
      settings: {
        teamCount: 2,
        turnDurationSeconds: 30,
        cluesPerPlayer: 3,
        skipsPerTurn: 1
      }
    });
    expect(updatedSettings.ok).toBe(true);

    const clueSets = [
      ['Albert Einstein', 'Wonder Woman', 'Sherlock Holmes'],
      ['Beyonce', 'Black Panther', 'Darth Vader'],
      ['Hermione Granger', 'Spider-Man', 'Oprah Winfrey'],
      ['Batman', 'Taylor Swift', 'Indiana Jones']
    ];

    for (const [index, harness] of harnesses.entries()) {
      const response = await harness.emit('room:submit-hat-clues', {
        code: roomCode,
        clues: clueSets[index]
      });
      expect(response.ok).toBe(true);
    }

    await waitFor(
      () =>
        harnesses.every(
          (harness) => harness.state.lobbyPrivateState?.hasSubmitted === true
        ),
      'hatgame clue submissions'
    );

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
      'hatgame match to start'
    );

    const playersById = new Map(harnesses.map((harness) => [harness.playerId, harness]));

    let usedSkipReturn = false;

    while (host.state.room.gamePublicState.stage !== 'game-over') {
      if (host.state.room.gamePublicState.stage === 'ready') {
        const describerId = host.state.room.gamePublicState.activeDescriberId;
        const describerHarness = playersById.get(describerId);
        const startedTurn = await describerHarness.emit('game:action', {
          code: roomCode,
          type: 'start-turn',
          payload: {}
        });
        expect(startedTurn.ok).toBe(true);

        await waitFor(() => host.state.room.gamePublicState.stage === 'turn', 'hatgame active turn');
        continue;
      }

      const currentState = host.state.room.gamePublicState;
      const describerHarness = playersById.get(currentState.activeDescriberId);

      if (!usedSkipReturn && !currentState.turn?.skippedCluePending) {
        const skipped = await describerHarness.emit('game:action', {
          code: roomCode,
          type: 'skip-clue',
          payload: {}
        });
        expect(skipped.ok).toBe(true);

        await waitFor(
          () => describerHarness.state.privateState?.canReturnSkippedClue === true,
          'hatgame skipped clue return state'
        );

        const returnedSkipped = await describerHarness.emit('game:action', {
          code: roomCode,
          type: 'return-skipped-clue',
          payload: {}
        });
        expect(returnedSkipped.ok).toBe(true);
        usedSkipReturn = true;
        continue;
      }

      const previousCorrectCount = currentState.turn?.correctCount ?? 0;
      const previousPhaseNumber = currentState.phaseNumber;
      const response = await describerHarness.emit('game:action', {
        code: roomCode,
        type: 'mark-correct',
        payload: {}
      });
      expect(response.ok).toBe(true);

      await waitFor(
        () => {
          const nextState = host.state.room.gamePublicState;
          return (
            nextState.stage !== 'turn' ||
            nextState.phaseNumber !== previousPhaseNumber ||
            (nextState.turn?.correctCount ?? -1) !== previousCorrectCount
          );
        },
        'hatgame next state update'
      );
    }

    await waitFor(() => host.state.room.gamePublicState.stage === 'game-over', 'hatgame results');

    expect(host.state.room.gamePublicState.results.totalClues).toBe(12);
    expect(host.state.room.gamePublicState.results.leaderboard).toHaveLength(2);
    expect(host.state.room.gamePublicState.results.bestTurn).toMatchObject({
      describerName: expect.any(String),
      teamName: expect.any(String)
    });
    expect(host.state.room.gamePublicState.results.bestTurn.score).toBeGreaterThan(0);

    const returned = await host.emit('room:return-to-lobby', { code: roomCode });
    expect(returned.ok).toBe(true);
    await waitFor(() => host.state.room.phase === 'lobby', 'hatgame room to return to lobby');
  });

  it('keeps the same HatGame timer when a turn rolls into the next phase', async () => {
    harnesses = await Promise.all(Array.from({ length: 4 }, () => connectHarness(baseUrl)));
    const [host, ...guests] = harnesses;

    const createdRoom = await host.emit('room:create', {
      gameId: 'hatgame',
      playerName: 'Hana',
      playerToken: 'hat-rollover-host'
    });
    host.playerId = createdRoom.playerId;
    const roomCode = createdRoom.code;

    const guestNames = ['Ivy', 'Jules', 'Kye'];
    for (const [index, guest] of guests.entries()) {
      const joinedRoom = await guest.emit('room:join', {
        code: roomCode,
        playerName: guestNames[index],
        playerToken: `hat-rollover-guest-${index}`
      });
      guest.playerId = joinedRoom.playerId;
    }

    await waitFor(() => host.state.room?.players?.length === 4, 'all hat rollover players to join');

    const updatedSettings = await host.emit('room:update-settings', {
      code: roomCode,
      settings: {
        teamCount: 2,
        turnDurationSeconds: 30,
        cluesPerPlayer: 3,
        skipsPerTurn: 1
      }
    });
    expect(updatedSettings.ok).toBe(true);

    const clueSets = [
      ['Albert Einstein', 'Wonder Woman', 'Sherlock Holmes'],
      ['Beyonce', 'Black Panther', 'Darth Vader'],
      ['Hermione Granger', 'Spider-Man', 'Oprah Winfrey'],
      ['Batman', 'Taylor Swift', 'Indiana Jones']
    ];

    for (const [index, harness] of harnesses.entries()) {
      const response = await harness.emit('room:submit-hat-clues', {
        code: roomCode,
        clues: clueSets[index]
      });
      expect(response.ok).toBe(true);
    }

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
      'hat rollover match to start'
    );

    const playersById = new Map(harnesses.map((harness) => [harness.playerId, harness]));
    const describerId = host.state.room.gamePublicState.activeDescriberId;
    const describerHarness = playersById.get(describerId);
    const startedTurn = await describerHarness.emit('game:action', {
      code: roomCode,
      type: 'start-turn',
      payload: {}
    });
    expect(startedTurn.ok).toBe(true);

    await waitFor(() => host.state.room.gamePublicState.stage === 'turn', 'hat rollover turn');
    const turnEndsAt = host.state.room.gamePublicState.turn.endsAt;

    for (let index = 0; index < 12; index += 1) {
      const response = await describerHarness.emit('game:action', {
        code: roomCode,
        type: 'mark-correct',
        payload: {}
      });
      expect(response.ok).toBe(true);
    }

    await waitFor(
      () =>
        host.state.room.gamePublicState.stage === 'turn' &&
        host.state.room.gamePublicState.phaseNumber === 2,
      'hat rollover phase 2'
    );
    expect(host.state.room.gamePublicState.turn.endsAt).toBe(turnEndsAt);

    for (let index = 0; index < 12; index += 1) {
      const response = await describerHarness.emit('game:action', {
        code: roomCode,
        type: 'mark-correct',
        payload: {}
      });
      expect(response.ok).toBe(true);
    }

    await waitFor(
      () =>
        host.state.room.gamePublicState.stage === 'turn' &&
        host.state.room.gamePublicState.phaseNumber === 3,
      'hat rollover phase 3'
    );
    expect(host.state.room.gamePublicState.turn.endsAt).toBe(turnEndsAt);
  });
});

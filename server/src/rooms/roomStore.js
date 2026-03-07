import { createCode, createPlayerId } from '../utils/id.js';

const rooms = new Map();

function buildPlayer(name, isHost = false) {
  return {
    id: createPlayerId(),
    name,
    isHost
  };
}

export function createRoom(gameKey, hostName) {
  const code = createCode();
  const host = buildPlayer(hostName, true);

  const room = {
    code,
    gameKey,
    status: 'lobby',
    players: [host],
    createdAt: new Date().toISOString()
  };

  const state = {
    room,
    round: null
  };

  rooms.set(code, state);
  return state;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function addPlayer(code, playerName) {
  const state = rooms.get(code);
  if (!state) {
    return null;
  }

  state.room.players.push(buildPlayer(playerName));
  return state;
}

export function updateRoom(code, partial) {
  const state = rooms.get(code);
  if (!state) {
    return null;
  }

  state.room = { ...state.room, ...partial };
  rooms.set(code, state);
  return state;
}

export function setRound(code, round) {
  const state = rooms.get(code);
  if (!state) {
    return null;
  }

  state.round = round;
  rooms.set(code, state);
  return state;
}

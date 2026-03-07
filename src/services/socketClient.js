import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || window.location.origin;

export function createGameSocket() {
  return io(SOCKET_SERVER_URL, {
    transports: ['websocket'],
    autoConnect: true,
  });
}

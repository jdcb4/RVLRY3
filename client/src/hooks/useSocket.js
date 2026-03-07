import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(roomCode, playerName, gameType, onStateUpdate) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomCode || !playerName || !gameType) return undefined;
    const socket = io('/', { transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('room:join', { roomCode, playerName, gameType });
    socket.on('room:update', onStateUpdate);

    return () => {
      socket.off('room:update', onStateUpdate);
      socket.disconnect();
    };
  }, [roomCode, playerName, gameType, onStateUpdate]);

  return socketRef;
}

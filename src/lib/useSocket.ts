import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import config from '../config';

export function useSocket(): React.MutableRefObject<Socket | null> {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    try {
      socketRef.current = io(config.socketUrl, {
        transports: ['websocket', 'polling'],
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 10000,
        forceNew: true,
        autoConnect: false,
      });
      const socket = socketRef.current;
      socket.connect();
      const onConnect = () => console.log('Successfully connected to server');
      const onConnectError = (error: unknown) => {
        console.error('Connection error:', error);
        alert('Unable to connect to game server. Please try again later.');
      };
      const onDisconnect = (reason: string) => {
        console.log('Disconnected:', reason);
        if (reason === 'io server disconnect') socket.connect();
      };
      socket.on('connect', onConnect);
      socket.on('connect_error', onConnectError);
      socket.on('disconnect', onDisconnect);
      return () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
        socket.off('disconnect', onDisconnect);
        socket.disconnect();
      };
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      alert('Failed to initialize game connection');
    }
  }, []);

  return socketRef;
}




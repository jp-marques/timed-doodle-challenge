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
      let connectAlertTimer: number | undefined;

      const startAlertTimer = () => {
        if (connectAlertTimer) window.clearTimeout(connectAlertTimer);
        connectAlertTimer = window.setTimeout(() => {
          if (!socket.connected) {
            alert(
              'Still unable to connect to the game server. If this persists, the backend may be down. Please try again later.'
            );
          }
        }, 120000); // 2 minutes
      };

      // Start timer immediately on mount in case backend is cold starting
      startAlertTimer();

      const onConnect = () => {
        console.log('Successfully connected to server');
        if (connectAlertTimer) {
          window.clearTimeout(connectAlertTimer);
          connectAlertTimer = undefined;
        }
      };
      const onConnectError = (error: unknown) => {
        console.error('Connection error:', error);
        // Do not alert immediately; only if it lasts 2 minutes
        startAlertTimer();
      };
      const onDisconnect = (reason: string) => {
        console.log('Disconnected:', reason);
        if (reason === 'io server disconnect') socket.connect();
        // Start/restart the long timer while disconnected
        startAlertTimer();
      };
      socket.on('connect', onConnect);
      socket.on('connect_error', onConnectError);
      socket.on('disconnect', onDisconnect);
      return () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
        socket.off('disconnect', onDisconnect);
        if (connectAlertTimer) window.clearTimeout(connectAlertTimer);
        socket.disconnect();
      };
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      // Avoid immediate popups; leave UI to indicate offline state
    }
  }, []);

  return socketRef;
}





'use client';

import { ReactNode, useEffect, useState } from 'react';

export function PwaProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    setIsOnline(window.navigator.onLine);

    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(() => undefined);
        }, { once: true });
      } else {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch(() => undefined);

        if ('caches' in window) {
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            .catch(() => undefined);
        }
      }
    }

    const goOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      window.setTimeout(() => setShowReconnected(false), 4500);
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <>
      <div className={isOnline ? 'connection-indicator online' : 'connection-indicator offline'} role="status">
        <span />
        {isOnline ? 'En linea' : 'Sin conexion'}
        {!isOnline && <button type="button" onClick={() => window.location.reload()}>Reintentar</button>}
        {showReconnected && <button type="button" onClick={() => window.location.reload()}>Recargar datos</button>}
      </div>
      {children}
    </>
  );
}

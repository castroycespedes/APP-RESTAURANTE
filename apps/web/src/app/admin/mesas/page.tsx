'use client';

import { useEffect } from 'react';

export default function AdminMesasRoute() {
  useEffect(() => {
    window.location.replace('/admin#tables');
  }, []);

  return <main className="admin-shell"><div className="empty-state">Abriendo administracion de mesas...</div></main>;
}

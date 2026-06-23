'use client';

import { useEffect } from 'react';

export default function AsignacionesMesasRoute() {
  useEffect(() => {
    window.location.replace('/admin#tables');
  }, []);

  return <main className="admin-shell"><div className="empty-state">Abriendo asignacion de meseros...</div></main>;
}

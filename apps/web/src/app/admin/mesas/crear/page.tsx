'use client';

import { useEffect } from 'react';

export default function CrearMesaRoute() {
  useEffect(() => {
    window.location.replace('/admin#tables');
  }, []);

  return <main className="admin-shell"><div className="empty-state">Abriendo formulario para crear mesa...</div></main>;
}

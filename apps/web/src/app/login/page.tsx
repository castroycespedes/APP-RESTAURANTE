'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@restaurante/ui';
import { routeForRole, useAuth } from '../auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [message, setMessage] = useState('Ingresa con el usuario creado por el administrador.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    const password = params.get('password');

    if (email && password) {
      void runLogin(email, password);
    }
  }, []);

  async function runLogin(email: string, password: string) {
    setIsSubmitting(true);

    try {
      const user = await login(email, password);
      router.replace(routeForRole(user.role));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    await runLogin(email, password);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div>
          <p className="eyebrow">POS Restaurante</p>
          <h1>Inicio de sesion</h1>
          <p>{message}</p>
        </div>

        <form className="login-form" method="post" onSubmit={submitLogin}>
          <label>
            Correo
            <input name="email" type="email" defaultValue="admin@restaurant.local" autoComplete="email" required />
          </label>
          <label>
            Contrasena
            <input name="password" type="password" defaultValue="Admin123!" autoComplete="current-password" required />
          </label>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando...' : 'Entrar'}</Button>
        </form>

        <div className="login-help">
          <strong>Acceso real</strong>
          <span>Usa el usuario creado por el administrador o el seed inicial.</span>
        </div>
      </section>
    </main>
  );
}

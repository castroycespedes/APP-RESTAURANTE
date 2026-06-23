'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'WAITER' | 'KITCHEN' | 'CASHIER' | 'INVENTORY';

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  roleId: string;
  permissions: string[];
}

interface AuthContextValue {
  user: SessionUser | null;
  accessToken: string | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  hasRole: (roles: UserRole[]) => boolean;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const accessTokenKey = 'accessToken';
const refreshTokenKey = 'refreshToken';
const userKey = 'sessionUser';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
      const savedUser = window.localStorage.getItem(userKey);
      const savedRefreshToken = window.localStorage.getItem(refreshTokenKey);

      if (!savedUser || !savedRefreshToken) {
        return null;
      }

      try {
        const parsedUser = JSON.parse(savedUser) as SessionUser;
        const tokens = await refreshSession(savedRefreshToken, parsedUser);
        setUser(parsedUser);
        setAccessToken(tokens.accessToken);
        return tokens.accessToken;
      } catch (error) {
        if (error instanceof AuthRefreshError && error.status === 401) {
          window.localStorage.removeItem(accessTokenKey);
          window.localStorage.removeItem(refreshTokenKey);
          window.localStorage.removeItem(userKey);
          setUser(null);
          setAccessToken(null);
        }

        return null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, []);

  useEffect(() => {
    const savedUser = window.localStorage.getItem(userKey);
    const savedToken = window.localStorage.getItem(accessTokenKey);
    const savedRefreshToken = window.localStorage.getItem(refreshTokenKey);

    if (savedUser && savedToken) {
      const parsedUser = JSON.parse(savedUser) as SessionUser;
      setUser(parsedUser);
      setAccessToken(savedToken);

      if (savedRefreshToken) {
        refreshAccessToken()
          .finally(() => setIsReady(true));
        return;
      }
    }

    setIsReady(true);
  }, [refreshAccessToken]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accessToken,
    isReady,
    login: async (email, password) => {
      try {
        const response = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        if (response.ok) {
          const data = await response.json() as {
            user: SessionUser;
            accessToken: string;
            refreshToken: string;
          };

          saveSession(data.user, data.accessToken, data.refreshToken);
          setUser(data.user);
          setAccessToken(data.accessToken);

          return data.user;
        }
      } catch (error) {
        throw new Error(error instanceof TypeError ? 'Error de conexion con el servidor.' : 'Correo o contrasena incorrectos.');
      }

      throw new Error('Correo o contrasena incorrectos.');
    },
    logout: async () => {
      const token = window.localStorage.getItem(accessTokenKey);

      if (token) {
        await fetch(`${apiUrl}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => undefined);
      }

      window.localStorage.removeItem(accessTokenKey);
      window.localStorage.removeItem(refreshTokenKey);
      window.localStorage.removeItem(userKey);
      setUser(null);
      setAccessToken(null);
    },
    refreshAccessToken,
    hasRole: (roles) => Boolean(user && roles.includes(user.role))
  }), [accessToken, isReady, refreshAccessToken, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function refreshSession(refreshToken: string, user: SessionUser) {
  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    throw new AuthRefreshError(response.status);
  }

  const tokens = await response.json() as { accessToken: string; refreshToken: string };
  saveSession(user, tokens.accessToken, tokens.refreshToken);
  return tokens;
}

class AuthRefreshError extends Error {
  constructor(readonly status: number) {
    super('No se pudo refrescar la sesion');
  }
}

function saveSession(user: SessionUser, accessToken: string, refreshToken: string) {
  window.localStorage.setItem(accessTokenKey, accessToken);
  window.localStorage.setItem(refreshTokenKey, refreshToken);
  window.localStorage.setItem(userKey, JSON.stringify(user));
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}

export function AuthGate({ allowedRoles, children }: { allowedRoles: UserRole[]; children: ReactNode }) {
  const router = useRouter();
  const { hasRole, isReady, user } = useAuth();

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      router.replace('/login');
      return;
    }

  }, [allowedRoles, hasRole, isReady, router, user]);

  if (!isReady) {
    return <main className="auth-loading">Validando permisos...</main>;
  }

  if (!user) {
    return <main className="auth-loading">Redirigiendo al login...</main>;
  }

  if (!hasRole(allowedRoles)) {
    return (
      <main className="auth-loading">
        <h1>403 - Sin permiso</h1>
        <p>No tienes permiso para entrar a esta seccion.</p>
        <button type="button" onClick={() => router.replace(routeForRole(user.role))}>
          Volver a mi panel
        </button>
      </main>
    );
  }

  return <>{children}</>;
}

export function routeForRole(role: UserRole) {
  const routes: Record<UserRole, string> = {
    SUPER_ADMIN: '/admin',
    ADMIN: '/admin',
    MANAGER: '/admin',
    WAITER: '/mesero/pedidos',
    KITCHEN: '/cocina/kanban',
    CASHIER: '/caja',
    INVENTORY: '/inventario'
  };

  return routes[role];
}

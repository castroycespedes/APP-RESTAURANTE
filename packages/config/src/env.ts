export interface AppEnv {
  appEnv: string;
  appUrl: string;
  apiUrl: string;
  defaultTheme: string;
}

export function readAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    appEnv: env.APP_ENV ?? 'local',
    appUrl: env.APP_URL ?? 'http://localhost:3000',
    apiUrl: env.API_URL ?? env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    defaultTheme: env.NEXT_PUBLIC_DEFAULT_THEME ?? 'restaurante-claro'
  };
}

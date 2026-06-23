import type { Metadata, Viewport } from 'next';
import { AuthProvider } from './auth-provider';
import { PwaProvider } from './pwa-provider';
import { ThemeProvider } from './theme-provider';
import './styles.css';

export const metadata: Metadata = {
  title: 'Restaurante',
  description: 'Sistema operativo para restaurante',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'POS Restaurante'
  },
  applicationName: 'POS Restaurante',
  formatDetection: {
    telephone: false
  },
  icons: {
    apple: '/icons/apple-touch-icon.svg',
    icon: [
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
    ]
  }
};

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f766e',
  userScalable: false,
  viewportFit: 'cover',
  width: 'device-width'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const defaultTheme = process.env.NEXT_PUBLIC_DEFAULT_THEME ?? 'restaurante-claro';

  return (
    <html lang="es" data-theme={defaultTheme}>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <PwaProvider>{children}</PwaProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

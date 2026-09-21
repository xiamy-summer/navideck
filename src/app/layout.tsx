import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalSettings, getUserByName, getUserSettings } from '@/lib/db';
import { ensureBootstrap } from '@/lib/bootstrap';

export const metadata: Metadata = {
  title: 'NaviDeck',
  description: 'Lightweight self-hosted dashboard for NAS / servers',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  ensureBootstrap();
  const me = await getCurrentUser();
  const guest = getUserByName('guest');
  const settings = getUserSettings(me?.id ?? guest?.id ?? 0);
  const globalSettings = getGlobalSettings();

  const styleVars: Record<string, string> = {
    '--brand': hexToRgb(settings.accent || '#3b82f6'),
    '--card-radius': `${settings.cardRadius}px`,
    '--card-opacity': String((settings.cardOpacity ?? 100) / 100),
    '--card-min': `${Math.max(96, Math.round(1080 / Math.max(2, settings.columns)))}px`,
  };
  if (settings.bgImage) styleVars['--bg-image'] = `url("${settings.bgImage}")`;

  return (
    <html lang={settings.lang || 'zh-CN'} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=${JSON.stringify(settings.theme)};var o=localStorage.getItem('nas-nav-theme');if(o)t=o;var d=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()`,
          }}
        />
        {settings.customCss ? <style dangerouslySetInnerHTML={{ __html: settings.customCss }} /> : null}
      </head>
      <body
        style={
          {
            ...styleVars,
            backgroundImage: settings.bgImage ? `url("${settings.bgImage}")` : undefined,
            backgroundSize: settings.bgImage ? 'cover' : undefined,
            backgroundAttachment: settings.bgImage ? 'fixed' : undefined,
          } as React.CSSProperties
        }
      >
        {children}
        {globalSettings.customJs && !settings.customJs ? null : null}
        {settings.customJs ? (
          <script dangerouslySetInnerHTML={{ __html: settings.customJs }} />
        ) : null}
      </body>
    </html>
  );
}

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return '59 130 246';
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

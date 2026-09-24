import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalSettings, getUserByName, getUserSettings } from '@/lib/db';
import { ensureBootstrap } from '@/lib/bootstrap';
import { PwaRegister } from '@/components/PwaRegister';
import { getPreset, hexToRgb, presetCss } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'NaviDeck',
  description: 'Lightweight self-hosted dashboard for NAS / servers',
  applicationName: 'NaviDeck',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg', apple: '/icon-192.png' },
  appleWebApp: {
    capable: true,
    title: 'NaviDeck',
    statusBarStyle: 'default',
  },
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

  // 主题预设：preset 自带 accent + 亮暗 canvas；手动改过 accent（与所选预设不同）则覆盖
  const preset = getPreset(settings.themePreset);
  const customAccent = settings.accent && settings.accent !== preset.accent ? settings.accent : '';
  const styleVars: Record<string, string> = {
    '--brand': hexToRgb(customAccent || preset.accent),
    '--card-radius': `${settings.cardRadius}px`,
    '--card-opacity': String((settings.cardOpacity ?? 100) / 100),
    '--card-min': `${Math.max(96, Math.round(1080 / Math.max(2, settings.columns)))}px`,
  };
  if (settings.bgImage) styleVars['--bg-image'] = `url("${settings.bgImage}")`;

  return (
    <html lang={settings.lang || 'zh-CN'} suppressHydrationWarning data-preset={preset.id}>
      <head>
        {/* iOS 添加到主屏后以独立窗口打开（Next 默认只输出 mobile-web-app-capable） */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* 主题预设：html[data-preset] 切换 --brand / --canvas（亮暗各一套） */}
        <style dangerouslySetInnerHTML={{ __html: presetCss() }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=${JSON.stringify(settings.theme)};var o=localStorage.getItem('nas-nav-theme');if(o)t=o;var d=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})()`,
          }}
        />
        {settings.customCss ? <style dangerouslySetInnerHTML={{ __html: settings.customCss }} /> : null}
      </head>
      <body style={styleVars as React.CSSProperties} data-bg-mode={settings.bgMode} data-has-bg={settings.bgImage ? '1' : undefined}>
        {children}
        <PwaRegister />
        {globalSettings.customJs && !settings.customJs ? null : null}
        {settings.customJs ? (
          <script dangerouslySetInnerHTML={{ __html: settings.customJs }} />
        ) : null}
      </body>
    </html>
  );
}

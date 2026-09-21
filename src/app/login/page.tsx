'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.login(username, password);
      router.push('/');
      router.refresh();
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loginFailed'));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Icon icon="mdi:compass-outline" size={40} title="NaviDeck" />
          <h1 className="text-[17px] font-medium">{t('login.title')}</h1>
          <p className="text-[12px] text-muted">{t('login.tip')}</p>
        </div>

        <div className="space-y-3">
          <input
            className="field"
            placeholder={t('login.username')}
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder={t('login.password')}
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <p className="mt-3 text-[13px] text-red-500">{error}</p> : null}

        <button className="btn btn-primary mt-5 w-full" disabled={loading || !username || !password}>
          {loading ? t('login.submitting') : t('common.login')}
        </button>

        <button type="button" className="btn mt-2 w-full" onClick={() => router.push('/')}>
          {t('login.asGuest')}
        </button>
      </form>
    </div>
  );
}

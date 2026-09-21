'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Icon } from '@/components/Icon';

export default function LoginPage() {
  const router = useRouter();
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
      setError(err instanceof Error ? err.message : '登录失败');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-7">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Icon icon="mdi:compass-outline" size={40} title="导航面板" />
          <h1 className="text-[17px] font-medium">登录导航面板</h1>
          <p className="text-[12px] text-muted">默认账号 admin，密码见首次启动日志或环境变量</p>
        </div>

        <div className="space-y-3">
          <input
            className="field"
            placeholder="用户名"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder="密码"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <p className="mt-3 text-[13px] text-red-500">{error}</p> : null}

        <button className="btn btn-primary mt-5 w-full" disabled={loading || !username || !password}>
          {loading ? '登录中…' : '登录'}
        </button>

        <button type="button" className="btn mt-2 w-full" onClick={() => router.push('/')}>
          以访客身份浏览
        </button>
      </form>
    </div>
  );
}

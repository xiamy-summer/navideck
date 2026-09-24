import { I18nProvider } from '@/i18n';
import { ensureBootstrap } from '@/lib/bootstrap';
import { getUserByName, getUserSettings } from '@/lib/db';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  ensureBootstrap();
  // 登录页没有当前用户上下文，语言跟随访客/默认设置
  const guest = getUserByName('guest');
  const lang = getUserSettings(guest?.id ?? 0).lang;

  return (
    <I18nProvider lang={lang}>
      <LoginForm />
    </I18nProvider>
  );
}

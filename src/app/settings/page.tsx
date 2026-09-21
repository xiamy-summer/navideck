import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getUserSettings, listUsers } from '@/lib/db';
import { SettingsPanel } from '@/components/SettingsPanel';
import { I18nProvider } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  return (
    <I18nProvider lang={getUserSettings(me.id).lang}>
      <SettingsPanel
        user={me}
        initialSettings={getUserSettings(me.id)}
        users={me.role === 'admin' ? listUsers() : []}
      />
    </I18nProvider>
  );
}

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getUserSettings, listUsers } from '@/lib/db';
import { SettingsPanel } from '@/components/SettingsPanel';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  return (
    <SettingsPanel
      user={me}
      initialSettings={getUserSettings(me.id)}
      users={me.role === 'admin' ? listUsers() : []}
    />
  );
}

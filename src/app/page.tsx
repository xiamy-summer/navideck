import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getGlobalSettings, getUserByName, getUserSettings, listGroups, listItems, listUsers } from '@/lib/db';
import { ensureBootstrap } from '@/lib/bootstrap';
import { HomeView } from '@/components/HomeView';
import type { GroupWithItems } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  ensureBootstrap();
  const me = await getCurrentUser();
  const guest = getUserByName('guest');
  const globalSettings = getGlobalSettings();

  let ownerId = me?.id;
  let isGuestView = false;
  if (!me) {
    if (!globalSettings.guestEnabled || !guest) redirect('/login');
    ownerId = guest.id;
    isGuestView = true;
  }

  const groups = listGroups(ownerId!).map((g) => ({
    ...g,
    items: listItems(ownerId!).filter((i) => i.groupId === g.id),
  })) as GroupWithItems[];

  return (
    <HomeView
      user={me}
      initialGroups={groups}
      settings={getUserSettings(ownerId!)}
      isGuestView={isGuestView}
      users={me?.role === 'admin' ? listUsers() : []}
    />
  );
}

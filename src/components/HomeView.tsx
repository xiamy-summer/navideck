'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type GroupWithItems } from '@/lib/api-client';
import { Icon } from './Icon';
import { NavBoard } from './NavBoard';
import { SearchBar } from './SearchBar';
import { WebModal } from './WebModal';
import { Widgets } from './Widgets';
import { ConfirmDialog, emptyItemDraft, GroupDialog, ItemDialog, itemToDraft, type ItemDraft } from './Dialogs';
import type { Group, Item, NetMode, Settings, ThemeMode, User } from '@/lib/types';

interface Props {
  user: User | null;
  initialGroups: GroupWithItems[];
  settings: Settings;
  isGuestView: boolean;
  users?: User[];
}

type Pending = { kind: 'item'; draft: ItemDraft } | { kind: 'group'; draft: { id?: number; name: string; icon: string | null } } | null;

export function HomeView({
  user,
  initialGroups,
  settings: initialSettings,
  isGuestView,
  users = [],
}: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithItems[]>(initialGroups);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [netMode, setNetMode] = useState<NetMode>(initialSettings.netMode);
  const [editMode, setEditMode] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(initialSettings.theme);
  const [pending, setPending] = useState<Pending>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'item' | 'group'; id: number; name: string } | null>(null);
  const [modal, setModal] = useState<{ url: string; title: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwForm, setPwForm] = useState<{ oldPassword: string; newPassword: string } | null>(null);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const saved = localStorage.getItem('nas-nav-theme') as ThemeMode | null;
    if (saved) setTheme(saved);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    const dark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  };

  const cycleTheme = () => {
    const order: ThemeMode[] = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    localStorage.setItem('nas-nav-theme', next);
    applyTheme(next);
    api.saveSettings({ theme: next }).catch(() => undefined);
  };

  const [targetId, setTargetId] = useState<number | null>(null);
  const effectiveId = targetId ?? user?.id ?? undefined;
  const isAdmin = user?.role === 'admin';

  const refresh = useCallback(async () => {
    try {
      setGroups(await api.groups(effectiveId));
    } catch {
      setToast('加载失败');
    }
  }, [effectiveId]);

  const switchTarget = async (value: string) => {
    const id = value === 'self' ? null : Number(value);
    setTargetId(id);
    try {
      setGroups(await api.groups(id ?? undefined));
    } catch {
      setToast('切换失败');
    }
  };

  const persist = useCallback(
    async (prev: GroupWithItems[], next: GroupWithItems[]) => {
      try {
        if (prev.map((g) => g.id).join() !== next.map((g) => g.id).join()) {
          await api.reorderGroups(next.map((g) => g.id), targetId ?? undefined);
        }
        const prevPos = new Map<number, number>();
        prev.forEach((g) => g.items.forEach((i) => prevPos.set(i.id, g.id)));
        for (const g of next) {
          for (const item of g.items) {
            const old = prevPos.get(item.id);
            if (old !== undefined && old !== g.id) {
              await api.updateItem(item.id, { groupId: g.id }, targetId ?? undefined);
            }
          }
          const before = prev.find((p) => p.id === g.id)?.items.map((i) => i.id).join() ?? '';
          if (before !== g.items.map((i) => i.id).join()) {
            await api.reorderItems(g.id, g.items.map((i) => i.id), targetId ?? undefined);
          }
        }
      } catch (err) {
        setToast(err instanceof Error ? err.message : '保存排序失败');
        await refresh();
      }
    },
    [refresh, targetId ?? undefined],
  );

  const openItem = (item: Item) => {
    const url = netMode === 'wan' ? item.urlWan || item.urlLan : item.urlLan || item.urlWan;
    if (!url) {
      setToast('该站点未配置链接');
      return;
    }
    if (item.openMode === 'modal') {
      setModal({ url, title: item.title });
      return;
    }
    if (item.openMode === 'self') {
      window.location.href = url;
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const switchNet = async (mode: NetMode) => {
    setNetMode(mode);
    try {
      const saved = await api.saveSettings({ netMode: mode }, targetId ?? undefined);
      setSettings(saved);
    } catch {
      /* 本地已切换，忽略持久化失败 */
    }
  };

  const saveItem = async (draft: ItemDraft) => {
    try {
      if (draft.id) {
        await api.updateItem(draft.id, draft, targetId ?? undefined);
      } else {
        await api.createItem(draft, targetId ?? undefined);
      }
      setPending(null);
      await refresh();
      setToast('已保存');
    } catch (err) {
      setToast(err instanceof Error ? err.message : '保存失败');
    }
  };

  const saveGroup = async (draft: { id?: number; name: string; icon: string | null }) => {
    try {
      if (draft.id) await api.updateGroup(draft.id, { name: draft.name, icon: draft.icon }, targetId ?? undefined);
      else await api.createGroup(draft.name, draft.icon, targetId ?? undefined);
      setPending(null);
      await refresh();
      setToast('已保存');
    } catch (err) {
      setToast(err instanceof Error ? err.message : '保存失败');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8">
      <header className="mb-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-[18px] font-medium">{settings.siteTitle}</h1>

          <div className="flex items-center rounded-xl border border-line bg-surface p-0.5 text-[13px]">
            <button
              className={`rounded-lg px-3 py-1 transition ${netMode === 'lan' ? 'bg-brand text-white' : 'text-muted'}`}
              onClick={() => switchNet('lan')}
            >
              内网
            </button>
            <button
              className={`rounded-lg px-3 py-1 transition ${netMode === 'wan' ? 'bg-brand text-white' : 'text-muted'}`}
              onClick={() => switchNet('wan')}
            >
              外网
            </button>
          </div>

          {user ? (
            <button
              className={`btn ${editMode ? 'btn-primary' : ''}`}
              onClick={() => setEditMode((v) => !v)}
              title="编辑模式"
            >
              <Icon icon={editMode ? 'mdi:check' : 'mdi:pencil-outline'} size={17} title="编辑" />
              <span className="hidden sm:inline">{editMode ? '完成' : '编辑'}</span>
            </button>
          ) : null}

          <button className="btn btn-ghost" onClick={cycleTheme} title="主题：自动 / 亮色 / 暗色">
            <Icon
              icon={theme === 'dark' ? 'mdi:weather-night' : theme === 'light' ? 'mdi:white-balance-sunny' : 'mdi:theme-light-dark'}
              size={18}
              title="主题"
            />
          </button>

          <button className="btn btn-ghost" onClick={() => router.push('/settings')} title="设置">
            <Icon icon="mdi:cog-outline" size={19} title="设置" />
          </button>

          <div className="relative">
            <button className="btn btn-ghost" onClick={() => setMenuOpen((v) => !v)} title="账号">
              <Icon icon={user ? 'mdi:account-circle-outline' : 'mdi:login'} size={20} title="账号" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-[calc(100%+6px)] z-30 w-44 rounded-xl border border-line bg-surface p-1.5 shadow-card"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {user ? (
                  <>
                    <div className="px-2 py-1.5 text-[12px] text-muted">
                      {user.username}
                      <span className="ml-1 rounded bg-brand/15 px-1.5 py-0.5 text-[11px] text-brand">
                        {user.role === 'admin' ? '管理员' : user.role === 'guest' ? '访客' : '用户'}
                      </span>
                    </div>
                    <button
                      className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-brand/10"
                      onClick={() => {
                        setMenuOpen(false);
                        setPwForm({ oldPassword: '', newPassword: '' });
                      }}
                    >
                      修改密码
                    </button>
                    <button
                      className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-brand/10"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push('/settings');
                      }}
                    >
                      设置中心
                    </button>
                    <button
                      className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-red-500 hover:bg-red-500/10"
                      onClick={async () => {
                        await api.logout();
                        setMenuOpen(false);
                        router.refresh();
                        window.location.reload();
                      }}
                    >
                      退出登录
                    </button>
                  </>
                ) : (
                  <button
                    className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-brand/10"
                    onClick={() => router.push('/login')}
                  >
                    登录
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <SearchBar settings={settings} items={allItems} onOpenItem={openItem} />
      </header>

      {settings.widgetsEnabled && settings.widgetPosition === 'top' ? (
        <Widgets
          showSystem={settings.widgetSystem}
          showDocker={settings.widgetDocker && settings.dockerEnabled}
          refreshSec={settings.widgetRefresh}
        />
      ) : null}

      {editMode && user ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand/5 px-3 py-2 text-[13px]">
          <Icon icon="mdi:information-outline" size={17} title="提示" />
          编辑模式：可直接拖动卡片与分组排序，点击卡片上的铅笔修改，加号新增。
          {isAdmin && users.length ? (
            <select
              className="field ml-auto w-auto"
              value={targetId === null ? 'self' : String(targetId)}
              onChange={(e) => switchTarget(e.target.value)}
              title="选择要编辑的账号内容"
            >
              <option value="self">编辑：我的导航</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  编辑：{u.role === 'guest' ? '访客账号' : u.username}
                </option>
              ))}
            </select>
          ) : null}
          <button
            className={isAdmin && users.length ? 'btn' : 'btn ml-auto'}
            onClick={() => setPending({ kind: 'group', draft: { name: '', icon: 'mdi:folder-outline' } })}
          >
            <Icon icon="mdi:folder-plus-outline" size={17} title="分组" />
            新增分组
          </button>
        </div>
      ) : null}

      {isGuestView ? (
        <div className="mb-4 rounded-xl border border-line bg-surface/60 px-3 py-2 text-[13px] text-muted">
          当前为访客浏览（只读）
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Icon icon="mdi:view-grid-plus-outline" size={44} title="空" />
          <p className="text-[14px] text-muted">还没有任何分组</p>
          {user ? (
            <button
              className="btn btn-primary"
              onClick={() => setPending({ kind: 'group', draft: { name: '常用服务', icon: 'mdi:star-outline' } })}
            >
              创建第一个分组
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => router.push('/login')}>
              登录后可自定义
            </button>
          )}
        </div>
      ) : (
        <NavBoard
          groups={groups}
          setGroups={setGroups}
          settings={settings}
          netMode={netMode}
          editMode={editMode && !!user}
          onPersist={persist}
          onOpenItem={openItem}
          onEditItem={(item) => setPending({ kind: 'item', draft: itemToDraft(item) })}
          onEditGroup={(group: Group) =>
            setPending({ kind: 'group', draft: { id: group.id, name: group.name, icon: group.icon } })
          }
          onDeleteItem={(item) => setConfirmDelete({ kind: 'item', id: item.id, name: item.title })}
          onDeleteGroup={(group) => setConfirmDelete({ kind: 'group', id: group.id, name: group.name })}
          onAddItem={(groupId) => setPending({ kind: 'item', draft: emptyItemDraft(groupId) })}
        />
      )}

      {settings.widgetsEnabled && settings.widgetPosition === 'bottom' ? (
        <div className="mt-6">
          <Widgets
            showSystem={settings.widgetSystem}
            showDocker={settings.widgetDocker && settings.dockerEnabled}
            refreshSec={settings.widgetRefresh}
          />
        </div>
      ) : null}

      {settings.footerEnabled && settings.footerText ? (
        <footer className="mt-10 border-t border-line pt-4 text-center text-[12px] text-muted">
          {settings.footerText}
        </footer>
      ) : null}

      {pending?.kind === 'item' ? (
        <ItemDialog
          draft={pending.draft}
          groups={groups}
          onClose={() => setPending(null)}
          onSave={saveItem}
          onDelete={
            pending.draft.id
              ? () => setConfirmDelete({ kind: 'item', id: pending.draft.id!, name: pending.draft.title })
              : undefined
          }
        />
      ) : null}

      {pending?.kind === 'group' ? (
        <GroupDialog draft={pending.draft} onClose={() => setPending(null)} onSave={saveGroup} />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          message={`确定删除「${confirmDelete.name}」吗？此操作不可恢复。`}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              if (confirmDelete.kind === 'item') await api.deleteItem(confirmDelete.id, targetId ?? undefined);
              else await api.deleteGroup(confirmDelete.id, targetId ?? undefined);
              setConfirmDelete(null);
              setPending(null);
              await refresh();
              setToast('已删除');
            } catch (err) {
              setToast(err instanceof Error ? err.message : '删除失败');
            }
          }}
        />
      ) : null}

      {pwForm ? (
        <div className="modal-backdrop" onClick={() => setPwForm(null)}>
          <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-[15px] font-medium">修改密码</h3>
            <div className="space-y-3">
              <input
                className="field"
                type="password"
                placeholder="当前密码"
                value={pwForm.oldPassword}
                onChange={(e) => setPwForm({ ...pwForm, oldPassword: e.target.value })}
              />
              <input
                className="field"
                type="password"
                placeholder="新密码（至少 6 位）"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn" onClick={() => setPwForm(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await api.changePassword(pwForm.oldPassword, pwForm.newPassword);
                    setPwForm(null);
                    setToast('密码已更新');
                  } catch (err) {
                    setToast(err instanceof Error ? err.message : '修改失败');
                  }
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <WebModal url={modal?.url ?? null} title={modal?.title} onClose={() => setModal(null)} />

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-line bg-surface px-4 py-2 text-[13px] shadow-card">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

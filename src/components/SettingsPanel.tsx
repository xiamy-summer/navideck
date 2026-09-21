'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Icon } from './Icon';
import type { Role, SearchEngine, Settings, UploadedFile, User } from '@/lib/types';

type Tab = 'appearance' | 'search' | 'custom' | 'data' | 'users' | 'about';

const TABS: Array<{ id: Tab; label: string; icon: string; adminOnly?: boolean }> = [
  { id: 'appearance', label: '外观', icon: 'mdi:palette-outline' },
  { id: 'search', label: '搜索', icon: 'mdi:magnify' },
  { id: 'custom', label: '自定义代码', icon: 'mdi:code-braces' },
  { id: 'data', label: '数据与文件', icon: 'mdi:database-outline' },
  { id: 'users', label: '账号', icon: 'mdi:account-multiple-outline', adminOnly: true },
  { id: 'about', label: '关于', icon: 'mdi:information-outline' },
];

interface Props {
  user: User;
  initialSettings: Settings;
  users: User[];
}

export function SettingsPanel({ user, initialSettings, users: initialUsers }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('appearance');
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [as, setAs] = useState<number | null>(null);
  const [isGlobal, setIsGlobal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const reload = async (nextAs: number | null, nextGlobal: boolean) => {
    try {
      setSettings(await api.settings(nextAs ?? undefined, nextGlobal));
    } catch {
      setToast('读取设置失败');
    }
  };

  const save = async (patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      const saved = await api.saveSettings(patch, as ?? undefined, isGlobal);
      setSettings(saved);
    } catch (err) {
      setToast(err instanceof Error ? err.message : '保存失败');
    }
  };

  const selectTarget = async (value: string) => {
    if (value === 'global') {
      setAs(null);
      setIsGlobal(true);
      await reload(null, true);
      return;
    }
    const id = value === 'self' ? null : Number(value);
    setAs(id);
    setIsGlobal(false);
    await reload(id, false);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost" onClick={() => router.push('/')}>
          <Icon icon="mdi:arrow-left" size={18} title="返回" />
          返回首页
        </button>
        <h1 className="text-[17px] font-medium">设置中心</h1>

        {isAdmin ? (
          <select
            className="field ml-auto w-auto"
            value={isGlobal ? 'global' : as === null ? 'self' : String(as)}
            onChange={(e) => selectTarget(e.target.value)}
          >
            <option value="self">我的配置</option>
            <option value="global">全局默认（新用户继承）</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.role === 'guest' ? '访客账号' : `用户：${u.username}`}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`btn ${tab === t.id ? 'btn-primary' : ''}`}
          >
            <Icon icon={t.icon} size={17} title={t.label} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {tab === 'appearance' ? (
          <AppearanceTab settings={settings} onSave={save} />
        ) : null}
        {tab === 'search' ? <SearchTab settings={settings} onSave={save} /> : null}
        {tab === 'custom' ? <CustomTab settings={settings} onSave={save} /> : null}
        {tab === 'data' ? (
          <DataTab
            toast={setToast}
            as={as}
            isGlobal={isGlobal}
            settings={settings}
            onSave={save}
          />
        ) : null}
        {tab === 'users' && isAdmin ? (
          <UsersTab users={users} setUsers={setUsers} current={user} toast={setToast} />
        ) : null}
        {tab === 'about' ? <AboutTab /> : null}
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-line bg-surface px-4 py-2 text-[13px] shadow-card">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ 通用小组件 ------------------------------ */

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line/60 py-3 last:border-0">
      <div className="min-w-[150px]">
        <div className="text-[13px]">{label}</div>
        {hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative h-6 w-11 rounded-full transition"
      style={{ background: value ? 'rgb(var(--brand))' : 'rgb(var(--line))' }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
        style={{ left: value ? 22 : 2 }}
      />
    </button>
  );
}

function Num({
  value,
  onChange,
  min = 0,
  max = 999,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-[rgb(var(--brand))]"
      />
      <span className="w-12 text-right text-[12px] text-muted">
        {value}
        {suffix}
      </span>
    </div>
  );
}

/* ------------------------------ 外观 ------------------------------ */

function AppearanceTab({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  return (
    <div>
      <Row label="站点标题">
        <input className="field w-56" value={settings.siteTitle} onChange={(e) => onSave({ siteTitle: e.target.value })} />
      </Row>

      <Row label="主题模式" hint="自动跟随系统">
        <div className="flex rounded-xl border border-line p-0.5 text-[13px]">
          {(['auto', 'light', 'dark'] as const).map((m) => (
            <button
              key={m}
              className={`rounded-lg px-3 py-1 ${settings.theme === m ? 'bg-brand text-white' : 'text-muted'}`}
              onClick={() => onSave({ theme: m })}
            >
              {m === 'auto' ? '自动' : m === 'light' ? '亮色' : '暗色'}
            </button>
          ))}
        </div>
      </Row>

      <Row label="主题色">
        <input
          type="color"
          value={settings.accent}
          onChange={(e) => onSave({ accent: e.target.value })}
          className="h-8 w-14 cursor-pointer rounded border border-line bg-transparent"
        />
        <input className="field w-28" value={settings.accent} onChange={(e) => onSave({ accent: e.target.value })} />
      </Row>

      <Row label="背景图片" hint="填写图片 URL，留空为纯色">
        <input
          className="field w-64"
          placeholder="https://…/bg.jpg"
          value={settings.bgImage}
          onChange={(e) => onSave({ bgImage: e.target.value })}
        />
      </Row>

      <Row label="每行卡片数">
        <Num value={settings.columns} min={2} max={12} onChange={(v) => onSave({ columns: v })} />
      </Row>

      <Row label="卡片圆角">
        <Num value={settings.cardRadius} min={0} max={28} suffix="px" onChange={(v) => onSave({ cardRadius: v })} />
      </Row>

      <Row label="卡片不透明度">
        <Num value={settings.cardOpacity} min={30} max={100} suffix="%" onChange={(v) => onSave({ cardOpacity: v })} />
      </Row>

      <Row label="图标尺寸">
        <Num value={settings.iconSize} min={20} max={64} suffix="px" onChange={(v) => onSave({ iconSize: v })} />
      </Row>

      <Row label="显示描述文字">
        <Switch value={settings.showDesc} onChange={(v) => onSave({ showDesc: v })} />
      </Row>

      <Row label="页脚">
        <Switch value={settings.footerEnabled} onChange={(v) => onSave({ footerEnabled: v })} />
        <input
          className="field w-64"
          placeholder="页脚内容，支持 HTML"
          value={settings.footerText}
          onChange={(e) => onSave({ footerText: e.target.value })}
        />
      </Row>

      <Row label="默认网络模式">
        <div className="flex rounded-xl border border-line p-0.5 text-[13px]">
          {(['lan', 'wan'] as const).map((m) => (
            <button
              key={m}
              className={`rounded-lg px-3 py-1 ${settings.netMode === m ? 'bg-brand text-white' : 'text-muted'}`}
              onClick={() => onSave({ netMode: m })}
            >
              {m === 'lan' ? '内网' : '外网'}
            </button>
          ))}
        </div>
      </Row>

      <Row label="访客访问" hint="允许未登录访客只读浏览访客账号内容">
        <Switch value={settings.guestEnabled} onChange={(v) => onSave({ guestEnabled: v })} />
      </Row>
    </div>
  );
}

/* ------------------------------ 搜索 ------------------------------ */

function SearchTab({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  const engines = settings.searchEngines ?? [];

  const updateEngines = (next: SearchEngine[]) => onSave({ searchEngines: next });

  return (
    <div>
      <Row label="启用搜索框">
        <Switch value={settings.searchEnabled} onChange={(v) => onSave({ searchEnabled: v })} />
      </Row>

      <Row label="提示文字">
        <input
          className="field w-56"
          value={settings.searchPlaceholder}
          onChange={(e) => onSave({ searchPlaceholder: e.target.value })}
        />
      </Row>

      <Row label="默认引擎">
        <select
          className="field w-40"
          value={settings.searchEngine}
          onChange={(e) => onSave({ searchEngine: e.target.value })}
        >
          {engines.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Row>

      <Row label="搜索框宽度">
        <Num value={settings.searchWidth} min={240} max={900} suffix="px" onChange={(v) => onSave({ searchWidth: v })} />
      </Row>

      <Row label="搜索框圆角">
        <Num value={settings.searchRadius} min={0} max={999} suffix="px" onChange={(v) => onSave({ searchRadius: v })} />
      </Row>

      <Row label="背景颜色" hint="留空则跟随主题">
        <input
          type="color"
          value={settings.searchBg || '#ffffff'}
          onChange={(e) => onSave({ searchBg: e.target.value })}
          className="h-8 w-14 cursor-pointer rounded border border-line bg-transparent"
        />
        <button className="btn" onClick={() => onSave({ searchBg: '' })}>
          跟随主题
        </button>
      </Row>

      <Row label="文字颜色" hint="留空则跟随主题">
        <input
          type="color"
          value={settings.searchText || '#111827'}
          onChange={(e) => onSave({ searchText: e.target.value })}
          className="h-8 w-14 cursor-pointer rounded border border-line bg-transparent"
        />
        <button className="btn" onClick={() => onSave({ searchText: '' })}>
          跟随主题
        </button>
      </Row>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 flex items-center">
          <h3 className="text-[14px] font-medium">搜索引擎</h3>
          <button
            className="btn ml-auto"
            onClick={() =>
              updateEngines([
                ...engines,
                { id: `e${Date.now()}`, name: '新引擎', url: 'https://example.com/search?q={q}', icon: 'mdi:magnify' },
              ])
            }
          >
            <Icon icon="mdi:plus" size={16} title="添加" />
            添加
          </button>
        </div>

        <div className="space-y-2">
          {engines.map((engine, index) => (
            <div key={engine.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
              <input
                className="field w-24"
                value={engine.name}
                onChange={(e) => updateEngines(engines.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className="field min-w-[220px] flex-1"
                value={engine.url}
                placeholder="https://…/search?q={q}"
                onChange={(e) => updateEngines(engines.map((x, i) => (i === index ? { ...x, url: e.target.value } : x)))}
              />
              <input
                className="field w-44"
                value={engine.icon}
                placeholder="mdi:magnify"
                onChange={(e) => updateEngines(engines.map((x, i) => (i === index ? { ...x, icon: e.target.value } : x)))}
              />
              <button
                className="btn btn-ghost text-red-500"
                onClick={() => updateEngines(engines.filter((_, i) => i !== index))}
              >
                <Icon icon="mdi:trash-can-outline" size={17} title="删除" />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">地址中用 {'{q}'} 表示关键词占位符。</p>
      </div>
    </div>
  );
}

/* ------------------------------ 自定义代码 ------------------------------ */

function CustomTab({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 flex items-center">
          <h3 className="text-[14px] font-medium">自定义 CSS</h3>
          <button className="btn ml-auto" onClick={() => onSave({ customCss: settings.customCss })}>
            应用
          </button>
        </div>
        <textarea
          className="field h-48 font-mono text-[12px]"
          placeholder={'.card { border-radius: 20px; }'}
          value={settings.customCss}
          onChange={(e) => onSave({ customCss: e.target.value })}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center">
          <h3 className="text-[14px] font-medium">自定义 JS</h3>
          <button className="btn ml-auto" onClick={() => onSave({ customJs: settings.customJs })}>
            应用
          </button>
        </div>
        <textarea
          className="field h-48 font-mono text-[12px]"
          placeholder={'console.log("hello");'}
          value={settings.customJs}
          onChange={(e) => onSave({ customJs: e.target.value })}
        />
        <p className="mt-2 text-[12px] text-muted">
          自定义代码仅对当前配置文件生效，保存后刷新页面即可看到效果。
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ 数据与文件 ------------------------------ */

function DataTab({
  toast,
  as,
  isGlobal,
  settings,
  onSave,
}: {
  toast: (msg: string) => void;
  as: number | null;
  isGlobal: boolean;
  settings: Settings;
  onSave: (p: Partial<Settings>) => void;
}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const query = as ? `?as=${as}` : '';

  const loadFiles = async () => {
    try {
      setFiles(await api.listFiles(as ?? undefined));
    } catch {
      /* 忽略 */
    }
  };

  useEffect(() => {
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [as]);

  const upload = async (file: File) => {
    try {
      const res = await api.uploadFile(file, as ?? undefined);
      toast(res.dedup ? '文件已存在，已复用（节省空间）' : '上传成功');
      await loadFiles();
    } catch {
      toast('上传失败');
    }
  };

  const doImport = async (file: File, mode: 'replace' | 'append') => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await api.importData(payload, mode, as ?? undefined);
      toast(`导入成功：${res.groupCount} 个分组 / ${res.itemCount} 个站点`);
    } catch {
      toast('导入失败：文件格式不正确');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-[14px] font-medium">备份与导入</h3>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`/api/export${query}`} download>
            <Icon icon="mdi:export" size={17} title="导出" />
            导出配置
          </a>
          <button className="btn" onClick={() => importInput.current?.click()}>
            <Icon icon="mdi:import" size={17} title="导入" />
            导入（合并）
          </button>
          <button
            className="btn"
            onClick={() => {
              if (confirm('导入将清空当前分组后重建，确定继续？')) importInput.current?.click();
            }}
          >
            导入（覆盖）
          </button>
        </div>
        <input
          ref={importInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImport(file, 'append');
            e.target.value = '';
          }}
        />
        <p className="mt-2 text-[12px] text-muted">导出内容为 JSON，可用于迁移或分享给他人。</p>
      </div>

      <div className="border-t border-line pt-5">
        <div className="mb-2 flex items-center">
          <h3 className="text-[14px] font-medium">文件管理</h3>
          <button className="btn ml-auto" onClick={() => fileInput.current?.click()}>
            <Icon icon="mdi:upload" size={17} title="上传" />
            上传文件
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
        <p className="mb-3 text-[12px] text-muted">
          相同内容的文件只保存一份（按内容哈希去重），重复上传不会占用额外空间。
        </p>

        {files.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-muted">暂无上传文件</p>
        ) : (
          <div className="space-y-2">
            {files.map((f) => {
              const url = `${location.origin}/api/files/${f.path}`;
              return (
                <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-[13px]">
                  <Icon icon="mdi:file-outline" size={18} title="文件" />
                  <span className="max-w-[220px] truncate">{f.name}</span>
                  <span className="text-[12px] text-muted">{(f.size / 1024).toFixed(1)} KB</span>
                  {f.refCount > 1 ? <span className="chip">复用 {f.refCount} 次</span> : null}
                  <button
                    className="btn btn-ghost ml-auto"
                    onClick={() => {
                      void navigator.clipboard.writeText(url);
                      toast('链接已复制');
                    }}
                  >
                    复制链接
                  </button>
                  <button
                    className="btn btn-ghost text-red-500"
                    onClick={async () => {
                      await api.deleteFile(f.id, as ?? undefined);
                      await loadFiles();
                      toast('已删除');
                    }}
                  >
                    <Icon icon="mdi:trash-can-outline" size={17} title="删除" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="mb-2 text-[14px] font-medium">恢复默认</h3>
        <button
          className="btn btn-danger"
          onClick={async () => {
            if (!confirm('确定恢复当前配置的默认值？')) return;
            const url = new URL(window.location.href);
            await fetch(`/api/settings/reset${as ? `?as=${as}` : ''}`, { method: 'POST' });
            window.location.reload();
          }}
        >
          恢复默认设置
        </button>
        <p className="mt-2 text-[12px] text-muted">仅重置外观与功能开关，不会删除分组和站点。</p>
      </div>
    </div>
  );
}

/* ------------------------------ 账号 ------------------------------ */

function UsersTab({
  users,
  setUsers,
  current,
  toast,
}: {
  users: User[];
  setUsers: (u: User[]) => void;
  current: User;
  toast: (msg: string) => void;
}) {
  const [form, setForm] = useState({ username: '', password: '', role: 'user' as Role });
  const [editPw, setEditPw] = useState<{ id: number; password: string } | null>(null);

  const reload = async () => setUsers(await api.users());

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-[14px] font-medium">新增账号</h3>
        <div className="flex flex-wrap gap-2">
          <input
            className="field w-40"
            placeholder="用户名"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="field w-40"
            type="password"
            placeholder="密码至少 6 位"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select
            className="field w-28"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await api.createUser(form.username, form.password, form.role);
                setForm({ username: '', password: '', role: 'user' });
                await reload();
                toast('已创建');
              } catch (err) {
                toast(err instanceof Error ? err.message : '创建失败');
              }
            }}
          >
            创建
          </button>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-[14px] font-medium">账号列表</h3>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-[13px]">
              <Icon icon="mdi:account-outline" size={18} title={u.username} />
              <span>{u.username}</span>
              <span className="chip">
                {u.role === 'admin' ? '管理员' : u.role === 'guest' ? '访客' : '用户'}
              </span>
              {u.id === current.id ? <span className="chip">当前登录</span> : null}

              <div className="ml-auto flex gap-1">
                {u.role !== 'guest' ? (
                  <button className="btn btn-ghost" onClick={() => setEditPw({ id: u.id, password: '' })}>
                    重置密码
                  </button>
                ) : null}
                {u.role !== 'guest' && u.id !== current.id ? (
                  <button
                    className="btn btn-ghost text-red-500"
                    onClick={async () => {
                      if (!confirm(`删除账号 ${u.username}？其分组与站点也会一并删除。`)) return;
                      await api.deleteUser(u.id);
                      await reload();
                      toast('已删除');
                    }}
                  >
                    删除
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editPw ? (
        <div className="modal-backdrop" onClick={() => setEditPw(null)}>
          <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-[15px] font-medium">重置密码</h3>
            <input
              className="field"
              type="password"
              placeholder="新密码（至少 6 位）"
              value={editPw.password}
              onChange={(e) => setEditPw({ ...editPw, password: e.target.value })}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setEditPw(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await api.updateUser(editPw.id, { password: editPw.password });
                    setEditPw(null);
                    toast('密码已重置');
                  } catch (err) {
                    toast(err instanceof Error ? err.message : '失败');
                  }
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ 关于 ------------------------------ */

function AboutTab() {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed">
      <p className="font-medium">NAS 导航面板 v0.1.0</p>
      <p className="text-muted">
        轻量自托管导航页，支持多账号隔离、内外网切换、Iconify 图标、拖拽排序、自定义代码与内置小窗口打开。
      </p>
      <ul className="list-inside list-disc space-y-1 text-muted">
        <li>数据存储：SQLite 单文件，无需外部数据库</li>
        <li>部署：Docker 镜像支持 amd64 / arm64</li>
        <li>图标：Iconify（20 万+），离线时自动降级为首字占位</li>
        <li>后续版本：Docker 容器管理、系统监控小组件、多语言</li>
      </ul>
    </div>
  );
}

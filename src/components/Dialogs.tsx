'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon';
import { IconPicker } from './IconPicker';
import type { Group, Item, ItemService, OpenMode } from '@/lib/types';
import type { ProbeResult, ServiceTemplate } from '@/lib/serviceWidgets';
import { api, type DockerContainer } from '@/lib/api-client';
import { useI18n } from '@/i18n';

/**
 * 内置服务模板清单：模块级缓存，多个对话框共用一次请求。
 * 模板是静态内置数据，且「接入服务数据」按钮依赖它决定默认类型，
 * 若每次打开弹窗才现拉，手快时会在模板到位前点到按钮，类型被误落成「自定义 API」。
 */
let templatesPromise: Promise<ServiceTemplate[]> | null = null;
export function loadServiceTemplates(): Promise<ServiceTemplate[]> {
  if (!templatesPromise) {
    templatesPromise = api
      .serviceTemplates()
      .then((r) => r.templates ?? [])
      .catch((err) => {
        templatesPromise = null; // 失败允许下次重试
        throw err;
      });
  }
  return templatesPromise;
}

export interface ItemDraft {
  id?: number;
  groupId: number;
  title: string;
  icon: string | null;
  urlLan: string;
  urlWan: string;
  desc: string;
  openMode: OpenMode;
  color: string | null;
  /** 服务集成配置（ItemService 序列化后的 JSON 字符串） */
  service: string | null;
  /** 关联的 Docker 容器名，用于在卡片上显示运行状态 */
  container: string | null;
  /** 卡片尺寸：sm / md / lg */
  cardSize: 'sm' | 'md' | 'lg' | null;
}

function parseService(raw: string | null): ItemService | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ItemService;
  } catch {
    return null;
  }
}

function headersToText(list: Array<{ name: string; value: string }>): string {
  return (list ?? []).map((h) => `${h.name}: ${h.value}`).join('\n');
}

function textToHeaders(text: string): Array<{ name: string; value: string }> {
  return text
    .split('\n')
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx <= 0) return null;
      return { name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((x): x is { name: string; value: string } => x !== null);
}

function fieldsToText(list: Array<{ label: string; path: string }>): string {
  return (list ?? []).map((f) => `${f.label} ${f.path}`).join('\n');
}

function textToFields(text: string): Array<{ label: string; path: string }> {
  return text
    .split('\n')
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) return null;
      return { label: parts[0], path: parts[1] };
    })
    .filter((x): x is { label: string; path: string } => x !== null);
}

interface ItemDialogProps {
  draft: ItemDraft;
  groups: Group[];
  onClose: () => void;
  onSave: (draft: ItemDraft) => void;
  onDelete?: () => void;
}

export function ItemDialog({ draft, groups, onClose, onSave, onDelete }: ItemDialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<ItemDraft>(draft);

  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  /** 模板清单是否已就绪：未就绪时不允许「接入服务数据」，避免默认类型误落为自定义 */
  const [templatesReady, setTemplatesReady] = useState(false);
  const [svc, setSvc] = useState<ItemService | null>(() => parseService(draft.service));
  /** 服务地址来源：内网 / 外网 / 自定义；默认按已存 url 与站点地址的关系推断 */
  const [urlSrc, setUrlSrc] = useState<'lan' | 'wan' | 'custom'>(() => {
    const s = parseService(draft.service);
    const lan = form.urlLan || '';
    const wan = form.urlWan || '';
    if (s?.url && lan && s.url === lan) return 'lan';
    if (s?.url && wan && s.url === wan) return 'wan';
    return 'custom';
  });
  const [testing, setTesting] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [dockerAvailable, setDockerAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    loadServiceTemplates()
      .then((list) => {
        if (!alive) return;
        setTemplates(list);
        setTemplatesReady(true);
      })
      .catch(() => {
        // 失败也置为就绪，避免「接入服务数据」按钮永久停在加载态（退化为自定义 API）
        if (alive) setTemplatesReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const updateSvc = (patch: Partial<ItemService>) => {
    const next: ItemService = { type: '', url: '', key: '', ...(svc ?? {}), ...patch };
    setSvc(next);
    setProbe(null);
    setForm((prev) => ({ ...prev, service: JSON.stringify(next) }));
  };

  /** 切换服务地址来源：内网/外网取站点对应字段（只读），自定义允许手填 */
  const applyUrlSrc = (src: 'lan' | 'wan' | 'custom') => {
    setUrlSrc(src);
    if (src === 'lan') updateSvc({ url: form.urlLan });
    else if (src === 'wan') updateSvc({ url: form.urlWan });
  };

  // 地址来源为内网/外网时，跟随站点对应字段变化（改站点地址即同步服务地址）
  useEffect(() => {
    if (!svc || urlSrc === 'custom') return;
    const target = urlSrc === 'lan' ? form.urlLan : form.urlWan;
    if (svc.url === target) return;
    const next: ItemService = { ...svc, url: target };
    setSvc(next);
    setProbe(null);
    setForm((prev) => ({ ...prev, service: JSON.stringify(next) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.urlLan, form.urlWan, urlSrc]);

  const clearSvc = () => {
    setSvc(null);
    setProbe(null);
    setForm((prev) => ({ ...prev, service: null }));
  };

  const runTest = useCallback(async () => {
    if (!svc) return;
    setTesting(true);
    setProbe(null);
    try {
      setProbe(await api.serviceTest(svc));
    } catch (e) {
      setProbe({ ok: false, fields: [], message: e instanceof Error ? e.message : t('service.testFail') });
    } finally {
      setTesting(false);
    }
  }, [svc, t]);

  useEffect(() => {
    let alive = true;
    api
      .dockerContainers()
      .then((r) => {
        if (!alive) return;
        setDockerAvailable(Boolean(r.available));
        setContainers(r.containers ?? []);
      })
      .catch(() => {
        /* Docker 不可用时下拉仅剩「不关联」 */
      });
    return () => {
      alive = false;
    };
  }, []);

  /** 选中容器后自动补标题与内网地址（端口映射到当前访问主机） */
  const applyContainer = (name: string) => {
    const picked = containers.find((c) => c.name === name);
    set('container', name || null);
    if (!picked) return;
    const label = picked.name.replace(/^\//, '');
    if (!form.title.trim()) set('title', label);
    if (!form.urlLan.trim()) {
      const port = picked.ports.find((p) => p.public)?.public;
      if (port) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        set('urlLan', `http://${host}:${port}`);
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <span className="group-rule" />
          <h3 className="text-[15px] font-medium">{form.id ? t('dialog.item.edit') : t('dialog.item.add')}</h3>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[13px] text-muted">{t('dialog.item.name')}</div>
            <input className="field" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
          </div>

          <IconPicker value={form.icon} onChange={(v) => set('icon', v)} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[13px] text-muted">{t('dialog.item.urlLan')}</div>
              <input
                className="field"
                placeholder="http://192.168.1.10:8080"
                value={form.urlLan}
                onChange={(e) => set('urlLan', e.target.value)}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[13px] text-muted">{t('dialog.item.urlWan')}</div>
              <input
                className="field"
                placeholder="https://nas.example.com"
                value={form.urlWan}
                onChange={(e) => set('urlWan', e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[13px] text-muted">{t('dialog.item.container')}</div>
            <select className="field" value={form.container ?? ''} onChange={(e) => applyContainer(e.target.value)}>
              <option value="">{t('dialog.item.containerNone')}</option>
              {containers.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name.replace(/^\//, '')} · {c.state}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              {dockerAvailable ? t('dialog.item.containerHint') : t('dialog.item.containerUnavailable')}
            </p>
          </div>

          <div>
            <div className="mb-1.5 text-[13px] text-muted">{t('dialog.item.desc')}</div>
            <input className="field" value={form.desc} onChange={(e) => set('desc', e.target.value)} />
          </div>

          <div className="border-t border-line pt-3">
            <div className="mb-1.5 flex items-center">
              <div className="text-[13px] text-muted">{t('service.title')}</div>
              {svc ? (
                <button className="btn btn-ghost ml-auto" onClick={clearSvc}>
                  {t('common.remove')}
                </button>
              ) : null}
            </div>

            {!svc ? (
              <button
                className="btn"
                disabled={!templatesReady}
                onClick={() => {
                  // 新增时优先用内网地址（站点地址与 JSON 同步，保证服务地址跟随站点变化）
                  const src: 'lan' | 'wan' | 'custom' = form.urlLan ? 'lan' : form.urlWan ? 'wan' : 'custom';
                  setUrlSrc(src);
                  updateSvc({ type: templates[0]?.id ?? 'custom', url: form.urlLan || form.urlWan || '', key: '' });
                }}
              >
                <Icon icon="mdi:chart-box-outline" size={16} title={t('service.add')} />
                {templatesReady ? t('service.add') : t('common.loading')}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select className="field" value={svc.type} onChange={(e) => updateSvc({ type: e.target.value })}>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                    <option value="custom">{t('service.custom')}</option>
                  </select>
                  <select className="field" value={urlSrc} onChange={(e) => applyUrlSrc(e.target.value as 'lan' | 'wan' | 'custom')}>
                    <option value="lan">{t('service.urlLan')}</option>
                    <option value="wan">{t('service.urlWan')}</option>
                    <option value="custom">{t('service.urlCustom')}</option>
                  </select>
                </div>

                {urlSrc === 'custom' ? (
                  <input
                    className="field"
                    placeholder="http://192.168.1.10:8989"
                    value={svc.url}
                    onChange={(e) => updateSvc({ url: e.target.value })}
                  />
                ) : (
                  <div className={`field flex items-center gap-2 ${svc.url ? '' : '!text-muted'}`}>
                    <Icon icon={urlSrc === 'lan' ? 'mdi:lan' : 'mdi:earth'} size={15} title={urlSrc === 'lan' ? t('service.urlLan') : t('service.urlWan')} />
                    {svc.url ? (
                      <span className="truncate">{svc.url}</span>
                    ) : (
                      <span className="truncate text-[12px]">
                        {t('service.urlEmptyHint', { type: urlSrc === 'lan' ? t('service.urlLan') : t('service.urlWan') })}
                      </span>
                    )}
                  </div>
                )}

                <input
                  className="field"
                  type="password"
                  autoComplete="off"
                  placeholder={templates.find((x) => x.id === svc.type)?.keyHint ?? t('service.key')}
                  value={svc.key}
                  onChange={(e) => updateSvc({ key: e.target.value })}
                />

                {svc.type === 'custom' ? (
                  <div className="space-y-2 rounded-xl border border-line p-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className="field"
                        value={svc.custom?.method ?? 'GET'}
                        onChange={(e) =>
                          updateSvc({
                            custom: {
                              ...(svc.custom ?? { path: '/', headers: [], fields: [] }),
                              method: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                      <input
                        className="field"
                        placeholder="/api/v3/series"
                        value={svc.custom?.path ?? ''}
                        onChange={(e) =>
                          updateSvc({
                            custom: {
                              ...(svc.custom ?? { method: 'GET', headers: [], fields: [] }),
                              path: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <textarea
                      className="field h-16"
                      placeholder={t('service.headersHint')}
                      value={headersToText(svc.custom?.headers ?? [])}
                      onChange={(e) =>
                        updateSvc({
                          custom: {
                            ...(svc.custom ?? { method: 'GET', path: '/', fields: [] }),
                            headers: textToHeaders(e.target.value),
                          },
                        })
                      }
                    />
                    <textarea
                      className="field h-16"
                      placeholder={t('service.fieldsHint')}
                      value={fieldsToText(svc.custom?.fields ?? [])}
                      onChange={(e) =>
                        updateSvc({
                          custom: {
                            ...(svc.custom ?? { method: 'GET', path: '/', headers: [] }),
                            fields: textToFields(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn" disabled={testing || !svc.url} onClick={() => void runTest()}>
                    {testing ? t('common.loading') : t('service.test')}
                  </button>
                  {probe ? (
                    probe.ok ? (
                      <span className="text-[12px] text-green-600">{t('service.testOk')}</span>
                    ) : (
                      <span className="text-[12px] text-red-500">{probe.message ?? t('service.testFail')}</span>
                    )
                  ) : null}
                </div>

                {probe && probe.fields.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {probe.fields.map((f) => (
                      <span key={f.label} className="chip">
                        {f.label} {f.value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[13px] text-muted">{t('dialog.item.group')}</div>
              <select
                className="field"
                value={form.groupId}
                onChange={(e) => set('groupId', Number(e.target.value))}
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1.5 text-[13px] text-muted">{t('dialog.item.openMode')}</div>
              <select
                className="field"
                value={form.openMode}
                onChange={(e) => set('openMode', e.target.value as OpenMode)}
              >
                <option value="blank">{t('dialog.item.openBlank')}</option>
                <option value="modal">{t('dialog.item.openModal')}</option>
                <option value="self">{t('dialog.item.openSelf')}</option>
              </select>
            </div>
            <div>
              <div className="mb-1.5 text-[13px] text-muted">{t('dialog.item.cardSize')}</div>
              <select
                className="field"
                value={form.cardSize ?? 'md'}
                onChange={(e) => set('cardSize', e.target.value === 'md' ? null : (e.target.value as 'sm' | 'lg'))}
              >
                <option value="sm">{t('dialog.item.sizeSm')}</option>
                <option value="md">{t('dialog.item.sizeMd')}</option>
                <option value="lg">{t('dialog.item.sizeLg')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          {onDelete ? (
            <button className="btn btn-danger mr-auto" onClick={onDelete}>
              {t('common.delete')}
            </button>
          ) : null}
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!form.title.trim()) return;
              onSave({ ...form, title: form.title.trim() });
            }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface GroupDialogProps {
  draft: { id?: number; name: string; icon: string | null };
  onClose: () => void;
  onSave: (draft: { id?: number; name: string; icon: string | null }) => void;
}

export function GroupDialog({ draft, onClose, onSave }: GroupDialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState(draft);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <span className="group-rule" />
          <h3 className="text-[15px] font-medium">{form.id ? t('dialog.group.edit') : t('dialog.group.add')}</h3>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[13px] text-muted">{t('dialog.group.name')}</div>
            <input
              className="field"
              value={form.name}
              autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!form.name.trim()) return;
              onSave({ ...form, name: form.name.trim() });
            }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  message,
  onClose,
  onConfirm,
}: {
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <Icon icon="mdi:help-circle-outline" size={24} title={t('common.confirm')} />
          <p className="text-[14px] leading-relaxed">{message}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function emptyItemDraft(groupId: number): ItemDraft {
  return {
    groupId,
    title: '',
    icon: 'mdi:web',
    urlLan: '',
    urlWan: '',
    desc: '',
    openMode: 'blank',
    color: null,
    service: null,
    container: null,
    cardSize: null,
  };
}

export function itemToDraft(item: Item): ItemDraft {
  return {
    id: item.id,
    groupId: item.groupId,
    title: item.title,
    icon: item.icon,
    urlLan: item.urlLan,
    urlWan: item.urlWan,
    desc: item.desc ?? '',
    openMode: item.openMode,
    color: item.color,
    service: item.service ?? null,
    container: item.container ?? null,
    cardSize: item.cardSize ?? null,
  };
}

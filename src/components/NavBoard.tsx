'use client';

import { useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icon';
import type { GroupWithItems } from '@/lib/api-client';
import type { Group, Item, NetMode, Settings } from '@/lib/types';
import type { ProbeResult } from '@/lib/serviceWidgets';
import { useI18n } from '@/i18n';

interface Props {
  groups: GroupWithItems[];
  setGroups: (updater: (prev: GroupWithItems[]) => GroupWithItems[]) => void;
  settings: Settings;
  netMode: NetMode;
  editMode: boolean;
  /** 站点服务集成的实时状态，key 为站点 id */
  serviceStatus?: Record<string, ProbeResult>;
  /** 容器名到运行状态的映射，用于卡片上的状态点 */
  containerStatus?: Record<string, string>;
  /** 未绑定容器站点的 HTTP 探活结果，key 为站点 id */
  probeStatus?: Record<string, { ok: boolean; reason?: string }>;
  onPersist: (prev: GroupWithItems[], next: GroupWithItems[]) => void;
  onOpenItem: (item: Item) => void;
  onEditItem: (item: Item, groupId: number) => void;
  onEditGroup: (group: Group) => void;
  onDeleteItem: (item: Item) => void;
  onDeleteGroup: (group: Group) => void;
  onAddItem: (groupId: number) => void;
}

function findContainer(id: string, groups: GroupWithItems[]): string | null {
  if (id.startsWith('g-')) return groups.some((g) => g.id === Number(id.slice(2))) ? id : null;
  const itemId = Number(id.slice(2));
  const group = groups.find((g) => g.items.some((i) => i.id === itemId));
  return group ? `g-${group.id}` : null;
}

export function NavBoard(props: Props) {
  const { groups, setGroups, settings, netMode, editMode, onPersist } = props;
  const snapshot = useRef<GroupWithItems[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleStart = (e: DragStartEvent) => {
    snapshot.current = groups;
    setActiveId(String(e.active.id));
  };

  const handleOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const aId = String(active.id);
    const oId = String(over.id);
    if (!aId.startsWith('i-')) return;
    const from = findContainer(aId, groups);
    const to = findContainer(oId, groups);
    if (!from || !to || from === to) return;

    setGroups((prev) => {
      const src = prev.find((g) => `g-${g.id}` === from);
      const dst = prev.find((g) => `g-${g.id}` === to);
      const item = src?.items.find((i) => `i-${i.id}` === aId);
      if (!src || !dst || !item) return prev;
      const index = oId.startsWith('i-')
        ? dst.items.findIndex((i) => `i-${i.id}` === oId)
        : dst.items.length;
      return prev.map((g) => {
        if (g.id === src.id) return { ...g, items: g.items.filter((i) => i.id !== item.id) };
        if (g.id === dst.id) {
          const items = [...g.items];
          items.splice(index < 0 ? items.length : index, 0, { ...item, groupId: dst.id });
          return { ...g, items };
        }
        return g;
      });
    });
  };

  const handleEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    const before = snapshot.current;
    snapshot.current = null;
    if (!over || !before) return;
    const aId = String(active.id);
    const oId = String(over.id);
    if (aId === oId) return;

    let next: GroupWithItems[] | null = null;

    if (aId.startsWith('g-')) {
      const oldIndex = groups.findIndex((g) => `g-${g.id}` === aId);
      const newIndex = groups.findIndex((g) => `g-${g.id}` === oId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        next = arrayMove(groups, oldIndex, newIndex);
      }
    } else {
      const container = findContainer(oId, groups) ?? findContainer(aId, groups);
      const group = groups.find((g) => `g-${g.id}` === container);
      if (group) {
        const oldIndex = group.items.findIndex((i) => `i-${i.id}` === aId);
        const newIndex = oId.startsWith('i-')
          ? group.items.findIndex((i) => `i-${i.id}` === oId)
          : group.items.length - 1;
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          next = groups.map((g) =>
            g.id === group.id ? { ...g, items: arrayMove(g.items, oldIndex, newIndex) } : g,
          );
        }
      }
      if (!next && before !== groups) next = groups;
    }

    if (next) {
      setGroups(() => next as GroupWithItems[]);
      onPersist(before, next);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleStart}
      onDragOver={handleOver}
      onDragEnd={handleEnd}
      onDragCancel={() => {
        setActiveId(null);
        snapshot.current = null;
      }}
    >
      <SortableContext items={groups.map((g) => `g-${g.id}`)} strategy={verticalListSortingStrategy}>
        <div className="space-y-5">
          {groups.map((group) => (
            <SortableGroup key={group.id} group={group} {...props} activeId={activeId} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableGroup({ group, activeId, ...props }: Props & { group: GroupWithItems; activeId: string | null }) {
  const { editMode } = props;
  const { t } = useI18n();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = JSON.parse(localStorage.getItem('navideck-collapsed-groups') ?? '[]') as number[];
      return Array.isArray(raw) && raw.includes(group.id);
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        const raw = JSON.parse(localStorage.getItem('navideck-collapsed-groups') ?? '[]') as number[];
        const list = Array.isArray(raw) ? raw : [];
        const updated = next
          ? Array.from(new Set([...list, group.id]))
          : list.filter((x) => x !== group.id);
        localStorage.setItem('navideck-collapsed-groups', JSON.stringify(updated));
      } catch {
        /* 隐私模式下忽略写入失败 */
      }
      return next;
    });
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `g-${group.id}`,
    disabled: !editMode,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="card p-4"
    >
      <header className="mb-3 flex items-center gap-2">
        {editMode ? (
          <button
            className="cursor-grab text-muted hover:text-brand active:cursor-grabbing"
            title={t('common.dragSort')}
            {...attributes}
            {...listeners}
          >
            <Icon icon="mdi:drag" size={18} title={t('common.drag')} />
          </button>
        ) : null}
        <span className="group-rule" />
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center gap-1.5"
          title={collapsed ? t('group.expand') : t('group.collapse')}
        >
          <Icon
            icon={collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'}
            size={18}
            title={collapsed ? t('group.expand') : t('group.collapse')}
          />
          <span className="group-icon">
            <Icon icon={group.icon} size={18} title={group.name} />
          </span>
          <h2 className="text-[15px] font-medium">{group.name}</h2>
          <span className="count-badge">{group.items.length}</span>
        </button>

        {editMode ? (
          <div className="ml-auto flex items-center gap-1">
            <button className="btn btn-ghost" title={t('dialog.group.edit')} onClick={() => props.onEditGroup(group)}>
              <Icon icon="mdi:pencil-outline" size={17} title={t('common.edit')} />
            </button>
            <button className="btn btn-ghost" title={t('home.addSite')} onClick={() => props.onAddItem(group.id)}>
              <Icon icon="mdi:plus" size={18} title={t('common.add')} />
            </button>
            <button
              className="btn btn-ghost text-red-500"
              title={t('common.deleteGroup')}
              onClick={() => props.onDeleteGroup(group)}
            >
              <Icon icon="mdi:trash-can-outline" size={17} title={t('common.delete')} />
            </button>
          </div>
        ) : null}
      </header>

      {collapsed ? null : (
        <SortableContext items={group.items.map((i) => `i-${i.id}`)} strategy={rectSortingStrategy}>
        <div
          className="grid-area"
          style={{ ['--card-min' as string]: `${Math.max(96, Math.round(1080 / Math.max(2, props.settings.columns)))}px` }}
        >
          {group.items.map((item) => (
            <SortableItem key={item.id} item={item} activeId={activeId} {...props} />
          ))}
          {editMode ? (
            <button
              className="flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-[var(--card-radius,14px)] border border-dashed border-line text-[12px] text-muted transition hover:border-brand hover:text-brand"
              onClick={() => props.onAddItem(group.id)}
            >
              <Icon icon="mdi:plus" size={20} title={t('common.add')} />
              {t('home.addSite')}
            </button>
          ) : null}
          </div>
        </SortableContext>
      )}
    </section>
  );
}

function SortableItem({ item, ...props }: Props & { item: Item; activeId: string | null }) {
  const { settings, editMode, netMode, serviceStatus, containerStatus, probeStatus } = props;
  const containerKey = item.container ? item.container.replace(/^\//, '') : '';
  const containerState = containerKey ? containerStatus?.[containerKey] : undefined;
  // 未绑定容器的站点回退到 HTTP 探活结果（绑定容器的优先用容器状态，语义不冲突）
  const probe = !item.container ? probeStatus?.[String(item.id)] : undefined;
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `i-${item.id}`,
    disabled: !editMode,
  });

  const url = netMode === 'wan' ? item.urlWan || item.urlLan : item.urlLan || item.urlWan;

  // 状态点：绑定容器 → 容器运行状态；未绑定容器 → 探活结果；两者皆无 → 不渲染
  let dot: { cls: string; title: string } | null = null;
  if (item.container) {
    dot = {
      cls: containerState === 'running' ? 'dot-run dot-pulse' : containerState ? 'dot-warn' : 'dot-idle',
      title: `${containerKey || item.container}${containerState ? ` · ${containerState}` : ''}`,
    };
  } else if (probe) {
    dot = probe.ok
      ? { cls: 'dot-run dot-pulse', title: t('probe.up') }
      : {
          cls: 'dot-err dot-pulse',
          title: `${t('probe.down')} · ${
            probe.reason
              ? probe.reason.startsWith('http:')
                ? `HTTP ${probe.reason.slice(5)}`
                : t(`probe.reason.${probe.reason}`)
              : ''
          }`,
        };
  }

  const cardSpan = item.cardSize === 'lg' ? 2 : item.cardSize === 'sm' ? 1 : 1;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        gridColumn: `span ${cardSpan}`,
      }}
      {...(editMode ? attributes : {})}
      {...(editMode ? listeners : {})}
      className={`link-card card relative flex min-h-[92px] flex-col items-center justify-center gap-1.5 p-3 text-center ${
        item.cardSize === 'sm' ? 'min-h-[76px] gap-1' : ''
      } ${item.cardSize === 'lg' ? 'flex-row gap-3 text-left' : ''} ${
        editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
      onClick={() => {
        if (!editMode) props.onOpenItem(item);
      }}
      title={item.desc || item.title}
    >
      <div className={`icon-tile ${item.cardSize === 'sm' ? '!p-1.5' : ''}`}>
        <Icon icon={item.icon} size={item.cardSize === 'sm' ? Math.round((settings.iconSize || 34) * 0.75) : settings.iconSize || 34} title={item.title} />
      </div>

      <span
        className={`flex w-full items-center justify-center gap-1.5 text-[13px] font-medium ${
          item.cardSize === 'lg' ? 'justify-start' : ''
        }`}
        title={dot ? dot.title : undefined}
      >
        {dot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot.cls}`} /> : null}
        <span className="truncate">{item.title}</span>
      </span>
      {settings.showDesc && item.desc ? (
        <span
          className={`w-full truncate text-[11px] text-muted ${
            item.cardSize === 'lg' ? 'text-left' : 'text-center'
          }`}
        >
          {item.desc}
        </span>
      ) : null}

      {serviceStatus?.[item.id]?.fields?.length ? (
        <span
          className={`mt-0.5 flex w-full flex-wrap items-center justify-center gap-1 ${
            item.cardSize === 'lg' ? 'justify-start' : ''
          }`}
        >
          {serviceStatus[item.id].ok ? null : (
            <span
              className="dot-err dot-pulse h-1.5 w-1.5 shrink-0 rounded-full"
              title={serviceStatus[item.id].message ?? ''}
            />
          )}
          {serviceStatus[item.id].fields.map((f) => (
            <span
              key={f.label}
              title={`${f.label} ${f.value}`}
              className={`inline-flex max-w-full items-center gap-1 rounded-full bg-brand/10 leading-none text-brand ${
                item.cardSize === 'lg' ? 'px-2 py-1 text-[11px]' : item.cardSize === 'sm' ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'
              }`}
            >
              {f.icon ? <Icon icon={f.icon} size={10} title={f.label} /> : null}
              <span className="truncate">{f.value}</span>
              {f.bar || (typeof f.raw === 'number' && f.value.includes('%')) ? (
                <span className="h-1 w-6 shrink-0 overflow-hidden rounded-full bg-line/50">
                  <span
                    className="block h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${Math.min(100, Math.max(0, f.raw ?? 0))}%`,
                      background: 'currentColor',
                    }}
                  />
                </span>
              ) : null}
            </span>
          ))}
        </span>
      ) : null}

      {!url ? <span className="text-[11px] text-red-500">{t('home.noUrl')}</span> : null}

      {editMode ? (
        <div className="absolute right-1 top-1 flex gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            className="rounded-md bg-surface/90 p-1 text-muted hover:text-brand"
            title={t('common.edit')}
            onClick={() => props.onEditItem(item, item.groupId)}
          >
            <Icon icon="mdi:pencil-outline" size={15} title={t('common.edit')} />
          </button>
          <button
            className="rounded-md bg-surface/90 p-1 text-muted hover:text-red-500"
            title={t('common.delete')}
            onClick={() => props.onDeleteItem(item)}
          >
            <Icon icon="mdi:trash-can-outline" size={15} title={t('common.delete')} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

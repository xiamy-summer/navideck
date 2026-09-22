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
        <Icon icon={group.icon} size={20} title={group.name} />
        <h2 className="text-[15px] font-medium">{group.name}</h2>
        <span className="chip">{group.items.length}</span>

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
    </section>
  );
}

function SortableItem({ item, ...props }: Props & { item: Item; activeId: string | null }) {
  const { settings, editMode, netMode, serviceStatus } = props;
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `i-${item.id}`,
    disabled: !editMode,
  });

  const url = netMode === 'wan' ? item.urlWan || item.urlLan : item.urlLan || item.urlWan;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...(editMode ? attributes : {})}
      {...(editMode ? listeners : {})}
      className={`link-card card relative flex min-h-[92px] flex-col items-center justify-center gap-1.5 p-3 text-center ${
        editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
      onClick={() => {
        if (!editMode) props.onOpenItem(item);
      }}
      title={item.desc || item.title}
    >
      <Icon icon={item.icon} size={settings.iconSize || 34} title={item.title} />

      <span className="w-full truncate text-[13px] font-medium">{item.title}</span>
      {settings.showDesc && item.desc ? (
        <span className="w-full truncate text-[11px] text-muted">{item.desc}</span>
      ) : null}

      {serviceStatus?.[item.id] ? (
        <span className="flex w-full flex-wrap items-center justify-center gap-x-2 text-[10px]">
          {serviceStatus[item.id].ok ? null : (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
              title={serviceStatus[item.id].message ?? ''}
            />
          )}
          {serviceStatus[item.id].fields.map((f) => (
            <span key={f.label} className="text-muted">
              {f.label} {f.value}
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

'use client';

import { useState } from 'react';
import { Icon } from './Icon';
import { IconPicker } from './IconPicker';
import type { Group, Item, OpenMode } from '@/lib/types';

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
}

interface ItemDialogProps {
  draft: ItemDraft;
  groups: Group[];
  onClose: () => void;
  onSave: (draft: ItemDraft) => void;
  onDelete?: () => void;
}

export function ItemDialog({ draft, groups, onClose, onSave, onDelete }: ItemDialogProps) {
  const [form, setForm] = useState<ItemDraft>(draft);

  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[15px] font-medium">{form.id ? '编辑站点' : '添加站点'}</h3>

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[13px] text-muted">名称</div>
            <input className="field" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
          </div>

          <IconPicker value={form.icon} onChange={(v) => set('icon', v)} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[13px] text-muted">内网地址</div>
              <input
                className="field"
                placeholder="http://192.168.1.10:8080"
                value={form.urlLan}
                onChange={(e) => set('urlLan', e.target.value)}
              />
            </div>
            <div>
              <div className="mb-1.5 text-[13px] text-muted">外网地址</div>
              <input
                className="field"
                placeholder="https://nas.example.com"
                value={form.urlWan}
                onChange={(e) => set('urlWan', e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[13px] text-muted">描述（可选）</div>
            <input className="field" value={form.desc} onChange={(e) => set('desc', e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[13px] text-muted">所属分组</div>
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
              <div className="mb-1.5 text-[13px] text-muted">打开方式</div>
              <select
                className="field"
                value={form.openMode}
                onChange={(e) => set('openMode', e.target.value as OpenMode)}
              >
                <option value="blank">新标签页</option>
                <option value="modal">内置小窗口</option>
                <option value="self">当前标签页</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          {onDelete ? (
            <button className="btn btn-danger mr-auto" onClick={onDelete}>
              删除
            </button>
          ) : null}
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!form.title.trim()) return;
              onSave({ ...form, title: form.title.trim() });
            }}
          >
            保存
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
  const [form, setForm] = useState(draft);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-[15px] font-medium">{form.id ? '编辑分组' : '添加分组'}</h3>
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[13px] text-muted">分组名称</div>
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
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!form.name.trim()) return;
              onSave({ ...form, name: form.name.trim() });
            }}
          >
            保存
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
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <Icon icon="mdi:help-circle-outline" size={24} title="确认" />
          <p className="text-[14px] leading-relaxed">{message}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            确定
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
  };
}

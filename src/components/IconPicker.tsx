'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, ICONIFY_API, iconUrl } from './Icon';

const PRESETS = [
  'mdi:home-outline',
  'mdi:server',
  'mdi:server-network',
  'mdi:database',
  'mdi:cloud-outline',
  'mdi:router-wireless',
  'mdi:harddisk',
  'mdi:memory',
  'mdi:monitor-dashboard',
  'mdi:movie-open-outline',
  'mdi:music-note',
  'mdi:bookshelf',
  'mdi:chart-box-outline',
  'mdi:cog-outline',
  'mdi:folder-outline',
  'mdi:file-document-outline',
  'mdi:download-network-outline',
  'mdi:view-grid-outline',
  'mdi:shield-check-outline',
  'mdi:wifi',
  'mdi:television',
  'mdi:github',
  'mdi:docker',
  'simple-icons:docker',
  'simple-icons:synology',
  'simple-icons:jellyfin',
  'simple-icons:plex',
  'simple-icons:homeassistant',
  'simple-icons:nextcloud',
  'simple-icons:portainer',
  'simple-icons:gitea',
  'simple-icons:qbittorrent',
  'simple-icons:truenas',
  'simple-icons:openmediavault',
  'simple-icons:baidu',
  'logos:docker-icon',
  'logos:react',
  'logos:vue',
  'logos:nodejs-icon',
  'carbon:cloud-services',
  'carbon:virtual-machine',
];

interface Props {
  value: string | null;
  onChange: (icon: string) => void;
  label?: string;
}

export function IconPicker({ value, onChange, label = '图标' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${ICONIFY_API}/search?query=${encodeURIComponent(q)}&limit=48&prefixes=mdi,simple-icons,logos,carbon,ph,tabler`,
        );
        const data = (await res.json()) as { icons?: string[] };
        setResults(data.icons ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 320);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open]);

  const list = useMemo(() => (results.length ? results : PRESETS), [results]);

  return (
    <div>
      <div className="mb-1.5 block text-[13px] text-muted">{label}</div>
      <button type="button" className="btn w-full justify-start" onClick={() => setOpen(true)}>
        <Icon icon={value} size={22} title={value || '图'} />
        <span className="truncate">{value || '点击选择图标'}</span>
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-medium">选择图标</h3>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>

            <input
              className="field mb-2"
              placeholder="搜索图标，如 home / docker / nas"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="mb-3 flex gap-2">
              <input
                className="field"
                placeholder="或直接填写 iconify 名称，如 mdi:server"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <button
                className="btn"
                onClick={() => {
                  if (custom.trim()) {
                    onChange(custom.trim());
                    setOpen(false);
                  }
                }}
              >
                使用
              </button>
            </div>

            {loading ? <p className="py-6 text-center text-[13px] text-muted">搜索中…</p> : null}

            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {list.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  className="flex aspect-square items-center justify-center rounded-xl border border-line/70 text-ink transition hover:border-brand hover:bg-brand/10"
                  style={value === name ? { borderColor: 'rgb(var(--brand))', background: 'rgb(var(--brand) / .12)' } : undefined}
                >
                  <Icon icon={name} size={26} title={name} />
                </button>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-muted">
              图标来自 Iconify，共 20 万+ 图标；离线环境可用首字占位。
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { iconUrl };

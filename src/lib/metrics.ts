import os from 'node:os';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  getGlobalSettings,
  insertMetricAlert,
  insertMetricSample,
  pruneMetricAlerts,
  pruneMetricSamples,
} from '@/lib/db';

export interface MetricPoint {
  t: number;
  cpu: number;
  mem: number;
  disk: number;
  netRx: number;
  netTx: number;
}

const HISTORY_MAX = 120;
const GB = 1073741824;
const SAMPLE_PATH = process.env.DATA_DIR || process.cwd();

type AlertState = { firing: boolean; lastT: number };

type Store = {
  history: MetricPoint[];
  lastCpu: os.CpuInfo[];
  lastNet: { rx: number; tx: number };
  lastT: number;
  timer: NodeJS.Timeout | null;
  /** 归档定时器与上次归档时间 */
  archiver: NodeJS.Timeout | null;
  lastArchive: number;
  /** 每种指标当前的告警状态，用于冷却去重 */
  alertState: Record<string, AlertState>;
};

const g = globalThis as unknown as { __navMetrics?: Store };

function store(): Store {
  if (!g.__navMetrics) {
    g.__navMetrics = {
      history: [],
      lastCpu: os.cpus(),
      lastNet: readNetBytes(),
      lastT: Date.now(),
      timer: null,
      archiver: null,
      lastArchive: 0,
      alertState: {},
    };
  }
  return g.__navMetrics;
}

function cpuPercent(): number {
  const s = store();
  const now = os.cpus();
  let idle = 0;
  let total = 0;
  for (let i = 0; i < now.length; i += 1) {
    const prev = s.lastCpu[i]?.times;
    const cur = now[i].times;
    if (!prev) continue;
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const curTotal = cur.user + cur.nice + cur.sys + cur.idle + cur.irq;
    total += curTotal - prevTotal;
    idle += cur.idle - prev.idle;
  }
  s.lastCpu = now;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, ((total - idle) / total) * 100));
}

function readNetBytes(): { rx: number; tx: number } {
  try {
    if (fs.existsSync('/proc/net/dev')) {
      const lines = fs.readFileSync('/proc/net/dev', 'utf8').split('\n').slice(2);
      let rx = 0;
      let tx = 0;
      for (const line of lines) {
        const cols = line.trim().split(/\s+/);
        if (!cols[0]) continue;
        const iface = cols[0].replace(/:$/, '');
        if (iface === 'lo') continue;
        rx += Number(cols[1]) || 0;
        tx += Number(cols[9]) || 0;
      }
      return { rx, tx };
    }
  } catch {
    /* 非 Linux，走下面的兜底 */
  }
  try {
    const out = spawnSync('netstat', ['-ib'], { timeout: 2000 }).stdout?.toString() ?? '';
    let rx = 0;
    let tx = 0;
    for (const line of out.split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 7 || cols[0] === 'lo0') continue;
      // 统计列固定为 Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll，
      // 但 Address 列可能为空导致整体左移，因此从末尾倒数最稳
      rx += Number(cols[cols.length - 5]) || 0;
      tx += Number(cols[cols.length - 2]) || 0;
    }
    return { rx, tx };
  } catch {
    return { rx: 0, tx: 0 };
  }
}

export function diskInfo(target = SAMPLE_PATH) {
  try {
    const stat = fs.statfsSync(target);
    const total = stat.blocks * stat.bsize;
    const free = stat.bfree * stat.bsize;
    const used = total - free;
    return {
      path: target,
      totalGb: +(total / GB).toFixed(1),
      usedGb: +(used / GB).toFixed(1),
      freeGb: +(free / GB).toFixed(1),
      usedPercent: total > 0 ? +((used / total) * 100).toFixed(1) : 0,
    };
  } catch {
    return { path: target, totalGb: 0, usedGb: 0, freeGb: 0, usedPercent: 0 };
  }
}

export function sample(): MetricPoint {
  const s = store();
  const now = Date.now();
  const dt = Math.max(0.5, (now - s.lastT) / 1000);
  const total = os.totalmem();
  const free = os.freemem();
  const disk = diskInfo();
  const net = readNetBytes();

  const point: MetricPoint = {
    t: now,
    cpu: +cpuPercent().toFixed(1),
    mem: +(((total - free) / total) * 100).toFixed(1),
    disk: disk.usedPercent,
    netRx: Math.max(0, +((net.rx - s.lastNet.rx) / dt).toFixed(0)),
    netTx: Math.max(0, +((net.tx - s.lastNet.tx) / dt).toFixed(0)),
  };

  s.lastNet = net;
  s.lastT = now;
  s.history.push(point);
  if (s.history.length > HISTORY_MAX) s.history.shift();
  return point;
}

/** 每 5 秒采样一次，保证首屏也有 10 分钟历史可看 */
export function ensureSampler() {
  const s = store();
  if (s.timer) return;
  sample();
  s.timer = setInterval(() => {
    try {
      sample();
    } catch {
      /* 忽略单次采样失败 */
    }
  }, 5000);
  if (s.timer.unref) s.timer.unref();
  ensureArchiver();
}

/* ---------------------- 历史归档与阈值告警 ---------------------- */

const DAY_MS = 86400_000;

/** 归档一次：取最近采样点落库，随后做阈值判定与过期清理 */
function archiveTick() {
  const cfg = getGlobalSettings();
  const interval = Math.max(30, cfg.metricArchiveInterval || 60) * 1000;
  const s = store();
  const now = Date.now();
  if (now - s.lastArchive < interval) return;
  s.lastArchive = now;

  // 复用最近一次采样，避免额外打断 5 秒采样节奏
  const history = getHistory();
  const point = history.length ? history[history.length - 1] : sample();
  insertMetricSample(point);
  evaluateAlerts(point, cfg, now);

  const cutoff = now - Math.max(1, cfg.metricRetentionDays || 7) * DAY_MS;
  pruneMetricSamples(cutoff);
  pruneMetricAlerts(cutoff);
}

/** 阈值判定：超阈值且（首次触发或已过冷却）才记一条；恢复正常后复位 */
function evaluateAlerts(p: MetricPoint, cfg: ReturnType<typeof getGlobalSettings>, now: number) {
  if (!cfg.metricAlertEnabled) return;
  const s = store();
  const cooldown = Math.max(1, cfg.metricAlertCooldown || 30) * 60_000;
  const checks: Array<{ kind: string; value: number; threshold: number }> = [
    { kind: 'cpu', value: p.cpu, threshold: cfg.metricAlertCpu },
    { kind: 'mem', value: p.mem, threshold: cfg.metricAlertMem },
    { kind: 'disk', value: p.disk, threshold: cfg.metricAlertDisk },
  ];
  for (const c of checks) {
    if (!Number.isFinite(c.threshold) || c.threshold <= 0) continue;
    const st = s.alertState[c.kind] ?? { firing: false, lastT: 0 };
    if (c.value >= c.threshold) {
      if (!st.firing || now - st.lastT >= cooldown) {
        insertMetricAlert(c.kind, c.value, c.threshold);
        st.lastT = now;
      }
      st.firing = true;
    } else {
      st.firing = false;
    }
    s.alertState[c.kind] = st;
  }
}

/** 归档调度器：30 秒 tick，按全局设置的间隔落库（复用备份调度器的单例写法） */
export function ensureArchiver() {
  const s = store();
  if (s.archiver) return;
  try {
    archiveTick();
  } catch {
    /* 首次归档失败不影响服务 */
  }
  s.archiver = setInterval(() => {
    try {
      archiveTick();
    } catch {
      /* 静默失败，下次重试 */
    }
  }, 30_000);
  if (typeof s.archiver.unref === 'function') s.archiver.unref();
}

export function getHistory(): MetricPoint[] {
  return store().history;
}

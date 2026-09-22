import { fail, handle, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

async function fetchWithTimeout(url: string, ms = 9000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'NaviDeck/1.0 (+rss-widget)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s: string): string {
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeEntities(m[1].trim()) : '';
}

function pickAttr(block: string, tag: string, attr: string): string {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

interface RssItem {
  title: string;
  link: string;
  date: number;
  source: string;
}

function parseFeed(xml: string, fallbackSource: string): RssItem[] {
  const out: RssItem[] = [];
  // 频道标题
  const channelTitle = pick(xml, 'title') || fallbackSource;
  // RSS 2.0 <item>
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const it of items) {
    const title = pick(it, 'title');
    const link = pick(it, 'link') || pick(it, 'guid');
    if (!title || !link) continue;
    const raw = pick(it, 'pubDate') || pick(it, 'dc:date');
    const date = raw ? Date.parse(raw) || 0 : 0;
    out.push({ title, link, date, source: channelTitle || hostOf(link) });
  }
  if (out.length) return out;
  // Atom <entry>
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const it of entries) {
    const title = pick(it, 'title');
    let link = pickAttr(it, 'link', 'href');
    if (!link) link = pick(it, 'link');
    if (!title || !link) continue;
    const raw = pick(it, 'updated') || pick(it, 'published');
    const date = raw ? Date.parse(raw) || 0 : 0;
    out.push({ title, link, date, source: channelTitle || hostOf(link) });
  }
  return out;
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { feeds?: string[]; max?: number };
    const feeds = Array.isArray(body.feeds) ? body.feeds.filter((f) => /^https?:\/\//.test(f)).slice(0, 12) : [];
    const max = Math.min(Math.max(Number(body.max) || 8, 1), 30);
    if (!feeds.length) return fail('未提供有效的 RSS 源');

    const results = await Promise.all(
      feeds.map(async (url) => {
        try {
          const res = await fetchWithTimeout(url);
          if (!res.ok) return [] as RssItem[];
          const xml = await res.text();
          return parseFeed(xml, hostOf(url));
        } catch {
          return [] as RssItem[];
        }
      }),
    );
    const merged = results
      .flat()
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .slice(0, max);
    return ok({ items: merged });
  });
}

/* NaviDeck Service Worker —— App Shell 缓存 + 离线回落
 *
 * 策略说明：
 * - Next 静态产物（/_next/static）、图标离线包（/icon-pack）：cache-first，版本化文件名天然不可变。
 * - 图标 CDN（含 iconify 域名）：cache-first，离线时仍能显示站点图标。
 * - 页面导航：network-first，离线回落到最近缓存过的首页，保证离线能打开面板。
 * - /api/** 业务数据：不缓存，始终走网络，避免离线展示过期数据（离线由前端自行提示）。
 */
const VERSION = 'navideck-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const ICON_CACHE = `${VERSION}-icons`;

const PRECACHE = [
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('navideck-') && !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // opaque（跨域无 CORS）响应无法安全写入缓存，跳过
    if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    if (hit) return hit;
    throw err;
  }
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req)) || (await cache.match('/'));
    if (hit) return hit;
    return new Response('离线，且没有可用缓存', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isIconApi = url.host.includes('iconify');
  if (!sameOrigin && !isIconApi) return;

  // 业务数据接口始终走网络
  if (sameOrigin && url.pathname.startsWith('/api/')) return;

  if (isIconApi) {
    event.respondWith(cacheFirst(req, ICON_CACHE));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon-pack/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req));
    return;
  }
  event.respondWith(cacheFirst(req, STATIC_CACHE));
});

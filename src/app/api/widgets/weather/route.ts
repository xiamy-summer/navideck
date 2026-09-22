import { fail, handle, ok } from '@/lib/api';
import { mapWeatherCode } from '@/lib/weather';

export const dynamic = 'force-dynamic';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TTL_MS = 10 * 60 * 1000;

type CacheEntry = { ts: number; data: unknown };
const cache = new Map<string, CacheEntry>();

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  return handle(async () => {
    const city = new URL(req.url).searchParams.get('city')?.trim();
    if (!city) return fail('缺少城市参数');

    const cached = cache.get(city);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return ok(cached.data as Record<string, unknown>);
    }

    // 1) 地理编码
    const geoRes = await fetchWithTimeout(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`);
    if (!geoRes.ok) return fail('城市解析失败');
    const geo = (await geoRes.json()) as { results?: Array<{ latitude: number; longitude: number; name: string; country?: string }> };
    const hit = geo.results?.[0];
    if (!hit) return fail('未找到该城市');

    // 2) 当前天气
    const fUrl = `${FORECAST_URL}?latitude=${hit.latitude}&longitude=${hit.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` +
      `&timezone=auto`;
    const fRes = await fetchWithTimeout(fUrl);
    if (!fRes.ok) return fail('天气数据获取失败');
    const f = (await fRes.json()) as {
      current?: { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; is_day: number };
    };
    const cur = f.current;
    if (!cur) return fail('天气数据为空');

    const { category, icon } = mapWeatherCode(cur.weather_code);
    const data = {
      location: hit.country ? `${hit.name}, ${hit.country}` : hit.name,
      tempC: Math.round(cur.temperature_2m),
      feelsC: Math.round(cur.apparent_temperature),
      humidity: cur.relative_humidity_2m,
      windKmh: Math.round(cur.wind_speed_10m),
      isDay: cur.is_day === 1,
      code: cur.weather_code,
      category,
      icon,
    };
    cache.set(city, { ts: Date.now(), data });
    return ok(data);
  });
}

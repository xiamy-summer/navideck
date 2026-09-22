/** WMO 天气代码 → 分类与图标（前端用于渲染，后端返回 code 后由本映射推导） */

export type WeatherCategory =
  | 'clear'
  | 'partlyCloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunder'
  | 'unknown';

export function mapWeatherCode(code: number): { category: WeatherCategory; icon: string } {
  // 参考 Open-Meteo / WMO 天气代码
  if (code === 0) return { category: 'clear', icon: 'mdi:weather-sunny' };
  if (code === 1) return { category: 'partlyCloudy', icon: 'mdi:weather-partly-cloudy' };
  if (code === 2) return { category: 'partlyCloudy', icon: 'mdi:weather-partly-cloudy' };
  if (code === 3) return { category: 'cloudy', icon: 'mdi:weather-cloudy' };
  if (code === 45 || code === 48) return { category: 'fog', icon: 'mdi:weather-fog' };
  if (code >= 51 && code <= 57) return { category: 'drizzle', icon: 'mdi:weather-rainy' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { category: 'rain', icon: 'mdi:weather-pouring' };
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { category: 'snow', icon: 'mdi:weather-snowy' };
  if (code === 71 || code === 73 || code === 75) return { category: 'snow', icon: 'mdi:weather-snowy' };
  if (code >= 95) return { category: 'thunder', icon: 'mdi:weather-lightning' };
  return { category: 'unknown', icon: 'mdi:weather-cloudy-alert' };
}

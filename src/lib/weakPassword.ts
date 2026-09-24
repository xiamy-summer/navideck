/**
 * 弱密码判定。
 *
 * 只在「能看到明文密码」的时刻调用：首次创建默认管理员、以及登录校验通过后。
 * 密码哈希（scrypt）无法反推明文，所以无法在任意时刻判断历史密码强弱，
 * 这里采用「登录时看到明文就地打标记」的方式，把结果落到 users.mustChangePassword。
 */

/** 常见弱密码清单（小写比对） */
const WEAK_LIST = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '111111',
  '000000',
  'password',
  'passw0rd',
  'admin',
  'admin123',
  'root',
  'qwerty',
  'abc123',
  'letmein',
  'iloveyou',
  'welcome',
  'test',
  'test123',
]);

/** 与改密码接口的最小长度保持一致 */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * @param password 明文密码
 * @param defaultPassword 部署时配置的默认管理员密码（DEFAULT_ADMIN_PASSWORD），命中即视为弱
 */
export function isWeakPassword(password: string, defaultPassword?: string): boolean {
  const pw = (password ?? '').trim().toLowerCase();
  if (pw.length < MIN_PASSWORD_LENGTH) return true;
  if (WEAK_LIST.has(pw)) return true;
  if (defaultPassword && pw === defaultPassword.trim().toLowerCase()) return true;
  return false;
}

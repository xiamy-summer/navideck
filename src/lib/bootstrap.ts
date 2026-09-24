import crypto from 'node:crypto';
import {
  countUsers,
  createGroup,
  createItem,
  createUser,
  getUserByName,
  listGroups,
  saveUserSettings,
  updateUser,
} from './db';
import { isWeakPassword } from './weakPassword';

const DEMO: Array<{ name: string; icon: string; items: Array<[string, string, string]> }> = [
  {
    name: '常用服务',
    icon: 'mdi:star-outline',
    items: [
      ['群晖 DSM', 'simple-icons:synology', 'http://192.168.1.10:5000'],
      ['路由器', 'mdi:router-wireless', 'http://192.168.1.1'],
      ['Portainer', 'simple-icons:docker', 'http://192.168.1.10:9000'],
    ],
  },
  {
    name: '影音娱乐',
    icon: 'mdi:movie-open-outline',
    items: [
      ['Jellyfin', 'simple-icons:jellyfin', 'http://192.168.1.10:8096'],
      ['qBittorrent', 'mdi:download-network-outline', 'http://192.168.1.10:8080'],
    ],
  },
  {
    name: '开发工具',
    icon: 'mdi:code-braces',
    items: [
      ['Gitea', 'simple-icons:gitea', 'http://192.168.1.10:3000'],
      ['阿里云', 'simple-icons:alibabadotcom', 'https://www.aliyun.com'],
    ],
  },
];

export function seedDemo(userId: number) {
  if (listGroups(userId).length > 0) return;
  for (const group of DEMO) {
    const g = createGroup(userId, group.name, group.icon);
    for (const [title, icon, url] of group.items) {
      createItem(userId, {
        groupId: g.id,
        title,
        icon,
        urlLan: url,
        urlWan: url,
        desc: '',
        openMode: 'blank',
      });
    }
  }
}

let booted = false;

/** 首次启动：创建管理员、访客账号与示例内容 */
export function ensureBootstrap() {
  if (booted) return;
  booted = true;
  if (countUsers() === 0) {
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const admin = createUser('admin', password, 'admin');
    // 默认密码（或弱密码）建档时直接标记，前端登录后提示立即修改
    if (isWeakPassword(password, 'admin123')) {
      updateUser(admin.id, { mustChangePassword: 1 });
    }
    seedDemo(admin.id);
    saveUserSettings(0, {});
    console.log(`[nas-nav] 已创建管理员账号：admin / ${password}（请登录后立即修改密码）`);
  }
  if (!getUserByName('guest')) {
    const guest = createUser('guest', crypto.randomBytes(24).toString('hex'), 'guest');
    seedDemo(guest.id);
    console.log('[nas-nav] 已创建访客账号：guest（可在设置中心切换编辑对象自定义其内容）');
  }
}

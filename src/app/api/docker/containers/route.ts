import { dockerAvailable, dockerSocketPath, dockerInfo, listContainers } from '@/lib/docker';
import { fail, handle, ok, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);

    const socket = dockerSocketPath();
    if (!dockerAvailable()) {
      return ok({
        available: false,
        socket,
        containers: [],
        message: `未检测到 Docker Socket（${socket}），请在部署时挂载 /var/run/docker.sock`,
      });
    }

    try {
      const [containers, info] = await Promise.all([
        listContainers(true),
        dockerInfo().catch(() => null),
      ]);
      return ok({ available: true, socket, containers, info });
    } catch (err) {
      return ok({
        available: false,
        socket,
        containers: [],
        message: err instanceof Error ? err.message : '读取容器列表失败',
      });
    }
  });
}

#!/usr/bin/env python3
"""把本地代码一次性同步到 GitHub（单次提交，只触发一次镜像构建）。

用法：
    python3 scripts/sync-github.py <github_token> [owner/repo]

为什么不用 git push：
- 逐个文件调用 Contents API 会产生 N 次 push 事件，Actions 会在代码残缺时就开始构建，
  导致 `Module not found` 这类假失败；这里改用 Git Data API 一次提交解决问题。
"""
import base64
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

TOKEN = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('GITHUB_TOKEN', '')
REPO = sys.argv[2] if len(sys.argv) > 2 else 'xiamy-summer/navideck'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRANCH = 'main'

SKIP_DIRS = {'node_modules', '.next', '.data', '.git', '.workbuddy', 'logs'}
SKIP_FILES = {'.DS_Store', '.navideck.pid', 'next-env.d.ts'}
API = f'https://api.github.com/repos/{REPO}'
HEADERS = {
    'Authorization': f'Bearer {TOKEN}',
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
}


def call(path, data=None, method=None):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(data).encode() if data else None,
        method=method or ('POST' if data else 'GET'),
        headers=HEADERS,
    )
    return json.load(urllib.request.urlopen(req, timeout=60))


def blob_sha(data: bytes) -> str:
    h = hashlib.sha1()
    h.update(b'blob %d\0' % len(data))
    h.update(data)
    return h.hexdigest()


def collect():
    out = {}
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name in SKIP_FILES or name.endswith('.zip'):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT).replace(os.sep, '/')
            with open(full, 'rb') as fh:
                raw = fh.read()
            try:
                raw.decode('utf-8')
            except UnicodeDecodeError:
                continue
            out[rel] = raw
    return out


def main():
    if not TOKEN:
        print('缺少 token')
        return 1

    local = collect()
    head = call(f'/git/refs/heads/{BRANCH}')['object']['sha']
    base_tree = call(f'/git/commits/{head}')['tree']['sha']
    remote = {e['path']: e['sha'] for e in call(f'/git/trees/{base_tree}?recursive=1')['tree'] if e['type'] == 'blob'}

    entries = []
    changed = []
    for path, raw in sorted(local.items()):
        sha = blob_sha(raw)
        if remote.get(path) == sha:
            continue
        # 已经存在于远端但本地有改动的，交给 Git Data API 覆盖；
        # .github 下的工作流文件 GitHub 不允许用此 token 改写，跳过
        if path.startswith('.github/') and path in remote:
            continue
        blob = call('/git/blobs', {'content': base64.b64encode(raw).decode(), 'encoding': 'base64'})
        entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
        changed.append(path)

    if not entries:
        print('远端已是最新，无需同步')
        return 0

    tree = call('/git/trees', {'base_tree': base_tree, 'tree': entries})
    commit = call('/git/commits', {
        'message': 'chore: 同步本地改动',
        'tree': tree['sha'],
        'parents': [head],
    })
    call(f'/git/refs/heads/{BRANCH}', {'sha': commit['sha']}, method='PATCH')

    print(f'已提交 {len(entries)} 个文件：')
    for p in changed:
        print('  -', p)
    print('commit:', commit['sha'][:8])
    print('下一次镜像构建已触发（单次）')
    return 0


if __name__ == '__main__':
    sys.exit(main())

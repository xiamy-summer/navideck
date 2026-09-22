/** 极简且安全的 Markdown 渲染：先转义 HTML，再支持有限的语法，杜绝 XSS。 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdown(src: string): string {
  if (!src) return '';
  const lines = escapeHtml(src).split(/\r?\n/);
  const html: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    // 标题
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      html.push(`<h${level} class="md-h">${inline(h[2])}</h${level}>`);
      continue;
    }
    // 无序列表
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (!inList) {
        html.push('<ul class="md-ul">');
        inList = true;
      }
      html.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p class="md-p">${inline(line)}</p>`);
  }
  closeList();
  return html.join('');
}

function inline(s: string): string {
  // 链接 [text](http(s)://...)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  // 加粗 **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text*
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // 行内代码 `code`
  s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  return s;
}

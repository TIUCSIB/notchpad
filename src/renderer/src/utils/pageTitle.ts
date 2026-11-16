/**
 * 页面标签标题规则:
 * 取正文里第一个一级标题(# 标题)作为标签文字;没有一级标题的页面
 * 按序号显示「未命名1」「未命名2」……
 *
 * 只认 h1:二级/三级标题通常是正文分节,拿来做标签会让页签频繁改名。
 */

/** 只匹配 h1 本体,避免为每个页面解析整篇 HTML(大文档里标签要跟着输入实时更新) */
const H1_PATTERN = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi

/**
 * 从页面 HTML 中取出第一个有文字的一级标题。
 * 标题里可能有 <strong>、<span> 之类的行内标记和 HTML 实体,统一解析后再压缩空白。
 * 空标题(只有回车或空标签)会被跳过,继续找下一个 h1。
 */
export function extractPageTitle(html: string | null | undefined): string {
  if (!html) return ''
  for (const match of html.matchAll(H1_PATTERN)) {
    const doc = new DOMParser().parseFromString(match[1], 'text/html')
    const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
    if (text) return text
  }
  return ''
}

/** 无名页的占位名(序号从 1 开始,与标签顺序一致) */
export function unnamedTitle(index: number): string {
  return `未命名${index + 1}`
}

/** 已落库页面在标签/搜索/撤销提示里显示的名字 */
export function pageDisplayTitle(page: { content?: string | null }, index: number): string {
  return extractPageTitle(page.content) || unnamedTitle(index)
}

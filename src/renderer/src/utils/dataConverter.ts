/**
 * HTML ↔ Markdown conversion + export/import helpers
 */

import { MAX_PAGES } from '../composables/usePages'

export function htmlToMarkdown(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(processNode).join('')

    switch (tag) {
      case 'h1':
        return '# ' + children.trim() + '\n\n'
      case 'h2':
        return '## ' + children.trim() + '\n\n'
      case 'h3':
        return '### ' + children.trim() + '\n\n'
      case 'h4':
        return '#### ' + children.trim() + '\n\n'
      case 'h5':
        return '##### ' + children.trim() + '\n\n'
      case 'h6':
        return '###### ' + children.trim() + '\n\n'
      case 'p':
        return children.trim() + '\n\n'
      case 'br':
        return '\n'
      case 'strong':
      case 'b':
        return '**' + children + '**'
      case 'em':
      case 'i':
        return '*' + children + '*'
      case 's':
      case 'del':
        return '~~' + children + '~~'
      case 'code': {
        const parent = el.parentElement
        if (parent && parent.tagName.toLowerCase() === 'pre') return children
        return '`' + children + '`'
      }
      case 'pre':
        return '\n```\n' + children + '\n```\n\n'
      case 'blockquote': {
        const lines = children.trim().split('\n')
        return lines.map((l) => '> ' + l).join('\n') + '\n\n'
      }
      case 'a': {
        const href = el.getAttribute('href') || ''
        return '[' + children + '](' + href + ')'
      }
      case 'img': {
        const src = el.getAttribute('src') || ''
        const alt = el.getAttribute('alt') || ''
        return '![' + alt + '](' + src + ')'
      }
      case 'ul':
        return children + '\n'
      case 'ol':
        return children + '\n'
      case 'li': {
        const parentTag = el.parentElement?.tagName.toLowerCase()
        if (parentTag === 'ol') {
          const idx = Array.from(el.parentElement!.children).indexOf(el) + 1
          return idx + '. ' + children.trim() + '\n'
        }
        return '- ' + children.trim() + '\n'
      }
      case 'hr':
        return '\n---\n\n'
      case 'div':
      case 'span':
      case 'mark':
      case 'u':
      case 'sup':
      case 'sub':
        return children
      default:
        return children
    }
  }

  let md = processNode(tmp)
  md = md.replace(/\n{3,}/g, '\n\n')
  return md.trim() + '\n'
}

function timestampFilename(ext: string): string {
  return 'notchpad-export-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + ext
}

function downloadBlob(data: string, mime: string, filename: string) {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 正文里引用附件文件的 URL */
const ATTACHMENT_URL_RE = /notchpad:\/\/attachments\/([A-Za-z0-9._-]+)/g
/** 正文里内联的 base64 图片 */
const INLINE_IMG_RE = /(<img[^>]+src=")(data:image\/[a-z0-9.+-]+;base64,[^"]+)(")/gi

/**
 * 把正文里的附件引用换回内联 base64。
 * 导出的备份要保持自包含 —— 否则换台机器打开就全是碎图。
 */
async function inlineAttachments(html: string): Promise<string> {
  const names = new Set<string>()
  for (const m of html.matchAll(ATTACHMENT_URL_RE)) names.add(m[1])
  if (!names.size) return html

  const map = new Map<string, string>()
  for (const name of names) {
    const dataUrl = await window.api.readAttachment(name)
    if (dataUrl) map.set(name, dataUrl)
  }
  return html.replace(ATTACHMENT_URL_RE, (whole, name: string) => map.get(name) ?? whole)
}

/**
 * 把正文里的内联 base64 图片提取成附件文件,返回替换后的 HTML。
 * 导入备份时用 —— 备份里的图片是内联的,导入后应该重新落盘。
 */
async function extractInlineImages(html: string): Promise<string> {
  const matches = [...html.matchAll(INLINE_IMG_RE)]
  if (!matches.length) return html

  let out = html
  for (const m of matches) {
    const dataUrl = m[2]
    const res = await window.api.saveAttachment(dataUrl)
    if (res?.ok && res.name) {
      out = out.split(dataUrl).join(`notchpad://attachments/${res.name}`)
    }
  }
  return out
}

export function exportAsJson() {
  return window.api.getPages().then(async (pages) => {
    const out: Record<string, unknown>[] = []
    for (const p of pages) {
      out.push({ ...p, content: await inlineAttachments(String(p.content ?? '')) })
    }
    downloadBlob(JSON.stringify(out, null, 2), 'application/json', timestampFilename('.json'))
  })
}

export function exportAsMarkdown() {
  return window.api.getPages().then(async (pages) => {
    let md = '# Notchpad\n\n> Exported on ' + new Date().toLocaleDateString() + '\n\n---\n\n'
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      if (!page.content) continue
      md += '## Page ' + (i + 1) + '\n\n'
      md += htmlToMarkdown(await inlineAttachments(String(page.content)))
      md += '\n---\n\n'
    }
    downloadBlob(md, 'text/markdown', timestampFilename('.md'))
  })
}

/**
 * 从 JSON 备份导入。
 * - 受 MAX_PAGES 上限约束,超出部分会被截断
 * - 标题走 updatePageTitle、正文走 updatePage(两条通道各司其职)
 * - addPage 直接返回最新列表,省掉每次循环额外的 getPages 往返
 * onDone 回传实际导入的页数。
 */
export async function importFromJson(onDone: (imported: number) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        onDone(0)
        return
      }

      const existing = await window.api.getPages()
      const room = Math.max(0, MAX_PAGES - existing.length)
      const list = parsed.slice(0, room)

      for (const p of list) {
        const all = await window.api.addPage()
        const last = all?.[all.length - 1]
        if (!last) continue
        if (p.title) await window.api.updatePageTitle(last.id, String(p.title))
        if (p.content) {
          // 备份里的图片是内联 base64,导入时重新提取成附件文件
          const content = await extractInlineImages(String(p.content))
          await window.api.updatePage(last.id, content)
        }
      }

      onDone(list.length)
    } catch (err) {
      console.error('[Notchpad] 导入失败:', err)
      onDone(0)
    }
  }
  input.click()
}

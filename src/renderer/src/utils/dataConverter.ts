/**
 * HTML ↔ Markdown conversion + export/import helpers
 */

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
      case 'h1': return '# ' + children.trim() + '\n\n'
      case 'h2': return '## ' + children.trim() + '\n\n'
      case 'h3': return '### ' + children.trim() + '\n\n'
      case 'h4': return '#### ' + children.trim() + '\n\n'
      case 'h5': return '##### ' + children.trim() + '\n\n'
      case 'h6': return '###### ' + children.trim() + '\n\n'
      case 'p': return children.trim() + '\n\n'
      case 'br': return '\n'
      case 'strong':
      case 'b': return '**' + children + '**'
      case 'em':
      case 'i': return '*' + children + '*'
      case 's':
      case 'del': return '~~' + children + '~~'
      case 'code': {
        const parent = el.parentElement
        if (parent && parent.tagName.toLowerCase() === 'pre') return children
        return '`' + children + '`'
      }
      case 'pre': return '\n```\n' + children + '\n```\n\n'
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
      case 'ul': return children + '\n'
      case 'ol': return children + '\n'
      case 'li': {
        const parentTag = el.parentElement?.tagName.toLowerCase()
        if (parentTag === 'ol') {
          const idx = Array.from(el.parentElement!.children).indexOf(el) + 1
          return idx + '. ' + children.trim() + '\n'
        }
        return '- ' + children.trim() + '\n'
      }
      case 'hr': return '\n---\n\n'
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

export function exportAsJson() {
  return window.api.getPages().then((pages) => {
    downloadBlob(JSON.stringify(pages, null, 2), 'application/json', timestampFilename('.json'))
  })
}

export function exportAsMarkdown() {
  return window.api.getPages().then((pages) => {
    let md = '# Notchpad\n\n> Exported on ' + new Date().toLocaleDateString() + '\n\n---\n\n'
    pages.forEach((page, i) => {
      if (page.content) {
        md += '## Page ' + (i + 1) + '\n\n'
        md += htmlToMarkdown(page.content)
        md += '\n---\n\n'
      }
    })
    downloadBlob(md, 'text/markdown', timestampFilename('.md'))
  })
}

export async function importFromJson(onDone: () => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const pages = JSON.parse(text)
      if (Array.isArray(pages)) {
        for (const p of pages) {
          await window.api.addPage()
          const allPages = await window.api.getPages()
          const last = allPages[allPages.length - 1]
          if (last) await window.api.updatePage(last.id, p.title || '', p.content || '')
        }
        onDone()
      }
    } catch { /* ignore */ }
  }
  input.click()
}

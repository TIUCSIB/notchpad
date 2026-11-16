import { useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import LinkExtension from '@tiptap/extension-link'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { FontFamily } from '@tiptap/extension-font-family'
import {
  Minus,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Quote,
  List,
  ListOrdered,
  ListChecks,
  Type,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-vue-next'
import { FontSize } from '../extensions/fontSize'
import { SlashMenu } from '../extensions/slashMenu'
import type { SlashItem } from '../extensions/slashMenu'
import type { ChainedCommands, Editor } from '@tiptap/core'
import type { FormatBtn } from '../../types'

const IMAGE_MAX_WIDTH = 1920
const IMAGE_QUALITY = 0.8

/**
 * 读 File 为 data URL。压缩前需要知道 MIME;
 * GIF 直接原样存(压缩会毁掉动画),带透明通道的 PNG 也原样存
 * (canvas.toDataURL('image/jpeg') 会把透明区填成黑底)。
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function hasAlphaChannel(img: HTMLImageElement): boolean {
  const canvas = document.createElement('canvas')
  const w = (canvas.width = Math.min(img.naturalWidth || 1, 64))
  const h = (canvas.height = Math.min(img.naturalHeight || 1, 64))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

/**
 * 粘贴图片处理:GIF / 透明 PNG / 小图原样存,
 * 其余(照片类)缩到最大宽度 1920 并转 JPEG 压体积。
 */
function processImage(file: File): Promise<string> {
  return readFileAsDataUrl(file).then((dataUrl) => {
    // GIF 原样:canvas 重绘会丢动画帧
    if (file.type === 'image/gif') return dataUrl
    // 小图不值得压,原样保留格式与清晰度
    if (file.size <= 256 * 1024) return dataUrl

    return new Promise<string>((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        if (file.type === 'image/png' && hasAlphaChannel(img)) {
          // 透明 PNG 转 JPEG 会黑底,原样保留
          resolve(dataUrl)
          return
        }
        let { width, height } = img
        if (width > IMAGE_MAX_WIDTH) {
          height = Math.round((height / width) * IMAGE_MAX_WIDTH)
          width = IMAGE_MAX_WIDTH
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY))
      }
      img.onerror = () => resolve(dataUrl) // 加载失败就原样存,至少不丢图
      img.src = dataUrl
    })
  })
}

export const fontOptions = [
  'Microsoft YaHei',
  'SimSun',
  'SimHei',
  'KaiTi',
  'FangSong',
  'Arial',
  'Georgia',
  'Courier New'
]
export const fontSizeOptions = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']
export const colorOptions = [
  '#e5e5e5',
  '#ffffff',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#4ade80',
  '#0284c7',
  '#7c3aed',
  '#db2777'
]
export const highlightColors = [
  '#fef08a',
  '#bbf7d0',
  '#bfdbfe',
  '#fecaca',
  '#e9d5ff',
  '#fed7aa',
  '#d1fae5',
  '#ffffff'
]

export function useEditorSetup(
  scheduleSave: () => void,
  getIsSwitching: () => boolean,
  linkPromptVisible: { value: boolean },
  linkUrlInput: { value: string }
) {
  // 斜杠菜单项:command 先删掉 "/查询词" 再应用块类型;列表类命令要先落段落
  // 列表只有 toggle 命令,已经在目标类型时不能再次 toggle(会取消列表),
  // 所以统一走 applySlashBlock 做幂等判断
  const applySlashBlock = (
    ed: Editor,
    range: { from: number; to: number },
    activeName: string,
    apply: (chain: ChainedCommands) => void
  ) => {
    const chain = ed.chain().focus().deleteRange(range)
    if (!ed.isActive(activeName)) apply(chain)
    chain.run()
  }

  const slashItems: SlashItem[] = [
    {
      title: '正文',
      description: '普通文本段落',
      keywords: ['text', 'paragraph', 'zhengwen', 'p'],
      icon: Type,
      command: ({ editor: ed, range }) => ed.chain().focus().deleteRange(range).setParagraph().run()
    },
    {
      title: '标题 1',
      description: '大标题',
      keywords: ['h1', 'heading', 'biaoti'],
      icon: Heading1,
      command: ({ editor: ed, range }) =>
        ed.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
    },
    {
      title: '标题 2',
      description: '中标题',
      keywords: ['h2', 'heading', 'biaoti'],
      icon: Heading2,
      command: ({ editor: ed, range }) =>
        ed.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
    {
      title: '标题 3',
      description: '小标题',
      keywords: ['h3', 'heading', 'biaoti'],
      icon: Heading3,
      command: ({ editor: ed, range }) =>
        ed.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
    {
      title: '无序列表',
      description: '圆点列表',
      keywords: ['ul', 'bullet', 'list', 'liebiao'],
      icon: List,
      command: ({ editor: ed, range }) =>
        applySlashBlock(ed, range, 'bulletList', (c) => c.setParagraph().toggleBulletList())
    },
    {
      title: '有序列表',
      description: '编号列表',
      keywords: ['ol', 'ordered', 'numbered', 'liebiao'],
      icon: ListOrdered,
      command: ({ editor: ed, range }) =>
        applySlashBlock(ed, range, 'orderedList', (c) => c.setParagraph().toggleOrderedList())
    },
    {
      title: '任务列表',
      description: '待办勾选框',
      keywords: ['todo', 'task', 'check', 'renwu'],
      icon: ListChecks,
      command: ({ editor: ed, range }) =>
        applySlashBlock(ed, range, 'taskList', (c) => c.setParagraph().toggleTaskList())
    },
    {
      title: '引用',
      description: '引用块',
      keywords: ['quote', 'blockquote', 'yinyong'],
      icon: Quote,
      command: ({ editor: ed, range }) =>
        applySlashBlock(ed, range, 'blockquote', (c) => c.setParagraph().setBlockquote())
    },
    {
      title: '分割线',
      description: '水平分隔',
      keywords: ['hr', 'divider', 'line', 'fengexian'],
      icon: Minus,
      command: ({ editor: ed, range }) =>
        ed.chain().focus().deleteRange(range).setHorizontalRule().run()
    }
  ]

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: '写点什么吧... (输入 / 快速插入)' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      FontSize,
      SlashMenu.configure({ items: slashItems })
    ],
    content: '',
    editorProps: {
      attributes: { class: 'editor-content' },
      handleDOMEvents: {
        // 拖拽图片文件进编辑器直接插入(与粘贴同一条处理链)
        drop: (_view, event) => {
          const files = event.dataTransfer?.files
          if (!files?.length) return false
          const images = Array.from(files).filter((f) => f.type.startsWith('image/'))
          if (!images.length) return false
          event.preventDefault()
          for (const file of images) {
            processImage(file)
              .then(async (dataUrl) => {
                const res = await window.api.saveAttachment(dataUrl)
                const src = res?.ok ? (res.url ?? dataUrl) : dataUrl
                editor.value?.chain().focus().setImage({ src }).run()
              })
              .catch((err) => console.error('[Notchpad] Image drop failed:', err))
          }
          return true
        },
        contextmenu: (_view, event) => {
          const anchor = (event.target as HTMLElement).closest('a')
          if (anchor) {
            event.preventDefault()
            const href = anchor.getAttribute('href') || anchor.href
            if (href) window.api.openExternal(href)
            return true
          }
          return false
        },
        click: (_view, event) => {
          const anchor = (event.target as HTMLElement).closest('a')
          if (anchor) {
            event.preventDefault()
            const href = anchor.getAttribute('href') || anchor.href
            if (href) window.api.openExternal(href)
            return true
          }
          return false
        }
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) continue
            processImage(file)
              .then(async (dataUrl) => {
                // 图片写到磁盘,正文里只留一个引用。
                // 内联 base64 会让单条记录涨到几 MB,而 sql.js 每次落盘都是整库导出。
                // url 由后端按平台拼好,渲染层不能自己拼 scheme(Windows 下
                // Tauri 自定义协议实际是 http://notchpad.localhost,拼错图就碎)
                const res = await window.api.saveAttachment(dataUrl)
                const src = res?.ok ? (res.url ?? dataUrl) : dataUrl // 落盘失败就退回内联,至少不丢图
                editor.value?.chain().focus().setImage({ src }).run()
              })
              .catch((err) => console.error('[Notchpad] Image paste failed:', err))
            return true
          }
        }
        return false
      }
    },
    onUpdate: () => {
      if (!getIsSwitching()) scheduleSave()
    }
  })

  const fmtBold = () => editor.value?.chain().focus().toggleBold().run()
  const fmtItalic = () => editor.value?.chain().focus().toggleItalic().run()
  const fmtStrike = () => editor.value?.chain().focus().toggleStrike().run()
  const fmtCode = () => editor.value?.chain().focus().toggleCode().run()
  const fmtQuote = () => editor.value?.chain().focus().toggleBlockquote().run()
  const fmtBullet = () => editor.value?.chain().focus().toggleBulletList().run()
  const fmtOrdered = () => editor.value?.chain().focus().toggleOrderedList().run()
  const fmtTask = () => editor.value?.chain().focus().toggleTaskList().run()
  const fmtHr = () => editor.value?.chain().focus().setHorizontalRule().run()

  const fmtLink = () => {
    if (!editor.value) return
    linkUrlInput.value = editor.value.getAttributes('link').href || 'https://'
    linkPromptVisible.value = true
  }

  const formatBtns: FormatBtn[] = [
    {
      title: '加粗',
      icon: Bold,
      action: fmtBold,
      isActive: () => editor.value?.isActive('bold') ?? false
    },
    {
      title: '斜体',
      icon: Italic,
      action: fmtItalic,
      isActive: () => editor.value?.isActive('italic') ?? false
    },
    {
      title: '删除线',
      icon: Strikethrough,
      action: fmtStrike,
      isActive: () => editor.value?.isActive('strike') ?? false
    },
    {
      title: '代码',
      icon: Code,
      action: fmtCode,
      isActive: () => editor.value?.isActive('code') ?? false
    },
    {
      title: '链接',
      icon: Link,
      action: fmtLink,
      isActive: () => editor.value?.isActive('link') ?? false
    },
    {
      title: '引用',
      icon: Quote,
      action: fmtQuote,
      isActive: () => editor.value?.isActive('blockquote') ?? false
    },
    {
      title: '无序列表',
      icon: List,
      action: fmtBullet,
      isActive: () => editor.value?.isActive('bulletList') ?? false
    },
    {
      title: '有序列表',
      icon: ListOrdered,
      action: fmtOrdered,
      isActive: () => editor.value?.isActive('orderedList') ?? false
    },
    {
      title: '任务列表',
      icon: ListChecks,
      action: fmtTask,
      isActive: () => editor.value?.isActive('taskList') ?? false
    },
    { title: '分割线', icon: Minus, action: fmtHr }
  ]

  const setFontSize = (size: string) => {
    editor.value?.chain().focus().setFontSize(size).run()
    scheduleSave()
  }
  const clearFontSize = () => {
    editor.value?.chain().focus().unsetFontSize().run()
    scheduleSave()
  }
  const setFontFamily = (family: string) => {
    if (family === 'Microsoft YaHei') editor.value?.chain().focus().unsetFontFamily().run()
    else editor.value?.chain().focus().setFontFamily(family).run()
    scheduleSave()
  }
  const setTextColor = (color: string) => {
    editor.value?.chain().focus().setColor(color).run()
    scheduleSave()
  }
  const setHighlight = (color: string) => {
    editor.value?.chain().focus().toggleHighlight({ color }).run()
    scheduleSave()
  }
  const clearTextColor = () => {
    editor.value?.chain().focus().unsetColor().run()
    scheduleSave()
  }
  const clearHighlightColor = () => {
    editor.value?.chain().focus().unsetHighlight().run()
    scheduleSave()
  }

  const currentFontSize = () => editor.value?.getAttributes('fontSize').fontSize || '14px'
  const currentFontFamily = () =>
    editor.value?.getAttributes('textStyle').fontFamily || 'Microsoft YaHei'
  const currentTextColor = () => editor.value?.getAttributes('textStyle').color || '#e5e5e5'
  const currentHighlightColor = () => editor.value?.getAttributes('highlight').color || '#fef08a'

  const confirmLink = (url: string) => {
    if (!editor.value) return
    linkPromptVisible.value = false
    if (!url) {
      editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return {
    editor,
    formatBtns,
    setFontSize,
    clearFontSize,
    setFontFamily,
    setTextColor,
    setHighlight,
    clearTextColor,
    clearHighlightColor,
    currentFontSize,
    currentFontFamily,
    currentTextColor,
    currentHighlightColor,
    fmtLink,
    confirmLink
  }
}

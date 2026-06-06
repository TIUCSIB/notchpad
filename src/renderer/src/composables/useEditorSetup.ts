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
  ListChecks
} from 'lucide-vue-next'
import { FontSize } from '../extensions/fontSize'
import type { FormatBtn } from '../../types'

const IMAGE_MAX_WIDTH = 1920
const IMAGE_QUALITY = 0.8
const IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Read a File as a data URL string. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Compress and resize a pasted image using Canvas, returning a base64 data URL. */
function compressImage(file: File): Promise<string> {
  return readFileAsDataUrl(file).then((dataUrl) => {
    return new Promise<string>((resolve, reject) => {
      if (file.size > IMAGE_MAX_BYTES) {
        console.warn(`[Notchpad] Image exceeds ${IMAGE_MAX_BYTES / 1024 / 1024}MB, compressing...`)
      }
      const img = new window.Image()
      img.onload = () => {
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
      img.onerror = () => reject(new Error('Failed to load image'))
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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: '写点什么吧...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      FontSize
    ],
    content: '',
    editorProps: {
      attributes: { class: 'editor-content' },
      handleDOMEvents: {
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
            compressImage(file)
              .then((src) => {
                editor.value
                  ?.chain()
                  .focus()
                  .setImage({ src })
                  .run()
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
    { title: '加粗', icon: Bold, action: fmtBold, isActive: () => editor.value?.isActive('bold') ?? false },
    { title: '斜体', icon: Italic, action: fmtItalic, isActive: () => editor.value?.isActive('italic') ?? false },
    { title: '删除线', icon: Strikethrough, action: fmtStrike, isActive: () => editor.value?.isActive('strike') ?? false },
    { title: '代码', icon: Code, action: fmtCode, isActive: () => editor.value?.isActive('code') ?? false },
    { title: '链接', icon: Link, action: fmtLink, isActive: () => editor.value?.isActive('link') ?? false },
    { title: '引用', icon: Quote, action: fmtQuote, isActive: () => editor.value?.isActive('blockquote') ?? false },
    { title: '无序列表', icon: List, action: fmtBullet, isActive: () => editor.value?.isActive('bulletList') ?? false },
    { title: '有序列表', icon: ListOrdered, action: fmtOrdered, isActive: () => editor.value?.isActive('orderedList') ?? false },
    { title: '任务列表', icon: ListChecks, action: fmtTask, isActive: () => editor.value?.isActive('taskList') ?? false },
    { title: '分割线', icon: Minus, action: fmtHr }
  ]

  const setFontSize = (size: string) => { editor.value?.chain().focus().setFontSize(size).run(); scheduleSave() }
  const clearFontSize = () => { editor.value?.chain().focus().unsetFontSize().run(); scheduleSave() }
  const setFontFamily = (family: string) => {
    if (family === 'Microsoft YaHei') editor.value?.chain().focus().unsetFontFamily().run()
    else editor.value?.chain().focus().setFontFamily(family).run()
    scheduleSave()
  }
  const setTextColor = (color: string) => { editor.value?.chain().focus().setColor(color).run(); scheduleSave() }
  const setHighlight = (color: string) => { editor.value?.chain().focus().toggleHighlight({ color }).run(); scheduleSave() }
  const clearTextColor = () => { editor.value?.chain().focus().unsetColor().run(); scheduleSave() }
  const clearHighlightColor = () => { editor.value?.chain().focus().unsetHighlight().run(); scheduleSave() }

  const currentFontSize = () => editor.value?.getAttributes('fontSize').fontSize || '14px'
  const currentFontFamily = () => editor.value?.getAttributes('textStyle').fontFamily || 'Microsoft YaHei'
  const currentTextColor = () => editor.value?.getAttributes('textStyle').color || '#e5e5e5'
  const currentHighlightColor = () => editor.value?.getAttributes('highlight').color || '#fef08a'

  const confirmLink = (url: string) => {
    if (!editor.value) return
    linkPromptVisible.value = false
    if (!url) { editor.value.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return {
    editor, formatBtns, setFontSize, clearFontSize, setFontFamily,
    setTextColor, setHighlight, clearTextColor, clearHighlightColor,
    currentFontSize, currentFontFamily, currentTextColor, currentHighlightColor,
    fmtLink, confirmLink
  }
}

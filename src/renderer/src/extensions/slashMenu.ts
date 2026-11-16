import { shallowReactive } from 'vue'
import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { LucideIcon } from 'lucide-vue-next'

export interface SlashRange {
  from: number
  to: number
}

/** 斜杠菜单里的一项:标题/说明用于展示与过滤,command 负责删掉 "/xxx" 并应用块类型 */
export interface SlashItem {
  title: string
  description?: string
  keywords: string[]
  icon: LucideIcon
  command: (props: { editor: Editor; range: SlashRange }) => void
}

export interface SlashMenuOptions {
  items: SlashItem[]
}

/** 匹配光标前文本末尾的 "/xxx":斜杠必须位于文本开头或空白之后,避免命中 "a/b" 这类词中斜杠 */
const SLASH_QUERY_RE = /(?:^|\s)\/([^\s]*)$/

/** 纯函数:从光标前的文本里提取斜杠查询词;slashOffset 是斜杠在文本中的下标 */
export function getSlashQuery(textBefore: string): { query: string; slashOffset: number } | null {
  const m = textBefore.match(SLASH_QUERY_RE)
  if (!m) return null
  return { query: m[1], slashOffset: textBefore.length - m[1].length - 1 }
}

/** 纯函数:按标题/说明/关键词过滤菜单项(大小写不敏感) */
export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) =>
    [item.title, item.description ?? '', ...item.keywords].join(' ').toLowerCase().includes(q)
  )
}

/**
 * 插件状态 → 菜单 UI 的响应式镜像,由插件在事务时同步,组件只读。
 * shallow:items 里放的是图标组件对象,不能被深度代理。
 */
export const slashMenuStore = shallowReactive({
  open: false,
  query: '',
  selectedIndex: 0,
  placeAbove: false,
  maxHeight: 200,
  x: 0,
  y: 0,
  range: null as SlashRange | null
})

interface SlashPluginState {
  open: boolean
  /** Esc 关闭后,只要 "/查询" 还在原地就保持关闭;删掉斜杠重输才会再次触发 */
  dismissed: boolean
  from: number
  to: number
  query: string
}

const CLOSED_STATE: SlashPluginState = { open: false, dismissed: false, from: 0, to: 0, query: '' }

// 本应用只有一个编辑器实例,插件创建时把依赖记到模块级,供键盘处理与组件回调使用
let slashItems: SlashItem[] = []
let slashEditor: Editor | null = null

const slashMenuKey = new PluginKey('slashMenu')

/** 关闭斜杠菜单(带 dismissed 标记,不会因光标还在 "/查询" 旁而立刻重开) */
export function dismissSlashMenu() {
  if (!slashEditor || slashEditor.isDestroyed || !slashMenuStore.open) return
  slashEditor.view.dispatch(slashEditor.state.tr.setMeta(slashMenuKey, { dismiss: true }))
}

/** 直接收起菜单但保留 "/查询" 文本(编辑器失焦、刘海收起时用);重新聚焦后可以再触发 */
export function closeSlashMenu() {
  if (!slashEditor || slashEditor.isDestroyed || !slashMenuStore.open) return
  slashEditor.view.dispatch(slashEditor.state.tr.setMeta(slashMenuKey, { close: true }))
}

export function moveSlashSelection(delta: number) {
  const n = filterSlashItems(slashItems, slashMenuStore.query).length
  if (!n) return
  slashMenuStore.selectedIndex = (slashMenuStore.selectedIndex + delta + n) % n
}

export function runSelectedSlashItem() {
  runSlashItemAt(slashMenuStore.selectedIndex)
}

/** 显式执行第 index 项(鼠标点击时直接传被点中的行,不依赖 hover 状态) */
export function runSlashItemAt(index: number) {
  if (!slashEditor || slashEditor.isDestroyed) return
  const item = filterSlashItems(slashItems, slashMenuStore.query)[index]
  const range = slashMenuStore.range
  if (!item || !range) return
  // command 自己负责删掉 "/xxx" 并应用块类型;删除产生的事务会让菜单自然关闭
  item.command({ editor: slashEditor, range })
}

/** 菜单 UI 读过滤后的条目列表;空 = 无匹配,组件显示空态 */
export function getFilteredSlashItems(): SlashItem[] {
  return filterSlashItems(slashItems, slashMenuStore.query)
}

/** 按光标位置重算菜单坐标(滚动时跟随;打字产生的事务也会走到这里) */
export function updateSlashMenuPosition(view: {
  coordsAtPos: (pos: number) => { left: number; top: number; bottom: number }
}) {
  const range = slashMenuStore.range
  if (!slashMenuStore.open || !range) return
  const c = view.coordsAtPos(range.to)
  const GAP = 6
  const PAD = 8
  const availBelow = window.innerHeight - c.bottom - GAP - PAD
  const availAbove = c.top - GAP - PAD
  const placeAbove = availAbove > availBelow && availBelow < 140
  slashMenuStore.placeAbove = placeAbove
  slashMenuStore.maxHeight = Math.max(120, Math.min(240, placeAbove ? availAbove : availBelow))
  slashMenuStore.x = Math.max(PAD, Math.min(c.left - 2, window.innerWidth - 218 - PAD))
  // placeAbove 时组件把 y 换算成 bottom 锚定,菜单从下往上长,避免盖住光标行
  slashMenuStore.y = placeAbove ? c.top - GAP : c.bottom + GAP
}

/** 滚动容器滚动时由 UI 组件调用(rAF 节流),让菜单贴着光标走 */
export function refreshSlashMenuPosition() {
  if (!slashEditor || !slashMenuStore.open) return
  updateSlashMenuPosition(slashEditor.view)
}

export const SlashMenu = Extension.create<SlashMenuOptions>({
  name: 'slashMenu',

  addOptions() {
    return { items: [] }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    slashItems = this.options.items
    slashEditor = editor
    // 编辑器失焦(点工具栏、切窗口)时收起菜单;菜单项自身 mousedown.prevent,不会误关
    editor.on('blur', closeSlashMenu)

    return [
      new Plugin<SlashPluginState>({
        key: slashMenuKey,
        state: {
          init: () => CLOSED_STATE,
          apply(tr, value) {
            const meta = tr.getMeta(slashMenuKey) as
              | { dismiss?: boolean; close?: boolean }
              | undefined
            if (meta?.close) return CLOSED_STATE
            if (meta?.dismiss) {
              return { ...value, open: false, dismissed: true }
            }
            if (!tr.selection.empty) return CLOSED_STATE
            const { $from } = tr.selection
            // 代码块里打斜杠是正常内容,不弹菜单
            if (!$from.parent.isTextblock || $from.parent.type.name === 'codeBlock') {
              return CLOSED_STATE
            }
            const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, ' ')
            const m = getSlashQuery(textBefore)
            if (!m) return CLOSED_STATE
            const blockStart = $from.pos - $from.parentOffset
            const next = {
              from: blockStart + m.slashOffset,
              to: $from.pos,
              query: m.query
            }
            // 查询无匹配时直接关掉:像 "/打打" 这种就是想打普通文字,不该被空态菜单打扰;
            // 删回能匹配的内容时 apply 会重算并重新弹出
            if (!filterSlashItems(slashItems, next.query).length) return CLOSED_STATE
            if (value.dismissed) {
              // Esc 后保持关闭,但仅限同一处斜杠:换行/换段落再打 "/" 要能重新触发
              return value.from === next.from
                ? { ...next, open: false, dismissed: true }
                : { ...next, open: true, dismissed: false }
            }
            return { ...next, open: true, dismissed: false }
          }
        },
        props: {
          handleKeyDown(_view, event) {
            if (!slashMenuStore.open) return false
            // 输入法组合中的 Enter/方向键属于选字操作,不拦截
            if (event.isComposing || event.keyCode === 229) return false
            const hasMatches = filterSlashItems(slashItems, slashMenuStore.query).length > 0
            switch (event.key) {
              case 'ArrowDown':
                if (!hasMatches) return false
                event.preventDefault()
                moveSlashSelection(1)
                return true
              case 'ArrowUp':
                if (!hasMatches) return false
                event.preventDefault()
                moveSlashSelection(-1)
                return true
              case 'Enter':
                if (!hasMatches) return false
                event.preventDefault()
                runSelectedSlashItem()
                return true
              case 'Escape':
                event.preventDefault()
                dismissSlashMenu()
                return true
              default:
                return false
            }
          }
        },
        view() {
          // 运行时 registerPlugin 会让 ProseMirror 重建所有插件视图:
          // 销毁后 view() 工厂会被重新调用,但 addProseMirrorPlugins 不会,
          // 所以编辑器引用必须在这里恢复,否则 Enter/点击路径会因 slashEditor 为 null 静默失效
          slashEditor = editor
          return {
            update(view, prevState) {
              const prev = slashMenuKey.getState(prevState)
              const cur = slashMenuKey.getState(view.state)
              const wasOpen = prev?.open ?? false
              if (!cur?.open) {
                if (wasOpen) {
                  slashMenuStore.open = false
                  slashMenuStore.range = null
                }
                return
              }
              if (!wasOpen || prev?.query !== cur.query) slashMenuStore.selectedIndex = 0
              slashMenuStore.open = true
              slashMenuStore.query = cur.query
              slashMenuStore.range = { from: cur.from, to: cur.to }
              updateSlashMenuPosition(view)
            },
            destroy() {
              // 视图可能因插件重配置被销毁重建,只有编辑器本身销毁时才清引用
              if (editor.isDestroyed) slashEditor = null
              slashMenuStore.open = false
              slashMenuStore.range = null
            }
          }
        }
      })
    ]
  }
})

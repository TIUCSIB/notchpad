import { describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { SlashMenu, slashMenuStore, runSlashItemAt } from '../extensions/slashMenu'
import type { SlashItem } from '../extensions/slashMenu'

function makeEditor(command = vi.fn()) {
  const items: SlashItem[] = [
    {
      title: '正文',
      keywords: ['text'],
      icon: {} as never,
      command
    }
  ]
  const el = document.createElement('div')
  document.body.appendChild(el)
  const editor = new Editor({
    element: el,
    extensions: [StarterKit, SlashMenu.configure({ items })],
    content: '<p></p>'
  })
  // jsdom 没有布局引擎,coordsAtPos 会抛错;用假矩形顶替
  editor.view.coordsAtPos = () => ({ left: 10, right: 10, top: 10, bottom: 20 })
  return { editor, command }
}

describe('slashMenu 集成', () => {
  it('输入 / 后 Enter 执行命令', () => {
    const { editor, command } = makeEditor()
    editor.commands.focus('end')
    editor.commands.insertContent('/')
    expect(slashMenuStore.open).toBe(true)

    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(command).toHaveBeenCalledTimes(1)
    editor.destroy()
  })

  it('插件视图因 registerPlugin 重建后,Enter 仍然生效(回归:视图重建丢失编辑器引用)', () => {
    const { editor, command } = makeEditor()
    editor.commands.focus('end')
    editor.commands.insertContent('/')
    expect(slashMenuStore.open).toBe(true)

    // 模拟运行时 registerPlugin:会触发 ProseMirror 重建所有插件视图
    editor.registerPlugin(
      new Plugin({
        key: new PluginKey('externalPlugin'),
        view: () => ({})
      })
    )

    // 重建后菜单还能打开,且命令可执行
    editor.commands.insertContent('t')
    expect(slashMenuStore.open).toBe(true)
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(command).toHaveBeenCalledTimes(1)
    editor.destroy()
  })

  it('查询无匹配时菜单不显示,文本保持原样', () => {
    const { editor, command } = makeEditor()
    editor.commands.focus('end')
    editor.commands.insertContent('/打打')
    expect(slashMenuStore.open).toBe(false)
    // Enter 走编辑器默认行为(换行),不会执行菜单命令
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(command).not.toHaveBeenCalled()
    expect(editor.getText().startsWith('/打打')).toBe(true)
    editor.destroy()
  })

  it('无匹配后删回可匹配内容,菜单重新弹出', () => {
    const { editor } = makeEditor()
    editor.commands.focus('end')
    editor.commands.insertContent('/zzz')
    expect(slashMenuStore.open).toBe(false)
    // 删掉 zzz 回到 "/"(文档 <p>/zzz</p>:文本起点 1,"/zzz" 占 1..4)
    editor.commands.deleteRange({ from: 2, to: 5 })
    expect(slashMenuStore.open).toBe(true)
    editor.destroy()
  })

  it('直接点击项执行命令(不依赖 hover 状态)', () => {
    const { editor, command } = makeEditor()
    editor.commands.focus('end')
    editor.commands.insertContent('/')
    runSlashItemAt(0)
    expect(command).toHaveBeenCalledTimes(1)
    editor.destroy()
  })
})

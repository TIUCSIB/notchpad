import { Mark, mergeAttributes, type CommandProps } from '@tiptap/core'

export const FontSize = Mark.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.fontSize?.replace(/["']/g, ''),
        renderHTML: (attrs) => {
          if (!attrs.fontSize) return {}
          return { style: 'font-size: ' + attrs.fontSize }
        }
      }
    }
  },
  parseHTML() {
    return [{ tag: 'span', style: 'font-size' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
          ({ chain }: CommandProps) =>
            chain().setMark(this.name, { fontSize }).run(),
      unsetFontSize:
        () =>
          ({ chain }: CommandProps) =>
            chain().setMark(this.name, { fontSize: null }).removeEmptyTextStyle().run()
    }
  }
})

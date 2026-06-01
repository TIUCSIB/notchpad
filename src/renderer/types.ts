import type { LucideIcon } from 'lucide-vue-next'

export interface Page {
  id: number
  title: string
  content: string
  sort_order: number
  pinned: number
  created_at: string
  updated_at: string
}

export interface FormatBtn {
  title: string
  icon: LucideIcon
  action: () => void
  isActive?: () => boolean
}

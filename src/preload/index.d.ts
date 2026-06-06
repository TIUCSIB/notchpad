import { ElectronAPI } from '@electron-toolkit/preload'
import { Page } from './index'

interface API {
  getPages: () => Promise<Page[]>
  addPage: () => Promise<Page>
  deletePage: (id: number) => Promise<void>
  updatePage: (id: number, title: string, content: string) => Promise<Page>
  updatePageTitle: (id: number, title: string) => Promise<Page>
  reorderPages: (ids: number[]) => Promise<void>
  enterNotch: () => Promise<void>
  exitNotch: () => Promise<void>
  onNotchChange: (cb: (notched: boolean) => void) => void
  offNotchChange: () => void
  getSettings: () => Promise<Record<string, string>>
  setSetting: (key: string, value: string) => Promise<void>
  resetSettings: () => Promise<void>
  getDbPath: () => Promise<string>
  chooseDbDir: () => Promise<string | null>
  relocateDb: (targetDir: string) => Promise<{ ok: boolean; path?: string; error?: string }>
  switchDisplay: () => Promise<void>\n  closeWindow: () => void
  openExternal: (url: string) => void
  togglePinPage: (id: number) => Promise<Page[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}

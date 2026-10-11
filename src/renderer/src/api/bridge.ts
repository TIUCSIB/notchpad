import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Page } from '../../types'

/**
 * Tauri 版 window.api 兼容桥。
 *
 * 保持与 Electron preload 相同的调用签名,渲染层其余代码(App.vue / composables)零改动;
 * 每个方法对应 src-tauri 里一个 #[tauri::command]。在 main.ts 最早处 import 本模块即可。
 */

let notchUnlisten: (() => void) | null = null

const api = {
  getPages: (): Promise<Page[]> => invoke('get_pages'),
  addPage: (): Promise<Page[] | null> => invoke('add_page'),
  deletePage: (id: number): Promise<boolean> => invoke('delete_page', { id }),
  updatePage: (id: number, content: string): Promise<Page> =>
    invoke('update_page', { id, content }),
  updatePageTitle: (id: number, title: string): Promise<Page> =>
    invoke('update_page_title', { id, title }),
  reorderPages: (ids: number[]): Promise<void> => invoke('reorder_pages', { ids }),
  togglePinPage: (id: number): Promise<Page[]> => invoke('toggle_pin_page', { id }),
  enterNotch: (): Promise<void> => invoke('enter_notch'),
  exitNotch: (): Promise<void> => invoke('exit_notch'),
  updatePillSize: (width: number, height: number): void => {
    void invoke('update_pill_size', { width, height })
  },
  rendererReady: (): void => {
    void invoke('renderer_ready')
  },
  onNotchChange: (cb: (notched: boolean) => void): void => {
    void listen<boolean>('notch-changed', (e) => cb(e.payload)).then((un) => {
      notchUnlisten = un
    })
  },
  offNotchChange: (): void => {
    notchUnlisten?.()
    notchUnlisten = null
  },
  getSettings: (): Promise<Record<string, string>> => invoke('get_settings'),
  setSetting: (key: string, value: string): Promise<void> => invoke('set_setting', { key, value }),
  resetSettings: (): Promise<void> => invoke('reset_settings'),
  getDbPath: (): Promise<string> => invoke('get_db_path'),
  chooseDbDir: (): Promise<string | null> => invoke('choose_db_dir'),
  relocateDb: (targetDir: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
    invoke('relocate_db', { targetDir }),
  saveAttachment: (dataUrl: string): Promise<{ ok: boolean; name?: string; error?: string }> =>
    invoke('save_attachment', { dataUrl }),
  readAttachment: (name: string): Promise<string | null> => invoke('read_attachment', { name }),
  switchDisplay: (): Promise<void> => invoke('switch_display'),
  closeWindow: (): void => {
    void invoke('close_window')
  },
  openExternal: (url: string): void => {
    void invoke('open_external', { url })
  }
}

export type Api = typeof api
;(window as unknown as { api: Api }).api = api

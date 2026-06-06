import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getPages: (): Promise<Page[]> => ipcRenderer.invoke('get-pages'),
  addPage: (): Promise<Page[] | null> => ipcRenderer.invoke('add-page'),
  deletePage: (id: number): Promise<void> => ipcRenderer.invoke('delete-page', id),
  updatePage: (id: number, title: string, content: string): Promise<Page> =>
    ipcRenderer.invoke('update-page', id, title, content),
  updatePageTitle: (id: number, title: string): Promise<Page> =>
    ipcRenderer.invoke('update-page-title', id, title),
  reorderPages: (ids: number[]): Promise<void> => ipcRenderer.invoke('reorder-pages', ids),
  togglePinPage: (id: number): Promise<Page[]> => ipcRenderer.invoke('toggle-pin-page', id),
  enterNotch: (): Promise<void> => ipcRenderer.invoke('enter-notch'),
  exitNotch: (): Promise<void> => ipcRenderer.invoke('exit-notch'),
  onNotchChange: (cb: (notched: boolean) => void): void => {
    ipcRenderer.on('notch-changed', (_event: Electron.IpcRendererEvent, v: boolean) => cb(v))
  },
  offNotchChange: (): void => {
    ipcRenderer.removeAllListeners('notch-changed')
  },
  getSettings: (): Promise<Record<string, string>> => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke('set-setting', key, value),
  resetSettings: (): Promise<void> => ipcRenderer.invoke('reset-settings'),
  getDbPath: (): Promise<string> => ipcRenderer.invoke('get-db-path'),
  chooseDbDir: (): Promise<string | null> => ipcRenderer.invoke('choose-db-dir'),
  relocateDb: (targetDir: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke('relocate-db', targetDir),
  switchDisplay: (): Promise<void> => ipcRenderer.invoke('switch-display'),
  closeWindow: (): void => {
    ipcRenderer.send('close-window')
  },
  openExternal: (url: string): void => {
    ipcRenderer.send('open-external', url)
  }
}

export interface Page {
  id: number
  title: string
  content: string
  sort_order: number
  pinned: number
  created_at: string
  updated_at: string
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore -- window.electron set by preload
  window.electron = electronAPI
  // @ts-ignore -- window.api set by preload
  window.api = api
}

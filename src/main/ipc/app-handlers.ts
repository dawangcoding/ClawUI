import { ipcMain, app } from 'electron'
import { IPC } from '../../shared/ipc-channels'

export function registerAppHandlers(): void {
   ipcMain.handle(IPC.APP_GET_INFO, () => {
      return {
         platform: process.platform,
         appVersion: app.getVersion(),
         versions: {
            node: process.versions.node,
            chrome: process.versions.chrome,
            electron: process.versions.electron,
         },
      }
   })
}

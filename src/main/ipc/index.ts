import { ipcMain, app } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { registerGatewayHandlers } from './gateway-handlers'
import { registerAppHandlers } from './app-handlers'
import { registerSpeechHandlers } from './speech-handlers'

export function registerAllIpcHandlers(): void {
   registerGatewayHandlers()
   registerAppHandlers()
   registerSpeechHandlers()
}

export { registerGatewayHandlers, registerAppHandlers, registerSpeechHandlers }

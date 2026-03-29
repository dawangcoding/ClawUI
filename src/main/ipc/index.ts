import { ipcMain, app } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { registerGatewayHandlers } from './gateway-handlers'
import { registerAppHandlers } from './app-handlers'
import { registerSpeechHandlers } from './speech-handlers'
import { registerBuiltinGatewayHandlers } from './builtin-gateway-handlers'
import { registerClawHubHandlers } from './clawhub-handlers'

export function registerAllIpcHandlers(): void {
   registerGatewayHandlers()
   registerBuiltinGatewayHandlers()
   registerAppHandlers()
   registerSpeechHandlers()
   registerClawHubHandlers()
}

export { registerGatewayHandlers, registerAppHandlers, registerSpeechHandlers, registerBuiltinGatewayHandlers, registerClawHubHandlers }

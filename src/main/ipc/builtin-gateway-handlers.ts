import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { GatewayProcessManager } from '../gateway/process-manager'
import { saveGatewayMode, getGatewayMode } from '../gateway/config'
import { createLogger } from '../../shared/logger'

const log = createLogger('IPC-BuiltinGateway')

let _processManager: GatewayProcessManager | null = null
let _sendToRenderer: (channel: string, data: unknown) => void = () => {}
let _connectBuiltin: (port: number, token: string) => void = () => {}
let _disconnectCurrent: () => void = () => {}

export function setBuiltinGatewayAccessor(
   processManager: GatewayProcessManager,
   sendToRenderer: (channel: string, data: unknown) => void,
   connectBuiltin: (port: number, token: string) => void,
   disconnectCurrent: () => void,
): void {
   log.log('setBuiltinGatewayAccessor called')
   _processManager = processManager
   _sendToRenderer = sendToRenderer
   _connectBuiltin = connectBuiltin
   _disconnectCurrent = disconnectCurrent

   processManager.onStatusChanged((status) => {
      log.log('Status changed → %s, forwarding to renderer', status)
      _sendToRenderer(IPC.GATEWAY_BUILTIN_STATUS_CHANGED, status)
   })
}

export function registerBuiltinGatewayHandlers(): void {
   log.log('Registering builtin gateway IPC handlers...')

   ipcMain.handle(IPC.GATEWAY_CHECK_BUNDLED, () => {
      const available = _processManager?.isAvailable() ?? false
      log.log('checkBundled: %s', available)
      return available
   })

   ipcMain.handle(IPC.GATEWAY_GET_MODE, () => {
      const mode = getGatewayMode()
      log.log('getMode: %s', mode)
      return mode
   })

   ipcMain.handle(IPC.GATEWAY_SET_MODE, async (_event, mode: string) => {
      log.log('setMode: %s', mode)
      try {
         if (mode !== 'builtin' && mode !== 'external') {
            return { success: false, error: `Invalid mode: ${mode}` }
         }
         // 切换到外部模式时，停止内置进程
         if (mode === 'external' && _processManager) {
            const status = _processManager.getStatus()
            if (status === 'running' || status === 'starting') {
               _disconnectCurrent()
               await _processManager.stop()
            }
         }
         saveGatewayMode(mode)
         return { success: true }
      } catch (err) {
         log.error('setMode error:', err)
         return { success: false, error: String(err) }
      }
   })

   ipcMain.handle(IPC.GATEWAY_BUILTIN_STATUS, () => {
      const pm = _processManager
      return {
         status: pm?.getStatus() ?? 'idle',
         port: pm?.port ?? 0,
         token: pm?.token ?? '',
      }
   })

   ipcMain.handle(IPC.GATEWAY_BUILTIN_START, async () => {
      log.log('startBuiltin requested')
      try {
         if (!_processManager) {
            return { success: false, error: 'Process manager not initialized' }
         }
         const { port, token } = await _processManager.start()
         _connectBuiltin(port, token)
         return { success: true, port, token }
      } catch (err) {
         log.error('startBuiltin error:', err)
         return { success: false, error: String(err) }
      }
   })

   ipcMain.handle(IPC.GATEWAY_BUILTIN_STOP, async () => {
      log.log('stopBuiltin requested')
      try {
         if (!_processManager) {
            return { success: false, error: 'Process manager not initialized' }
         }
         _disconnectCurrent()
         await _processManager.stop()
         return { success: true }
      } catch (err) {
         log.error('stopBuiltin error:', err)
         return { success: false, error: String(err) }
      }
   })

   ipcMain.handle(IPC.GATEWAY_BUILTIN_RESTART, async () => {
      log.log('restartBuiltin requested')
      try {
         if (!_processManager) {
            return { success: false, error: 'Process manager not initialized' }
         }
         _disconnectCurrent()
         const { port, token } = await _processManager.restart()
         _connectBuiltin(port, token)
         return { success: true, port, token }
      } catch (err) {
         log.error('restartBuiltin error:', err)
         return { success: false, error: String(err) }
      }
   })

   log.log('Builtin gateway IPC handlers registered')
}

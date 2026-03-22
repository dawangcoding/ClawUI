import { contextBridge, ipcRenderer } from 'electron'
import { createLogger } from '../shared/logger'

const log = createLogger('Preload')

const IPC = {
   GATEWAY_RPC: 'gateway:rpc',
   GATEWAY_CONNECT: 'gateway:connect',
   GATEWAY_DISCONNECT: 'gateway:disconnect',
   GATEWAY_GET_STATUS: 'gateway:get-status',
   GATEWAY_LOAD_CONFIG: 'gateway:load-config',
   GATEWAY_SAVE_CONFIG: 'gateway:save-config',
   GATEWAY_EVENT: 'gateway:event',
   GATEWAY_STATE_CHANGED: 'gateway:state-changed',
   APP_GET_INFO: 'app:get-info',
   SPEECH_TRANSCRIBE: 'speech:transcribe',
} as const

const EVENT_CHANNELS = [IPC.GATEWAY_EVENT, IPC.GATEWAY_STATE_CHANGED] as const

log.log('Initializing preload script...')

contextBridge.exposeInMainWorld('clawAPI', {
   app: {
      getInfo: () => {
         log.log('app.getInfo() called')
         return ipcRenderer.invoke(IPC.APP_GET_INFO) as Promise<{
            platform: string
            appVersion: string
            versions: { node: string; chrome: string; electron: string }
         }>
      },
   },

   gateway: {
      // 配置管理
      loadConfig: () => {
         log.log('gateway.loadConfig() called')
         return ipcRenderer.invoke(IPC.GATEWAY_LOAD_CONFIG) as Promise<{
            gatewayUrl: string
            token: string
         } | null>
      },
      saveConfig: (config: { gatewayUrl: string; token: string }) => {
         log.log('gateway.saveConfig() called, url=%s', config.gatewayUrl)
         return ipcRenderer.invoke(IPC.GATEWAY_SAVE_CONFIG, config) as Promise<{
            success: boolean
            error?: string
         }>
      },

      // 连接管理
      connect: () => {
         log.log('gateway.connect() called')
         return ipcRenderer.invoke(IPC.GATEWAY_CONNECT) as Promise<{
            success: boolean
            error?: string
         }>
      },
      disconnect: () => {
         log.log('gateway.disconnect() called')
         return ipcRenderer.invoke(IPC.GATEWAY_DISCONNECT) as Promise<{ success: boolean }>
      },
      getStatus: () => {
         log.log('gateway.getStatus() called')
         return ipcRenderer.invoke(IPC.GATEWAY_GET_STATUS) as Promise<{
            state: string
            connected: boolean
            snapshot?: unknown
         }>
      },

      // 通用 RPC — 核心 API
      rpc: (method: string, params?: unknown) => {
         log.log('gateway.rpc() called: method=%s', method)
         return ipcRenderer.invoke(IPC.GATEWAY_RPC, { method, params }) as Promise<{
            ok: boolean
            payload?: unknown
            error?: { code?: string; message?: string; details?: unknown }
         }>
      },

      // 事件监听
      onEvent: (callback: (event: unknown) => void) => {
         log.log('gateway.onEvent() listener registered')
         ipcRenderer.on(IPC.GATEWAY_EVENT, (_event, data) => {
            log.debug('gateway event received:', (data as { event?: string })?.event)
            callback(data)
         })
      },
      onStateChanged: (callback: (state: string) => void) => {
         log.log('gateway.onStateChanged() listener registered')
         ipcRenderer.on(IPC.GATEWAY_STATE_CHANGED, (_event, state) => {
            log.log('gateway state changed:', state)
            callback(state)
         })
      },

      // 清理监听器
      removeAllListeners: () => {
         log.log('gateway.removeAllListeners() called')
         for (const channel of EVENT_CHANNELS) {
            ipcRenderer.removeAllListeners(channel)
         }
      },
   },

   speech: {
      transcribe: (audioData: ArrayBuffer, mimeType: string) => {
         log.log(
            'speech.transcribe() called, size=%dB, mimeType=%s',
            audioData?.byteLength ?? 0,
            mimeType,
         )
         return ipcRenderer.invoke(IPC.SPEECH_TRANSCRIBE, {
            audioData,
            mimeType,
         }) as Promise<{
            ok: boolean
            text?: string
            error?: string
         }>
      },
   },
})

log.log('Preload script initialized, clawAPI exposed')

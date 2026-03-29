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
   GATEWAY_GET_MODE: 'gateway:get-mode',
   GATEWAY_SET_MODE: 'gateway:set-mode',
   GATEWAY_BUILTIN_STATUS: 'gateway:builtin-status',
   GATEWAY_BUILTIN_START: 'gateway:builtin-start',
   GATEWAY_BUILTIN_STOP: 'gateway:builtin-stop',
   GATEWAY_BUILTIN_RESTART: 'gateway:builtin-restart',
   GATEWAY_CHECK_BUNDLED: 'gateway:check-bundled',
   GATEWAY_BUILTIN_STATUS_CHANGED: 'gateway:builtin-status-changed',
   GATEWAY_MARK_ONBOARDING_COMPLETE: 'gateway:mark-onboarding-complete',
   APP_GET_INFO: 'app:get-info',
   SPEECH_TRANSCRIBE: 'speech:transcribe',
   CLAWHUB_LIST_SKILLS: 'clawhub:list-skills',
   CLAWHUB_SEARCH_PACKAGES: 'clawhub:search-packages',
} as const

const EVENT_CHANNELS = [
   IPC.GATEWAY_EVENT,
   IPC.GATEWAY_STATE_CHANGED,
   IPC.GATEWAY_BUILTIN_STATUS_CHANGED,
] as const

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
            mode?: string
            onboardingCompleted?: boolean
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

      // 内置 Gateway 管理
      checkBundled: () => {
         log.log('gateway.checkBundled() called')
         return ipcRenderer.invoke(IPC.GATEWAY_CHECK_BUNDLED) as Promise<boolean>
      },
      getMode: () => {
         log.log('gateway.getMode() called')
         return ipcRenderer.invoke(IPC.GATEWAY_GET_MODE) as Promise<'builtin' | 'external'>
      },
      setMode: (mode: 'builtin' | 'external') => {
         log.log('gateway.setMode() called, mode=%s', mode)
         return ipcRenderer.invoke(IPC.GATEWAY_SET_MODE, mode) as Promise<void>
      },
      getBuiltinStatus: () => {
         log.log('gateway.getBuiltinStatus() called')
         return ipcRenderer.invoke(IPC.GATEWAY_BUILTIN_STATUS) as Promise<
            'idle' | 'starting' | 'running' | 'stopping' | 'crashed'
         >
      },
      startBuiltin: () => {
         log.log('gateway.startBuiltin() called')
         return ipcRenderer.invoke(IPC.GATEWAY_BUILTIN_START) as Promise<{
            success: boolean
            error?: string
         }>
      },
      stopBuiltin: () => {
         log.log('gateway.stopBuiltin() called')
         return ipcRenderer.invoke(IPC.GATEWAY_BUILTIN_STOP) as Promise<void>
      },
      restartBuiltin: () => {
         log.log('gateway.restartBuiltin() called')
         return ipcRenderer.invoke(IPC.GATEWAY_BUILTIN_RESTART) as Promise<{
            success: boolean
            error?: string
         }>
      },
      onBuiltinStatusChanged: (
         callback: (status: 'idle' | 'starting' | 'running' | 'stopping' | 'crashed') => void,
      ): (() => void) => {
         log.log('gateway.onBuiltinStatusChanged() listener registered')
         const listener = (
            _event: Electron.IpcRendererEvent,
            status: 'idle' | 'starting' | 'running' | 'stopping' | 'crashed',
         ) => {
            log.log('builtin gateway status changed:', status)
            callback(status)
         }
         ipcRenderer.on(IPC.GATEWAY_BUILTIN_STATUS_CHANGED, listener)
         return () => {
            ipcRenderer.removeListener(IPC.GATEWAY_BUILTIN_STATUS_CHANGED, listener)
         }
      },

      // Onboarding
      markOnboardingCompleted: () => {
         log.log('gateway.markOnboardingCompleted() called')
         return ipcRenderer.invoke(
            IPC.GATEWAY_MARK_ONBOARDING_COMPLETE,
         ) as Promise<{ success: boolean; error?: string }>
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

   clawhub: {
      listSkills: (params: { limit?: number; cursor?: string }) => {
         log.log('clawhub.listSkills() called, limit=%d', params.limit ?? 20)
         return ipcRenderer.invoke(IPC.CLAWHUB_LIST_SKILLS, params) as Promise<{
            ok: boolean
            data?: unknown
            error?: string
         }>
      },
      searchPackages: (params: { query: string; limit?: number }) => {
         log.log('clawhub.searchPackages() called, q=%s', params.query)
         return ipcRenderer.invoke(IPC.CLAWHUB_SEARCH_PACKAGES, params) as Promise<{
            ok: boolean
            data?: unknown
            error?: string
         }>
      },
   },
})

log.log('Preload script initialized, clawAPI exposed')

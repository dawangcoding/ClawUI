import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { loadConfig, saveConfig } from '../gateway/config'
import { GatewayClient } from '../gateway/client'
import { GatewayRequestError } from '../gateway/errors'
import { formatConnectError } from '../gateway/connect-error'
import { ConnectionState } from '../../shared/types/gateway-protocol'
import type { SaveConfigParams } from '../../shared/types/gateway-protocol'
import { createLogger, summarizeValue } from '../../shared/logger'

const log = createLogger('IPC-Gateway')

// 模块级引用，由主进程入口设置
let _getClient: () => GatewayClient | null = () => null
let _setClient: (client: GatewayClient | null) => void = () => {}
let _sendToRenderer: (channel: string, data: unknown) => void = () => {}

export function setClientAccessor(
   getter: () => GatewayClient | null,
   setter: (client: GatewayClient | null) => void,
   sender: (channel: string, data: unknown) => void,
): void {
   log.log('setClientAccessor called')
   _getClient = getter
   _setClient = setter
   _sendToRenderer = sender
}

export function registerGatewayHandlers(): void {
   log.log('Registering gateway IPC handlers...')

   // 通用 RPC 通道 — 核心 API
   ipcMain.handle(
      IPC.GATEWAY_RPC,
      async (_event, { method, params }: { method: string; params?: unknown }) => {
         log.log('RPC request: method=%s, params=%s', method, summarizeValue(params))
         // 附件调试：检查 chat.send 的 attachments 是否通过 IPC 到达主进程
         if (method === 'chat.send' && params && typeof params === 'object') {
            const p = params as Record<string, unknown>
            const atts = p.attachments as Array<Record<string, unknown>> | undefined
            if (atts && atts.length > 0) {
               const first = atts[0]
               log.log(
                  'chat.send attachments: count=%d, first.type=%s, first.mimeType=%s, first.content.length=%d',
                  atts.length,
                  first?.type,
                  first?.mimeType,
                  typeof first?.content === 'string' ? first.content.length : -1,
               )
            } else {
               log.warn('chat.send: NO attachments in params!')
            }
         }
         const client = _getClient()
         if (!client?.isConnected()) {
            log.warn('RPC rejected: not connected, method=%s', method)
            return { ok: false, error: { code: 'NOT_CONNECTED', message: '未连接到 Gateway' } }
         }
         try {
            const payload = await client.sendRequest(method, params ?? {})
            log.log('RPC success: method=%s, result=%s', method, summarizeValue(payload))
            return { ok: true, payload }
         } catch (err) {
            if (err instanceof GatewayRequestError) {
               log.warn(
                  'RPC error: method=%s, code=%s, message=%s',
                  method,
                  err.gatewayCode,
                  err.message,
               )
               return {
                  ok: false,
                  error: {
                     code: err.gatewayCode,
                     message: err.message,
                     details: err.details,
                  },
               }
            }
            log.error('RPC unexpected error: method=%s', method, err)
            return {
               ok: false,
               error: { message: err instanceof Error ? err.message : String(err) },
            }
         }
      },
   )

   // 加载配置
   ipcMain.handle(IPC.GATEWAY_LOAD_CONFIG, () => {
      log.log('loadConfig requested')
      const config = loadConfig()
      if (!config) {
         log.log('loadConfig: no config found')
         return null
      }
      log.log('loadConfig: url=%s', config.gatewayUrl)
      return { gatewayUrl: config.gatewayUrl, token: config.token }
   })

   // 保存配置
   ipcMain.handle(IPC.GATEWAY_SAVE_CONFIG, (_event, params: SaveConfigParams) => {
      log.log('saveConfig requested: url=%s', params.gatewayUrl)
      try {
         saveConfig(params)
         log.log('saveConfig: success')
         return { success: true }
      } catch (err) {
         log.error('saveConfig error:', err)
         return { success: false, error: String(err) }
      }
   })

   // 连接
   ipcMain.handle(IPC.GATEWAY_CONNECT, () => {
      log.log('connect requested')
      try {
         const config = loadConfig()
         if (!config?.gatewayUrl || !config?.token) {
            log.warn('connect: missing config')
            return { success: false, error: '请先配置 Gateway URL 和 Token' }
         }

         const existing = _getClient()
         if (existing) {
            log.log('connect: stopping existing client')
            existing.stop()
         }

         log.log('connect: creating new GatewayClient, url=%s', config.gatewayUrl)
         const client = new GatewayClient({
            url: config.gatewayUrl,
            token: config.token,
            onHello: (hello) => {
               log.log('onHello → renderer: %s', summarizeValue(hello))
               _sendToRenderer(IPC.GATEWAY_EVENT, {
                  event: 'hello-ok',
                  payload: hello,
               })
            },
            onEvent: (evt) => {
               log.log(
                  'onEvent → renderer: event=%s, payload=%s',
                  evt.event,
                  summarizeValue(evt.payload),
               )
               _sendToRenderer(IPC.GATEWAY_EVENT, {
                  event: evt.event,
                  payload: evt.payload,
                  seq: evt.seq,
                  stateVersion: evt.stateVersion,
               })
            },
            onClose: ({ code, reason, error }) => {
               log.log(
                  'onClose: code=%d, reason=%s, hasError=%s',
                  code,
                  reason,
                  !!error,
               )
               _sendToRenderer(IPC.GATEWAY_EVENT, {
                  event: 'connection-error',
                  payload: {
                     code,
                     reason,
                     error,
                     formattedMessage: formatConnectError(error),
                  },
               })
            },
            onGap: (gap) => {
               log.warn(
                  'onGap: expected=%d, received=%d',
                  gap.expected,
                  gap.received,
               )
               _sendToRenderer(IPC.GATEWAY_EVENT, {
                  event: 'event-gap',
                  payload: gap,
               })
            },
            onStateChanged: (state) => {
               log.log('onStateChanged: %s', state)
               _sendToRenderer(IPC.GATEWAY_STATE_CHANGED, state)
            },
         })
         _setClient(client)
         client.start()
         log.log('connect: client started')
         return { success: true }
      } catch (err) {
         log.error('connect error:', err)
         return { success: false, error: String(err) }
      }
   })

   // 断开连接
   ipcMain.handle(IPC.GATEWAY_DISCONNECT, () => {
      log.log('disconnect requested')
      const client = _getClient()
      if (client) {
         log.log('disconnect: stopping client')
         client.stop()
         _setClient(null)
      } else {
         log.log('disconnect: no active client')
      }
      return { success: true }
   })

   // 获取状态
   ipcMain.handle(IPC.GATEWAY_GET_STATUS, () => {
      const client = _getClient()
      const state = client?.getState() ?? ConnectionState.Disconnected
      const connected = state === ConnectionState.Connected
      log.log('getStatus: state=%s, connected=%s', state, connected)
      return {
         state,
         connected,
         snapshot: client?.getSnapshot() ?? null,
      }
   })

   log.log('Gateway IPC handlers registered')
}

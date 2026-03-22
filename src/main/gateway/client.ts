import WebSocket from 'ws'
import { randomUUID } from 'crypto'
import {
   ConnectionState,
   type EventFrame,
   type ResponseFrame,
   type GatewayFrame,
   type ConnectParams,
   type HelloOkPayload,
   type Snapshot,
   type DeviceIdentity,
   type GatewayErrorInfo,
} from '../../shared/types/gateway-protocol'
import {
   loadOrCreateKeyPair,
   deriveDeviceId,
   getPublicKeyBase64Url,
   signConnectPayload,
} from './config'
import {
   GatewayRequestError,
   ConnectErrorDetailCodes,
   isNonRecoverableAuthError,
   resolveGatewayErrorDetailCode,
   readConnectErrorRecoveryAdvice,
} from './errors'
import {
   loadDeviceAuthToken,
   storeDeviceAuthToken,
   clearDeviceAuthToken,
} from './device-token'
import { app } from 'electron'
import { createLogger, summarizeValue } from '../../shared/logger'

const log = createLogger('GatewayClient')

// ── 常量 ──

const PROTOCOL_VERSION = 3
const REQUEST_TIMEOUT_MS = 30_000
const BACKOFF_INITIAL_MS = 800
const BACKOFF_MULTIPLIER = 1.7
const BACKOFF_MAX_MS = 15_000
const CONNECT_FAILED_CLOSE_CODE = 4008

// ── 类型 ──

export interface GatewayClientOptions {
   url: string
   token: string
   onHello?: (hello: HelloOkPayload) => void
   onEvent?: (evt: EventFrame) => void
   onClose?: (info: { code: number; reason: string; error?: GatewayErrorInfo }) => void
   onGap?: (info: { expected: number; received: number }) => void
   onStateChanged?: (state: ConnectionState) => void
}

interface PendingRequest {
   resolve: (payload: unknown) => void
   reject: (error: Error) => void
   timer: ReturnType<typeof setTimeout>
}

interface SelectedConnectAuth {
   authToken?: string
   authDeviceToken?: string
   storedToken?: string
   canFallbackToShared: boolean
}

// ── GatewayClient ──

export class GatewayClient {
   private ws: WebSocket | null = null
   private state: ConnectionState = ConnectionState.Disconnected
   private pendingRequests = new Map<string, PendingRequest>()
   private tickTimer: ReturnType<typeof setInterval> | null = null
   private reconnectTimer: ReturnType<typeof setTimeout> | null = null
   private backoffMs = BACKOFF_INITIAL_MS
   private closed = true
   private lastTick: number | null = null
   private tickIntervalMs = 30_000
   private snapshot: Snapshot | null = null
   private helloOk: HelloOkPayload | null = null
   private lastSeq: number | null = null
   private connectNonce: string | null = null
   private connectSent = false
   private pendingConnectError: GatewayErrorInfo | undefined
   private pendingDeviceTokenRetry = false
   private deviceTokenRetryBudgetUsed = false
   private deviceId: string | null = null

   constructor(private opts: GatewayClientOptions) {}

   // ── Public API ──

   getState(): ConnectionState {
      return this.state
   }

   isConnected(): boolean {
      return this.state === ConnectionState.Connected
   }

   getSnapshot(): Snapshot | null {
      return this.snapshot
   }

   getHelloOk(): HelloOkPayload | null {
      return this.helloOk
   }

   start(): void {
      log.log('start() called, url:', this.opts.url)
      this.closed = false
      this.backoffMs = BACKOFF_INITIAL_MS
      this.pendingDeviceTokenRetry = false
      this.deviceTokenRetryBudgetUsed = false
      this._connect()
   }

   stop(): void {
      log.log('stop() called')
      this.closed = true
      this._cleanup()
      this.snapshot = null
      this.helloOk = null
      this.pendingConnectError = undefined
      this.pendingDeviceTokenRetry = false
      this.deviceTokenRetryBudgetUsed = false
      this._setState(ConnectionState.Disconnected)
   }

   async sendRequest(method: string, params: unknown = {}): Promise<unknown> {
      const allowedStates =
         method === 'connect'
            ? [ConnectionState.Connected, ConnectionState.Handshaking]
            : [ConnectionState.Connected]

      if (!this.ws || !allowedStates.includes(this.state)) {
         log.warn(
            'sendRequest rejected: method=%s, state=%s, hasWs=%s',
            method,
            this.state,
            !!this.ws,
         )
         throw new Error('Not connected to Gateway')
      }

      const id = randomUUID()
      const frame = { type: 'req' as const, id, method, params }
      log.log('sendRequest: method=%s, id=%s', method, id)

      return new Promise((resolve, reject) => {
         const timer = setTimeout(() => {
            this.pendingRequests.delete(id)
            log.warn('Request timeout: method=%s, id=%s', method, id)
            reject(
               new GatewayRequestError({
                  code: 'REQUEST_TIMEOUT',
                  message: `请求 ${method} 超时 (${REQUEST_TIMEOUT_MS}ms)`,
               }),
            )
         }, REQUEST_TIMEOUT_MS)

         this.pendingRequests.set(id, { resolve, reject, timer })
         this._send(frame)
      })
   }

   // ── Private: Connection ──

   private _connect(): void {
      if (this.closed) {
         log.log('_connect() skipped: client is closed')
         return
      }
      this._cleanup()
      this._setState(ConnectionState.Connecting)
      log.log('_connect() initiating WebSocket to:', this.opts.url)

      try {
         // 设置 Origin 头以通过 Gateway 的 allowedOrigins 校验
         // Node.js ws 库不像浏览器会自动设置 Origin
         const origin = this._deriveOrigin(this.opts.url)
         log.log('Derived origin:', origin)
         this.ws = new WebSocket(this.opts.url, { origin })
      } catch (err) {
         log.error('Failed to create WebSocket:', err)
         this._scheduleReconnect()
         return
      }

      this.ws.on('open', () => {
         log.log('WebSocket connected, waiting for challenge...')
         this._setState(ConnectionState.Handshaking)
         this.connectNonce = null
         this.connectSent = false
      })

      this.ws.on('message', (data: WebSocket.Data) => {
         try {
            const raw = data.toString()
            const frame = JSON.parse(raw) as GatewayFrame
            log.log('⇦ RECV frame: %s', summarizeValue(frame))
            this._handleFrame(frame)
         } catch (err) {
            log.error('Failed to parse frame:', err)
         }
      })

      this.ws.on('close', (code, reason) => {
         const reasonStr = reason.toString()
         log.log(`WebSocket closed: code=${code}, reason=${reasonStr}`)

         const connectError = this.pendingConnectError
         this.pendingConnectError = undefined
         this._cleanup()

         // 通知上层连接关闭
         this.opts.onClose?.({ code, reason: reasonStr, error: connectError })

         // 重连决策
         if (this.closed) {
            log.log('Close decision: client stopped, not reconnecting')
            this._setState(ConnectionState.Disconnected)
            return
         }

         // AUTH_TOKEN_MISMATCH 且设备令牌重试预算已用完 → 不重连
         const connectErrorCode = resolveGatewayErrorDetailCode(connectError)
         log.log(
            'Close decision: errorCode=%s, budgetUsed=%s, pendingRetry=%s',
            connectErrorCode,
            this.deviceTokenRetryBudgetUsed,
            this.pendingDeviceTokenRetry,
         )
         if (
            connectErrorCode === ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH &&
            this.deviceTokenRetryBudgetUsed &&
            !this.pendingDeviceTokenRetry
         ) {
            log.log(
               'Close decision: AUTH_TOKEN_MISMATCH + budget used, not reconnecting',
            )
            this._setState(ConnectionState.Error)
            return
         }

         // 不可恢复认证错误 → 不重连
         if (isNonRecoverableAuthError(connectError)) {
            log.log(
               'Close decision: non-recoverable auth error, not reconnecting',
            )
            this._setState(ConnectionState.Error)
            return
         }

         log.log('Close decision: will reconnect')
         this._scheduleReconnect()
      })

      this.ws.on('error', (err) => {
         log.error('WebSocket error:', err.message)
      })
   }

   // ── Private: Frame handling ──

   private _handleFrame(frame: GatewayFrame): void {
      switch (frame.type) {
         case 'event':
            this._handleEvent(frame as EventFrame)
            break
         case 'res':
            this._handleResponse(frame as ResponseFrame)
            break
         default:
            log.log(
               'Unknown frame type:',
               (frame as { type: string }).type,
            )
      }
   }

   private _handleEvent(event: EventFrame): void {
      // 握手 challenge
      if (event.event === 'connect.challenge') {
         log.log('Received connect.challenge')
         const payload = event.payload as { nonce?: unknown } | undefined
         const nonce =
            payload && typeof payload.nonce === 'string' ? payload.nonce : null
         if (nonce) {
            log.log('Challenge nonce received, sending connect...')
            this.connectNonce = nonce
            void this._sendConnect()
         } else {
            log.warn('Challenge received without valid nonce')
         }
         return
      }

      // 心跳
      if (event.event === 'tick') {
         this.lastTick = Date.now()
         return
      }

      // 事件序列 gap 检测
      const seq = typeof event.seq === 'number' ? event.seq : null
      if (seq !== null) {
         if (this.lastSeq !== null && seq > this.lastSeq + 1) {
            log.warn(
               'Event gap detected: expected=%d, received=%d',
               this.lastSeq + 1,
               seq,
            )
            this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq })
         }
         this.lastSeq = seq
      }

      // 转发到上层
      this.opts.onEvent?.(event)
   }

   private _handleResponse(res: ResponseFrame): void {
      const pending = this.pendingRequests.get(res.id)
      if (!pending) {
         log.log('Response for unknown request:', res.id)
         return
      }

      clearTimeout(pending.timer)
      this.pendingRequests.delete(res.id)

      if (res.ok) {
         log.log('Response OK: id=%s', res.id)
         const payload = res.payload as Record<string, unknown> | undefined
         if (payload?.type === 'hello-ok') {
            this._handleHelloOk(payload as unknown as HelloOkPayload)
         }
         pending.resolve(res.payload)
      } else {
         const errorCode = (res.error?.code as string) ?? 'UNAVAILABLE'
         const errorMsg = (res.error?.message as string) ?? 'request failed'
         log.warn('Response ERROR: id=%s, code=%s, message=%s', res.id, errorCode, errorMsg)
         pending.reject(
            new GatewayRequestError({
               code: errorCode,
               message: errorMsg,
               details: res.error?.details,
            }),
         )
      }
   }

   // ── Private: Handshake ──

   private async _sendConnect(): Promise<void> {
      if (this.connectSent) {
         log.log('_sendConnect() skipped: already sent')
         return
      }
      this.connectSent = true
      log.log('_sendConnect() preparing handshake...')

      const keyPair = loadOrCreateKeyPair()
      const deviceId = deriveDeviceId(keyPair.publicKeyPem)
      this.deviceId = deviceId
      log.log('Device ID:', deviceId)
      const publicKeyB64Url = getPublicKeyBase64Url(keyPair.publicKeyPem)

      const platformMap: Record<string, string> = {
         darwin: 'macos',
         win32: 'windows',
         linux: 'linux',
      }

      const clientId = 'openclaw-control-ui'
      const clientMode = 'ui'
      const role = 'operator'
      const scopes = ['operator.read', 'operator.write', 'operator.admin']
      const signedAtMs = Date.now()
      const nonce = this.connectNonce ?? ''

      const signature = signConnectPayload(keyPair.privateKeyPem, {
         deviceId,
         clientId,
         clientMode,
         role,
         scopes,
         signedAtMs,
         token: this.opts.token,
         nonce,
      })

      const device: DeviceIdentity = {
         id: deviceId,
         publicKey: publicKeyB64Url,
         signature,
         signedAt: signedAtMs,
         nonce,
      }

      // 选择认证方式
      const selectedAuth = this._selectConnectAuth({ role, deviceId })
      log.log(
         'Auth selection: hasToken=%s, hasDeviceToken=%s, hasStoredToken=%s, canFallback=%s, pendingRetry=%s',
         !!selectedAuth.authToken,
         !!selectedAuth.authDeviceToken,
         !!selectedAuth.storedToken,
         selectedAuth.canFallbackToShared,
         this.pendingDeviceTokenRetry,
      )
      if (this.pendingDeviceTokenRetry && selectedAuth.authDeviceToken) {
         log.log('Using device token retry path')
         this.pendingDeviceTokenRetry = false
      }

      const auth: { token?: string; deviceToken?: string } = {}
      if (selectedAuth.authToken) {
         auth.token = selectedAuth.authToken
      }
      if (selectedAuth.authDeviceToken) {
         auth.deviceToken = selectedAuth.authDeviceToken
      }

      const params: ConnectParams = {
         minProtocol: PROTOCOL_VERSION,
         maxProtocol: PROTOCOL_VERSION,
         client: {
            id: clientId,
            version: app.getVersion(),
            platform: platformMap[process.platform] ?? process.platform,
            mode: clientMode,
         },
         role,
         scopes,
         caps: ['tool-events'],
         commands: [],
         permissions: {},
         auth,
         locale: app.getLocale() || 'zh-CN',
         userAgent: `ClawUI/${app.getVersion()}`,
         device,
      }

      log.log(
         'Sending connect request: protocol=v%d, client=%s/%s, platform=%s',
         PROTOCOL_VERSION,
         clientId,
         app.getVersion(),
         platformMap[process.platform] ?? process.platform,
      )

      try {
         await this.sendRequest('connect', params)
         log.log('Connect request succeeded')
      } catch (err) {
         const connectErrorCode =
            err instanceof GatewayRequestError
               ? resolveGatewayErrorDetailCode(err)
               : null
         log.error(
            'Connect request failed: code=%s, message=%s',
            connectErrorCode ?? (err instanceof Error ? err.message : String(err)),
            err instanceof GatewayRequestError ? err.gatewayCode : 'N/A',
         )
         const recoveryAdvice =
            err instanceof GatewayRequestError
               ? readConnectErrorRecoveryAdvice(err.details)
               : {}

         const retryWithDeviceTokenRecommended =
            recoveryAdvice.recommendedNextStep === 'retry_with_device_token'
         const canRetryWithDeviceTokenHint =
            recoveryAdvice.canRetryWithDeviceToken === true ||
            retryWithDeviceTokenRecommended ||
            connectErrorCode === ConnectErrorDetailCodes.AUTH_TOKEN_MISMATCH

         const shouldRetryWithDeviceToken =
            !this.deviceTokenRetryBudgetUsed &&
            !selectedAuth.authDeviceToken &&
            Boolean(this.opts.token) &&
            Boolean(selectedAuth.storedToken) &&
            canRetryWithDeviceTokenHint

         log.log(
            'Recovery: shouldRetry=%s, advice=%s, budgetUsed=%s',
            shouldRetryWithDeviceToken,
            recoveryAdvice.recommendedNextStep ?? 'none',
            this.deviceTokenRetryBudgetUsed,
         )

         if (shouldRetryWithDeviceToken) {
            log.log('Will retry with device token on next reconnect')
            this.pendingDeviceTokenRetry = true
            this.deviceTokenRetryBudgetUsed = true
         }

         if (err instanceof GatewayRequestError) {
            this.pendingConnectError = {
               code: err.gatewayCode,
               message: err.message,
               details: err.details,
            }
         } else {
            this.pendingConnectError = undefined
         }

         // 清除失效的设备令牌
         if (
            selectedAuth.canFallbackToShared &&
            connectErrorCode === ConnectErrorDetailCodes.AUTH_DEVICE_TOKEN_MISMATCH
         ) {
            log.log('Clearing invalid device token')
            clearDeviceAuthToken({ deviceId, role })
         }

         this.ws?.close(CONNECT_FAILED_CLOSE_CODE, 'connect failed')
      }
   }

   private _selectConnectAuth(params: {
      role: string
      deviceId: string
   }): SelectedConnectAuth {
      const explicitToken = this.opts.token?.trim() || undefined
      const storedToken = loadDeviceAuthToken({
         deviceId: params.deviceId,
         role: params.role,
      })?.token

      // 如果正在进行设备令牌重试，且有存储的令牌
      const shouldUseDeviceRetryToken =
         this.pendingDeviceTokenRetry &&
         Boolean(explicitToken) &&
         Boolean(storedToken)

      // 没有显式令牌时，使用存储的设备令牌作为主令牌
      const resolvedDeviceToken = !explicitToken ? (storedToken ?? undefined) : undefined
      const authToken = explicitToken ?? resolvedDeviceToken

      return {
         authToken,
         authDeviceToken: shouldUseDeviceRetryToken ? (storedToken ?? undefined) : undefined,
         storedToken: storedToken ?? undefined,
         canFallbackToShared: Boolean(storedToken && explicitToken),
      }
   }

   // ── Private: HelloOk ──

   private _handleHelloOk(payload: HelloOkPayload): void {
      log.log(
         `Connected! Protocol v${payload.protocol}, tick=${payload.policy.tickIntervalMs}ms`,
      )
      log.log(
         'HelloOk: server=%s, connId=%s, features=%d methods/%d events',
         payload.server?.version ?? 'unknown',
         payload.server?.connId ?? 'unknown',
         payload.features?.methods?.length ?? 0,
         payload.features?.events?.length ?? 0,
      )
      this.helloOk = payload
      this.snapshot = payload.snapshot ?? null
      log.log('Snapshot received: %s', this.snapshot ? 'yes' : 'no')
      this.backoffMs = BACKOFF_INITIAL_MS
      this.tickIntervalMs = payload.policy.tickIntervalMs
      this.lastTick = Date.now()
      this.lastSeq = null

      // 重置设备令牌重试标志
      this.pendingDeviceTokenRetry = false
      this.deviceTokenRetryBudgetUsed = false

      // 缓存网关返回的设备令牌
      if (payload.auth?.deviceToken && this.deviceId) {
         log.log('Caching device token from hello-ok')
         storeDeviceAuthToken({
            deviceId: this.deviceId,
            role: payload.auth.role ?? 'operator',
            token: payload.auth.deviceToken,
            scopes: payload.auth.scopes ?? [],
         })
      }

      this._setState(ConnectionState.Connected)
      this._startTickWatchdog()
      this.opts.onHello?.(payload)
   }

   // ── Private: Tick watchdog ──

   private _startTickWatchdog(): void {
      log.log('Starting tick watchdog, interval=%dms', this.tickIntervalMs)
      this._stopTick()
      this.tickTimer = setInterval(() => {
         if (!this.lastTick) return
         const gap = Date.now() - this.lastTick
         if (gap > this.tickIntervalMs * 2) {
            log.warn(`Tick timeout (${gap}ms), closing connection`)
            this.ws?.close(4000, 'tick timeout')
         }
      }, this.tickIntervalMs)
   }

   private _stopTick(): void {
      if (this.tickTimer) {
         clearInterval(this.tickTimer)
         this.tickTimer = null
      }
   }

   // ── Private: Reconnection ──

   private _scheduleReconnect(): void {
      if (this.closed) {
         log.log('_scheduleReconnect() skipped: client is closed')
         return
      }
      const delay = this.backoffMs
      this.backoffMs = Math.min(this.backoffMs * BACKOFF_MULTIPLIER, BACKOFF_MAX_MS)
      this._setState(ConnectionState.Reconnecting)
      log.log(
         'Reconnecting in %dms (next backoff: %dms)',
         Math.round(delay),
         Math.round(this.backoffMs),
      )

      this.reconnectTimer = setTimeout(() => {
         this.reconnectTimer = null
         this._connect()
      }, delay)
   }

   // ── Private: Utilities ──

   private _send(data: unknown): void {
      if (this.ws?.readyState === WebSocket.OPEN) {
         const json = JSON.stringify(data)
         log.log('⇨ SEND frame: %s', summarizeValue(data))
         this.ws.send(json)
      } else {
         log.warn(
            '_send() skipped: ws not open, readyState=%s',
            this.ws?.readyState,
         )
      }
   }

   private _setState(state: ConnectionState): void {
      if (this.state !== state) {
         const prev = this.state
         this.state = state
         log.log(`State: ${prev} → ${state}`)
         this.opts.onStateChanged?.(state)
      }
   }

   private _deriveOrigin(wsUrl: string): string {
      try {
         const u = new URL(wsUrl)
         const protocol = u.protocol === 'wss:' ? 'https:' : 'http:'
         return `${protocol}//${u.host}`
      } catch {
         return 'http://localhost'
      }
   }

   private _cleanup(): void {
      log.log(
         '_cleanup(): pendingRequests=%d, hasWs=%s, hasTick=%s, hasReconnect=%s',
         this.pendingRequests.size,
         !!this.ws,
         !!this.tickTimer,
         !!this.reconnectTimer,
      )
      this._stopTick()

      if (this.reconnectTimer) {
         clearTimeout(this.reconnectTimer)
         this.reconnectTimer = null
      }

      for (const [id, pending] of this.pendingRequests) {
         clearTimeout(pending.timer)
         pending.reject(new Error('Connection closed'))
         this.pendingRequests.delete(id)
      }

      if (this.ws) {
         this.ws.removeAllListeners()
         if (
            this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING
         ) {
            this.ws.close()
         }
         this.ws = null
      }
   }
}

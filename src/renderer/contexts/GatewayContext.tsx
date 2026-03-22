import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ConnectionState, Snapshot, RpcResult } from '../../shared/types/gateway-protocol'
import type { GatewayEventFrame } from '../../shared/types/gateway-events'
import { pushEventLogEntry, clearEventLog } from '../stores/eventLogStore'
import { createLogger } from '../../shared/logger'

const log = createLogger('GatewayContext')

interface GatewayContextValue {
   connectionState: string
   connected: boolean
   connecting: boolean
   lastError: string | null
   lastErrorCode: string | null
   connect: () => Promise<void>
   disconnect: () => Promise<void>
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>
   subscribe: (eventName: string, handler: (payload: unknown) => void) => () => void
}

const GatewayContext = createContext<GatewayContextValue | undefined>(undefined)

export function GatewayProvider(props: { children: React.ReactNode }) {
   const [connectionState, setConnectionState] = useState<string>('disconnected')
   const [connected, setConnected] = useState(false)
   const [connecting, setConnecting] = useState(false)
   const [lastError, setLastError] = useState<string | null>(null)
   const [lastErrorCode, setLastErrorCode] = useState<string | null>(null)
   const listenersRef = useRef<Map<string, Set<(payload: unknown) => void>>>(new Map())

   useEffect(() => {
      log.log('Initializing provider...')
      const api = window.clawAPI?.gateway
      if (!api) {
         log.warn('clawAPI.gateway not available')
         return
      }

      // 初始化状态
      api.getStatus().then((status) => {
         log.log('Initial status: state=%s, connected=%s', status.state, status.connected)
         setConnectionState(status.state)
         setConnected(status.connected)
      })

      // 监听连接状态变更
      api.onStateChanged((state) => {
         log.log('State changed: %s', state)
         setConnectionState(state)
         setConnected(state === 'connected')
         setConnecting(state === 'connecting' || state === 'handshaking')
         // 连接成功时清除错误
         if (state === 'connected') {
            log.log('Connected, clearing errors')
            setLastError(null)
            setLastErrorCode(null)
         }
         // 断连时清空事件日志
         if (state === 'disconnected') {
            clearEventLog()
         }
      })

      // 监听所有 Gateway 事件，分发给订阅者
      api.onEvent((rawEvent) => {
         const evt = rawEvent as GatewayEventFrame

         // 推送到全局事件日志 store
         if (evt.event) {
            pushEventLogEntry({
               ts: Date.now(),
               event: evt.event,
               payload: evt.payload,
            })
         }

         // 处理连接错误事件
         if (evt.event === 'connection-error') {
            const payload = evt.payload as {
               formattedMessage?: string
               error?: { code?: string; details?: unknown }
            } | undefined
            log.warn(
               'Connection error event: %s',
               payload?.formattedMessage ?? 'unknown',
            )
            if (payload?.formattedMessage) {
               setLastError(payload.formattedMessage)
            }
            const errorCode =
               (payload?.error?.details as { code?: string } | undefined)?.code ??
               payload?.error?.code ??
               null
            setLastErrorCode(errorCode ?? null)
         }

         // 分发给具体事件的订阅者
         const handlers = listenersRef.current.get(evt.event)
         if (handlers) {
            log.debug(
               'Dispatching event %s to %d handler(s)',
               evt.event,
               handlers.size,
            )
            for (const handler of handlers) {
               try {
                  handler(evt.payload)
               } catch (err) {
                  log.error(`Event handler error for ${evt.event}:`, err)
               }
            }
         }
         // 也分发给通配符监听者
         const allHandlers = listenersRef.current.get('*')
         if (allHandlers) {
            for (const handler of allHandlers) {
               try {
                  handler(rawEvent)
               } catch (err) {
                  log.error('Wildcard handler error:', err)
               }
            }
         }
      })

      return () => {
         log.log('Cleanup: removing all listeners')
         api.removeAllListeners()
      }
   }, [])

   const connect = useCallback(async () => {
      log.log('connect() called')
      setConnecting(true)
      setLastError(null)
      setLastErrorCode(null)
      try {
         const result = await window.clawAPI.gateway.connect()
         log.log('connect() result: success=%s', result.success)
         if (!result.success) {
            throw new Error(result.error ?? '连接失败')
         }
      } catch (err) {
         log.error('connect() error:', err)
         throw err
      } finally {
         setConnecting(false)
      }
   }, [])

   const disconnect = useCallback(async () => {
      log.log('disconnect() called')
      await window.clawAPI.gateway.disconnect()
      log.log('disconnect() completed')
   }, [])

   const rpc = useCallback(async <T = unknown>(method: string, params?: unknown): Promise<T> => {
      log.log('rpc() called: method=%s', method)
      const result = await window.clawAPI.gateway.rpc(method, params)
      if (!result.ok) {
         const errMsg = result.error?.message ?? 'RPC 调用失败'
         log.warn('rpc() failed: method=%s, error=%s', method, errMsg)
         throw new Error(errMsg)
      }
      log.log('rpc() success: method=%s', method)
      return result.payload as T
   }, [])

   const subscribe = useCallback(
      (eventName: string, handler: (payload: unknown) => void): (() => void) => {
         if (!listenersRef.current.has(eventName)) {
            listenersRef.current.set(eventName, new Set())
         }
         listenersRef.current.get(eventName)!.add(handler)
         log.debug(
            'subscribe: event=%s, totalHandlers=%d',
            eventName,
            listenersRef.current.get(eventName)!.size,
         )

         return () => {
            const set = listenersRef.current.get(eventName)
            if (set) {
               set.delete(handler)
               log.debug(
                  'unsubscribe: event=%s, remainingHandlers=%d',
                  eventName,
                  set.size,
               )
               if (set.size === 0) {
                  listenersRef.current.delete(eventName)
               }
            }
         }
      },
      [],
   )

   const value = useMemo(
      () => ({
         connectionState,
         connected,
         connecting,
         lastError,
         lastErrorCode,
         connect,
         disconnect,
         rpc,
         subscribe,
      }),
      [connectionState, connected, connecting, lastError, lastErrorCode, connect, disconnect, rpc, subscribe],
   )

   return (
      <GatewayContext.Provider value={value}>
         {props.children}
      </GatewayContext.Provider>
   )
}

export function useGateway() {
   const ctx = useContext(GatewayContext)
   if (!ctx) throw new Error('useGateway must be used within GatewayProvider')
   return ctx
}

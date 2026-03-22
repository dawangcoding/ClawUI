import { useState, useEffect, useCallback, useRef } from 'react'
import { RPC } from '../../../../shared/types/gateway-rpc'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('useDebugData')

export interface UseDebugDataResult {
   status: Record<string, unknown> | null
   health: Record<string, unknown> | null
   models: unknown[]
   heartbeat: unknown
   loading: boolean
   error: string | null
   refresh: () => Promise<void>
}

export function useDebugData(
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>,
   connected: boolean,
): UseDebugDataResult {
   const [status, setStatus] = useState<Record<string, unknown> | null>(null)
   const [health, setHealth] = useState<Record<string, unknown> | null>(null)
   const [models, setModels] = useState<unknown[]>([])
   const [heartbeat, setHeartbeat] = useState<unknown>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const loadingRef = useRef(false)

   const refresh = useCallback(async () => {
      if (!connected || loadingRef.current) return
      loadingRef.current = true
      setLoading(true)
      setError(null)
      log.log('Loading debug data...')

      try {
         const results = await Promise.allSettled([
            rpc<Record<string, unknown>>(RPC.STATUS, {}),
            rpc<Record<string, unknown>>(RPC.HEALTH, {}),
            rpc<{ models?: unknown[] }>(RPC.MODELS_LIST, {}),
            rpc<unknown>(RPC.LAST_HEARTBEAT, {}),
         ])

         if (results[0].status === 'fulfilled') {
            setStatus(results[0].value)
         } else {
            log.warn('Failed to load status: %s', results[0].reason)
            setStatus(null)
         }

         if (results[1].status === 'fulfilled') {
            setHealth(results[1].value)
         } else {
            log.warn('Failed to load health: %s', results[1].reason)
            setHealth(null)
         }

         if (results[2].status === 'fulfilled') {
            const payload = results[2].value
            setModels(Array.isArray(payload?.models) ? payload.models : [])
         } else {
            log.warn('Failed to load models: %s', results[2].reason)
            setModels([])
         }

         if (results[3].status === 'fulfilled') {
            setHeartbeat(results[3].value)
         } else {
            log.warn('Failed to load heartbeat: %s', results[3].reason)
            setHeartbeat(null)
         }

         const failed = results.filter((r) => r.status === 'rejected')
         if (failed.length === results.length) {
            setError('所有调试数据加载失败')
         }

         log.log('Debug data loaded: %d/%d succeeded', results.length - failed.length, results.length)
      } catch (err) {
         const msg = err instanceof Error ? err.message : String(err)
         log.error('Unexpected error loading debug data: %s', msg)
         setError(msg)
      } finally {
         loadingRef.current = false
         setLoading(false)
      }
   }, [rpc, connected])

   useEffect(() => {
      if (connected) {
         refresh()
      } else {
         setStatus(null)
         setHealth(null)
         setModels([])
         setHeartbeat(null)
         setError(null)
      }
   }, [connected, refresh])

   return { status, health, models, heartbeat, loading, error, refresh }
}

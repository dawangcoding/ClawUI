import { useState, useEffect, useCallback } from 'react'
import { useGateway } from '../contexts/GatewayContext'
import { createLogger } from '../../shared/logger'

const log = createLogger('useGatewayRpc')

interface UseGatewayRpcOptions {
   /** 是否在连接成功后自动调用 */
   autoFetch?: boolean
}

interface UseGatewayRpcResult<T> {
   data: T | null
   loading: boolean
   error: string | null
   refetch: () => Promise<void>
}

/**
 * 通用 RPC 调用 hook
 */
export function useGatewayRpc<T = unknown>(
   method: string,
   params?: unknown,
   options?: UseGatewayRpcOptions,
): UseGatewayRpcResult<T> {
   const { rpc, connected } = useGateway()
   const [data, setData] = useState<T | null>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)

   const fetch = useCallback(async () => {
      if (!connected) return
      log.log('Fetching: method=%s', method)
      setLoading(true)
      setError(null)
      try {
         const result = await rpc<T>(method, params)
         log.log('Success: method=%s', method)
         setData(result)
      } catch (err) {
         const errMsg = err instanceof Error ? err.message : String(err)
         log.error('Error: method=%s, error=%s', method, errMsg)
         setError(errMsg)
      } finally {
         setLoading(false)
      }
   }, [rpc, connected, method, JSON.stringify(params)])

   useEffect(() => {
      if (options?.autoFetch !== false && connected) {
         log.log('Auto-fetching: method=%s', method)
         fetch()
      }
   }, [connected, fetch, options?.autoFetch])

   return { data, loading, error, refetch: fetch }
}

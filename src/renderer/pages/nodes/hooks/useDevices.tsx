import { useState, useCallback, useEffect } from 'react'
import { Modal, message } from 'antd'
import { useGatewayEvent } from '../../../hooks/useGatewayEvent'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type {
   DevicePairingList,
   PendingDevice,
} from '../../../../shared/types/gateway-protocol'

export function useDevices(
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>,
   connected: boolean,
) {
   const [list, setList] = useState<DevicePairingList | null>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)

   const refresh = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      setError(null)
      try {
         const result = await rpc<{
            pending?: PendingDevice[]
            paired?: PendingDevice[]
         }>(RPC.DEVICE_PAIR_LIST, {})
         setList({
            pending: Array.isArray(result?.pending) ? result.pending : [],
            paired: Array.isArray(result?.paired) ? (result.paired as DevicePairingList['paired']) : [],
         })
      } catch (err) {
         setError(err instanceof Error ? err.message : String(err))
         console.error('[NodesPage] Load devices error:', err)
      } finally {
         setLoading(false)
      }
   }, [rpc, connected])

   useEffect(() => {
      refresh()
   }, [refresh])

   useGatewayEvent('device-pair-requested', () => {
      refresh()
   })

   useGatewayEvent('device-pair-resolved', () => {
      refresh()
   })

   const approve = useCallback(
      async (requestId: string) => {
         try {
            await rpc(RPC.DEVICE_PAIR_APPROVE, { requestId })
            message.success('已批准配对请求')
            await refresh()
         } catch (err) {
            message.error(`批准失败: ${err instanceof Error ? err.message : String(err)}`)
         }
      },
      [rpc, refresh],
   )

   const reject = useCallback(
      (requestId: string) => {
         Modal.confirm({
            title: '拒绝配对请求',
            content: '确定要拒绝此设备配对请求吗？',
            okText: '拒绝',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
               try {
                  await rpc(RPC.DEVICE_PAIR_REJECT, { requestId })
                  message.success('已拒绝配对请求')
                  await refresh()
               } catch (err) {
                  message.error(`拒绝失败: ${err instanceof Error ? err.message : String(err)}`)
               }
            },
         })
      },
      [rpc, refresh],
   )

   const rotate = useCallback(
      async (deviceId: string, role: string, scopes?: string[]) => {
         try {
            const result = await rpc<{ token?: string }>(RPC.DEVICE_TOKEN_ROTATE, {
               deviceId,
               role,
               scopes,
            })
            if (result?.token) {
               Modal.info({
                  title: '新 Token',
                  content: (
                     <div>
                        <p>请复制并妥善保管此 Token：</p>
                        <code
                           style={{
                              display: 'block',
                              padding: 8,
                              background: '#f5f5f5',
                              borderRadius: 4,
                              wordBreak: 'break-all',
                              userSelect: 'all',
                           }}
                        >
                           {result.token}
                        </code>
                     </div>
                  ),
                  width: 480,
               })
            }
            await refresh()
         } catch (err) {
            message.error(`轮换失败: ${err instanceof Error ? err.message : String(err)}`)
         }
      },
      [rpc, refresh],
   )

   const revoke = useCallback(
      (deviceId: string, role: string) => {
         Modal.confirm({
            title: '撤销 Token',
            content: `确定要撤销 ${deviceId} (${role}) 的 Token 吗？`,
            okText: '撤销',
            cancelText: '取消',
            okButtonProps: { danger: true },
            onOk: async () => {
               try {
                  await rpc(RPC.DEVICE_TOKEN_REVOKE, { deviceId, role })
                  message.success('已撤销 Token')
                  await refresh()
               } catch (err) {
                  message.error(`撤销失败: ${err instanceof Error ? err.message : String(err)}`)
               }
            },
         })
      },
      [rpc, refresh],
   )

   return { list, loading, error, refresh, approve, reject, rotate, revoke }
}

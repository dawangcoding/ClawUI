import React, { useState, useEffect, useCallback } from 'react'
import { Card, Input, Button, Alert, Badge, Space, Typography } from 'antd'
import { LinkOutlined, DisconnectOutlined, ReloadOutlined } from '@ant-design/icons'
import { createLogger } from '../../../shared/logger'

const log = createLogger('AccessCard')
const { Text } = Typography

interface AccessCardProps {
   connected: boolean
   connecting: boolean
   connectionState: string
   lastError: string | null
   onConnect: () => Promise<void>
   onDisconnect: () => Promise<void>
   builtinMode: boolean
   builtinRestarting: boolean
   onRestartBuiltin: () => Promise<void>
   serverVersion: string | null
}

export default function AccessCard({
   connected,
   connecting,
   connectionState,
   lastError,
   onConnect,
   onDisconnect,
   builtinMode,
   builtinRestarting,
   onRestartBuiltin,
   serverVersion,
}: AccessCardProps) {
   const [gatewayUrl, setGatewayUrl] = useState('')
   const [token, setToken] = useState('')
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)

   useEffect(() => {
      log.log('Loading saved config...')
      window.clawAPI.gateway.loadConfig().then((config) => {
         if (config) {
            log.log('Config loaded: url=%s', config.gatewayUrl)
            setGatewayUrl(config.gatewayUrl)
            setToken(config.token)
         }
      })
   }, [])

   const handleConnect = useCallback(async () => {
      log.log('Connect clicked')
      setLoading(true)
      setError(null)
      try {
         const result = await window.clawAPI.gateway.saveConfig({ gatewayUrl, token })
         if (!result.success) {
            setError(result.error ?? '保存配置失败')
            return
         }
         await onConnect()
      } catch (err) {
         log.error('Connect error:', err)
         setError(err instanceof Error ? err.message : String(err))
      } finally {
         setLoading(false)
      }
   }, [gatewayUrl, token, onConnect])

   const handleDisconnect = useCallback(async () => {
      log.log('Disconnect clicked')
      try {
         await onDisconnect()
      } catch (err) {
         log.error('Disconnect error:', err)
         setError(err instanceof Error ? err.message : String(err))
      }
   }, [onDisconnect])

   const badgeStatus = connected
      ? 'success' as const
      : connecting
        ? 'processing' as const
        : connectionState === 'error'
          ? 'error' as const
          : 'default' as const

   const statusText = connected
      ? '已连接'
      : connecting
        ? '连接中...'
        : connectionState === 'reconnecting'
          ? '重新连接中...'
          : connectionState === 'error'
            ? '连接错误'
            : '未连接'

   return (
      <Card
         title={
            <Space size={8} align="center">
               <span>Gateway 接入</span>
               {connected && serverVersion && (
                  <Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 'normal' }}>
                     v{serverVersion}
                  </Text>
               )}
            </Space>
         }
         size="small"
         style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
         styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
         extra={
            <Space size={4} align="center">
               <Badge
                  status={badgeStatus}
               />
               <Text
                  type="secondary"
                  style={{ fontSize: 12, letterSpacing: 0.3 }}
               >
                  {statusText}
               </Text>
            </Space>
         }
      >
         <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
            <div>
               <Text
                  type="secondary"
                  style={{
                     fontSize: 11,
                     marginBottom: 6,
                     display: 'block',
                     textTransform: 'uppercase',
                     letterSpacing: 0.5,
                  }}
               >
                  WebSocket URL
               </Text>
               <Input
                  value={gatewayUrl}
                  onChange={(e) => setGatewayUrl(e.target.value)}
                  placeholder="ws://localhost:9090/ws"
                  disabled={connected}
                  size="small"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
               />
            </div>
            <div>
               <Text
                  type="secondary"
                  style={{
                     fontSize: 11,
                     marginBottom: 6,
                     display: 'block',
                     textTransform: 'uppercase',
                     letterSpacing: 0.5,
                  }}
               >
                  Token
               </Text>
               <Input.Password
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="认证令牌"
                  disabled={connected}
                  size="small"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
               />
            </div>
            <div
               style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}
            >
               <Space>
                  {builtinMode && (
                     <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={onRestartBuiltin}
                        loading={builtinRestarting}
                     >
                        重启 OpenClaw
                     </Button>
                  )}
                  {connected ? (
                     <Button
                        danger
                        size="small"
                        icon={<DisconnectOutlined />}
                        onClick={handleDisconnect}
                     >
                        断开连接
                     </Button>
                  ) : (
                     <Button
                        type="primary"
                        size="small"
                        icon={<LinkOutlined />}
                        onClick={handleConnect}
                        loading={loading || connecting}
                        disabled={!gatewayUrl}
                     >
                        连接
                     </Button>
                  )}
               </Space>
            </div>
         </div>

         {(error || (!connected && lastError)) && (
            <Alert
               type="error"
               message={error || lastError}
               style={{ marginTop: 14 }}
               closable={!!error}
               onClose={() => setError(null)}
               showIcon
            />
         )}

         {!connected && !lastError && !error && (
            <div
               style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  fontSize: 12,
                  lineHeight: 1.8,
                  color: 'var(--ant-color-text-tertiary)',
                  background: 'var(--ant-color-fill-quaternary)',
                  borderRadius: 6,
                  borderLeft: '3px solid var(--ant-color-border)',
               }}
            >
               <div style={{ marginBottom: 2, color: 'var(--ant-color-text-secondary)' }}>
                  如何连接：
               </div>
               <div>1. 启动 Gateway: <code style={{ color: 'var(--ant-color-text-secondary)' }}>openclaw gateway run</code></div>
               <div>2. 获取 Token: <code style={{ color: 'var(--ant-color-text-secondary)' }}>openclaw dashboard --no-open</code></div>
               <div>3. 粘贴 URL 和 Token，点击连接</div>
            </div>
         )}
      </Card>
   )
}

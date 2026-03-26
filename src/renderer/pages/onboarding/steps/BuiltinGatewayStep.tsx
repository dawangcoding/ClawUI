import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Typography, Spin, Button, Alert, Space, Badge } from 'antd'
import { ReloadOutlined, ApiOutlined } from '@ant-design/icons'
import { useGateway } from '../../../contexts/GatewayContext'
import { createLogger } from '../../../../shared/logger'
import type { GatewayProcessStatus } from '../../../types/global'

const log = createLogger('BuiltinGatewayStep')

const { Title, Paragraph, Text } = Typography

const STATUS_TEXT: Record<GatewayProcessStatus, string> = {
   idle: '准备启动...',
   starting: '正在启动 Gateway...',
   running: '正在连接...',
   stopping: '正在停止...',
   crashed: 'Gateway 启动失败',
}

interface Props {
   onConnected: () => void
   onSwitchToExternal: () => void
   onBack: () => void
}

export default function BuiltinGatewayStep({ onConnected, onSwitchToExternal, onBack }: Props) {
   const { connected } = useGateway()
   const [status, setStatus] = useState<GatewayProcessStatus>('idle')
   const [error, setError] = useState<string | null>(null)
   const [loading, setLoading] = useState(false)
   const triggeredRef = useRef(false)
   const connectedCalledRef = useRef(false)

   // 连接成功 → 通知父组件
   useEffect(() => {
      if (connected && !connectedCalledRef.current) {
         connectedCalledRef.current = true
         log.log('Connected, proceeding')
         onConnected()
      }
   }, [connected, onConnected])

   // 监听进程状态
   useEffect(() => {
      window.clawAPI.gateway.getBuiltinStatus().then((s) => {
         log.log('Initial builtin status: %s', s)
         setStatus(s)
      })

      const unsubscribe = window.clawAPI.gateway.onBuiltinStatusChanged((s) => {
         log.log('Builtin status changed: %s', s)
         setStatus(s)
         setLoading(false)
      })

      return () => {
         unsubscribe()
      }
   }, [])

   // 自动启动
   useEffect(() => {
      if (triggeredRef.current) return
      if (connected) return // 已连接则不需要启动

      if (status === 'idle' || status === 'crashed') {
         triggeredRef.current = true
         startGateway()
      }
      // running 状态说明已被主进程自动启动，只需等待连接
   }, [status, connected])

   const startGateway = useCallback(async () => {
      log.log('Starting builtin gateway')
      setLoading(true)
      setError(null)
      try {
         const result = await window.clawAPI.gateway.startBuiltin()
         if (!result.success) {
            setError(result.error ?? '启动失败')
            setLoading(false)
         }
      } catch (err) {
         log.error('startBuiltin error:', err)
         setError(err instanceof Error ? err.message : String(err))
         setLoading(false)
      }
   }, [])

   const handleRetry = useCallback(() => {
      triggeredRef.current = true
      connectedCalledRef.current = false
      startGateway()
   }, [startGateway])

   const isFailed = status === 'crashed' || (error !== null && !loading)

   return (
      <div style={{ textAlign: 'center' }}>
         <Title level={3} style={{ marginBottom: 8 }}>
            启动内置 Gateway
         </Title>
         <Paragraph type="secondary" style={{ marginBottom: 32 }}>
            正在启动 OpenClaw Gateway，请稍候...
         </Paragraph>

         {!isFailed && (
            <div style={{ marginBottom: 24 }}>
               <Spin size="large" />
               <div style={{ marginTop: 16 }}>
                  <Badge
                     status={
                        status === 'running' || connected ? 'processing' : 'default'
                     }
                  />
                  <Text style={{ marginLeft: 8 }}>
                     {connected ? '已连接' : STATUS_TEXT[status]}
                  </Text>
               </div>
               <div style={{ marginTop: 24 }}>
                  <Button onClick={onBack}>上一步</Button>
               </div>
            </div>
         )}

         {isFailed && (
            <div>
               <Alert
                  type="error"
                  message="Gateway 启动失败"
                  description={error ?? '内置 Gateway 进程崩溃，请重试或切换为外部模式。'}
                  style={{ marginBottom: 24, textAlign: 'left' }}
               />
               <Space>
                  <Button onClick={onBack}>上一步</Button>
                  <Button
                     type="primary"
                     icon={<ReloadOutlined />}
                     onClick={handleRetry}
                     loading={loading}
                  >
                     重试
                  </Button>
                  <Button icon={<ApiOutlined />} onClick={onSwitchToExternal}>
                     切换为外部模式
                  </Button>
               </Space>
            </div>
         )}
      </div>
   )
}

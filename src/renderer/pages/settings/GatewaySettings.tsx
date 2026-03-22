import React, { useState, useEffect, useCallback } from 'react'
import {
   Typography,
   Form,
   Input,
   Button,
   Space,
   Alert,
   Card,
   Badge,
   Descriptions,
   Segmented,
   Spin,
} from 'antd'
import {
   LinkOutlined,
   DisconnectOutlined,
   SaveOutlined,
   PoweroffOutlined,
   ReloadOutlined,
   PlayCircleOutlined,
} from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { useSnapshot } from '../../contexts/SnapshotContext'
import { createLogger } from '../../../shared/logger'
import type { GatewayMode, GatewayProcessStatus } from '../../types/global'

const log = createLogger('GatewaySettings')

const { Title, Text } = Typography

const STATUS_BADGE: Record<GatewayProcessStatus, 'success' | 'processing' | 'error' | 'default'> =
   {
      idle: 'default',
      starting: 'processing',
      running: 'success',
      stopping: 'processing',
      crashed: 'error',
   }

const STATUS_TEXT: Record<GatewayProcessStatus, string> = {
   idle: '未启动',
   starting: '启动中...',
   running: '运行中',
   stopping: '停止中...',
   crashed: '已崩溃',
}

export default function GatewaySettings() {
   const { connected, connectionState, connect, disconnect } = useGateway()
   const { serverVersion, helloOk } = useSnapshot()
   const [gatewayUrl, setGatewayUrl] = useState('')
   const [token, setToken] = useState('')
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [saved, setSaved] = useState(false)

   // 内置 Gateway 状态
   const [mode, setMode] = useState<GatewayMode>('external')
   const [bundled, setBundled] = useState(false)
   const [builtinStatus, setBuiltinStatus] = useState<GatewayProcessStatus>('idle')
   const [builtinLoading, setBuiltinLoading] = useState(false)

   // 加载保存的配置 & 模式
   useEffect(() => {
      log.log('Loading saved config...')
      window.clawAPI.gateway.loadConfig().then((config) => {
         if (config) {
            log.log('Config loaded: url=%s, mode=%s', config.gatewayUrl, config.mode)
            setGatewayUrl(config.gatewayUrl)
            setToken(config.token)
            if (config.mode) setMode(config.mode)
         } else {
            log.log('No saved config found')
         }
      })
      window.clawAPI.gateway.checkBundled().then((available) => {
         log.log('Bundled check: %s', available)
         setBundled(available)
      })
      window.clawAPI.gateway.getBuiltinStatus().then((status) => {
         setBuiltinStatus(status)
      })
   }, [])

   // 监听内置 Gateway 状态变化
   useEffect(() => {
      window.clawAPI.gateway.onBuiltinStatusChanged((status) => {
         log.log('Builtin status changed: %s', status)
         setBuiltinStatus(status)
         setBuiltinLoading(false)
      })
      return () => {
         window.clawAPI.gateway.removeAllListeners()
      }
   }, [])

   const handleModeChange = useCallback(
      async (value: string | number) => {
         const newMode = value as GatewayMode
         log.log('Mode change: %s → %s', mode, newMode)
         setError(null)
         try {
            await window.clawAPI.gateway.setMode(newMode)
            setMode(newMode)
         } catch (err) {
            log.error('setMode error:', err)
            setError(err instanceof Error ? err.message : String(err))
         }
      },
      [mode],
   )

   const handleStartBuiltin = useCallback(async () => {
      log.log('Start builtin gateway')
      setBuiltinLoading(true)
      setError(null)
      try {
         const result = await window.clawAPI.gateway.startBuiltin()
         if (!result.success) {
            setError(result.error ?? '启动失败')
            setBuiltinLoading(false)
         }
      } catch (err) {
         log.error('startBuiltin error:', err)
         setError(err instanceof Error ? err.message : String(err))
         setBuiltinLoading(false)
      }
   }, [])

   const handleStopBuiltin = useCallback(async () => {
      log.log('Stop builtin gateway')
      setBuiltinLoading(true)
      setError(null)
      try {
         await window.clawAPI.gateway.stopBuiltin()
      } catch (err) {
         log.error('stopBuiltin error:', err)
         setError(err instanceof Error ? err.message : String(err))
         setBuiltinLoading(false)
      }
   }, [])

   const handleRestartBuiltin = useCallback(async () => {
      log.log('Restart builtin gateway')
      setBuiltinLoading(true)
      setError(null)
      try {
         const result = await window.clawAPI.gateway.restartBuiltin()
         if (!result.success) {
            setError(result.error ?? '重启失败')
            setBuiltinLoading(false)
         }
      } catch (err) {
         log.error('restartBuiltin error:', err)
         setError(err instanceof Error ? err.message : String(err))
         setBuiltinLoading(false)
      }
   }, [])

   const handleSave = async () => {
      log.log('Saving config: url=%s', gatewayUrl)
      setError(null)
      try {
         const result = await window.clawAPI.gateway.saveConfig({ gatewayUrl, token })
         if (!result.success) {
            log.error('Save failed:', result.error)
            setError(result.error ?? '保存失败')
            return
         }
         log.log('Config saved successfully')
         setSaved(true)
         setTimeout(() => setSaved(false), 2000)
      } catch (err) {
         log.error('Save error:', err)
         setError(err instanceof Error ? err.message : String(err))
      }
   }

   const handleConnect = async () => {
      log.log('Connect button clicked')
      setLoading(true)
      setError(null)
      try {
         await handleSave()
         log.log('Config saved, initiating connection...')
         await connect()
         log.log('Connection initiated')
      } catch (err) {
         log.error('Connect error:', err)
         setError(err instanceof Error ? err.message : String(err))
      } finally {
         setLoading(false)
      }
   }

   const handleDisconnect = async () => {
      log.log('Disconnect button clicked')
      try {
         await disconnect()
         log.log('Disconnected')
      } catch (err) {
         log.error('Disconnect error:', err)
         setError(err instanceof Error ? err.message : String(err))
      }
   }

   return (
      <div style={{ maxWidth: 600 }}>
         <Title level={4}>Gateway 连接设置</Title>

         {/* 模式选择 */}
         {bundled && (
            <Card size="small" style={{ marginBottom: 16 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text strong>连接模式</Text>
                  <Segmented
                     value={mode}
                     onChange={handleModeChange}
                     options={[
                        { label: '内置 Gateway', value: 'builtin' },
                        { label: '外部 Gateway', value: 'external' },
                     ]}
                  />
               </div>
            </Card>
         )}

         {/* 连接状态 */}
         <Card size="small" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <Badge
                  status={
                     connected
                        ? 'success'
                        : connectionState === 'connecting' || connectionState === 'handshaking'
                          ? 'processing'
                          : connectionState === 'error'
                            ? 'error'
                            : 'default'
                  }
               />
               <Text>
                  {connected
                     ? `已连接 (${serverVersion ?? 'unknown'})`
                     : connectionState === 'connecting' || connectionState === 'handshaking'
                       ? '连接中...'
                       : connectionState === 'reconnecting'
                         ? '重新连接中...'
                         : connectionState === 'error'
                           ? '连接错误'
                           : '未连接'}
               </Text>
            </div>
         </Card>

         {error && (
            <Alert
               type="error"
               message="错误"
               description={error}
               style={{ marginBottom: 16 }}
               closable
               onClose={() => setError(null)}
            />
         )}

         {/* 内置 Gateway 控制面板 */}
         {mode === 'builtin' && bundled && (
            <Card title="内置 Gateway" size="small" style={{ marginBottom: 16 }}>
               <div
                  style={{
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'space-between',
                  }}
               >
                  <Space>
                     <Badge status={STATUS_BADGE[builtinStatus]} />
                     <Text>{STATUS_TEXT[builtinStatus]}</Text>
                     {builtinLoading && <Spin size="small" />}
                  </Space>
                  <Space>
                     {builtinStatus === 'idle' || builtinStatus === 'crashed' ? (
                        <Button
                           type="primary"
                           size="small"
                           icon={<PlayCircleOutlined />}
                           onClick={handleStartBuiltin}
                           loading={builtinLoading}
                        >
                           启动
                        </Button>
                     ) : builtinStatus === 'running' ? (
                        <>
                           <Button
                              size="small"
                              icon={<ReloadOutlined />}
                              onClick={handleRestartBuiltin}
                              loading={builtinLoading}
                           >
                              重启
                           </Button>
                           <Button
                              danger
                              size="small"
                              icon={<PoweroffOutlined />}
                              onClick={handleStopBuiltin}
                              loading={builtinLoading}
                           >
                              停止
                           </Button>
                        </>
                     ) : null}
                  </Space>
               </div>
            </Card>
         )}

         {/* 外部模式：手动配置 */}
         {mode === 'external' && (
            <Form layout="vertical">
               <Form.Item label="Gateway URL" required>
                  <Input
                     value={gatewayUrl}
                     onChange={(e) => setGatewayUrl(e.target.value)}
                     placeholder="ws://localhost:9090/ws"
                     disabled={connected}
                  />
               </Form.Item>
               <Form.Item label="Token" required>
                  <Input.Password
                     value={token}
                     onChange={(e) => setToken(e.target.value)}
                     placeholder="认证令牌"
                     disabled={connected}
                  />
               </Form.Item>
               <Form.Item>
                  <Space>
                     {connected ? (
                        <Button
                           danger
                           icon={<DisconnectOutlined />}
                           onClick={handleDisconnect}
                        >
                           断开连接
                        </Button>
                     ) : (
                        <Button
                           type="primary"
                           icon={<LinkOutlined />}
                           onClick={handleConnect}
                           loading={loading}
                           disabled={!gatewayUrl || !token}
                        >
                           连接
                        </Button>
                     )}
                     <Button
                        icon={<SaveOutlined />}
                        onClick={handleSave}
                        disabled={connected}
                     >
                        {saved ? '已保存' : '仅保存'}
                     </Button>
                  </Space>
               </Form.Item>
            </Form>
         )}

         {connected && helloOk && (
            <Card title="连接详情" size="small" style={{ marginTop: 16 }}>
               <Descriptions size="small" column={1}>
                  <Descriptions.Item label="协议版本">{helloOk.protocol}</Descriptions.Item>
                  <Descriptions.Item label="服务器版本">
                     {helloOk.server?.version}
                  </Descriptions.Item>
                  <Descriptions.Item label="连接 ID">{helloOk.server?.connId}</Descriptions.Item>
                  <Descriptions.Item label="心跳间隔">
                     {helloOk.policy?.tickIntervalMs}ms
                  </Descriptions.Item>
                  <Descriptions.Item label="支持方法">
                     {helloOk.features?.methods?.length ?? 0} 个
                  </Descriptions.Item>
                  <Descriptions.Item label="支持事件">
                     {helloOk.features?.events?.length ?? 0} 个
                  </Descriptions.Item>
               </Descriptions>
            </Card>
         )}
      </div>
   )
}

import React, { useState, useEffect, useCallback } from 'react'
import { Typography, Form, Input, Button, Space, Alert, Card, Badge, Descriptions } from 'antd'
import { LinkOutlined, DisconnectOutlined, SaveOutlined } from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { useSnapshot } from '../../contexts/SnapshotContext'
import { createLogger } from '../../../shared/logger'

const log = createLogger('GatewaySettings')

const { Title, Text } = Typography

export default function GatewaySettings() {
   const { connected, connectionState, connect, disconnect } = useGateway()
   const { serverVersion, helloOk } = useSnapshot()
   const [gatewayUrl, setGatewayUrl] = useState('')
   const [token, setToken] = useState('')
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [saved, setSaved] = useState(false)

   // 加载保存的配置
   useEffect(() => {
      log.log('Loading saved config...')
      window.clawAPI.gateway.loadConfig().then((config) => {
         if (config) {
            log.log('Config loaded: url=%s', config.gatewayUrl)
            setGatewayUrl(config.gatewayUrl)
            setToken(config.token)
         } else {
            log.log('No saved config found')
         }
      })
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

         {connected && helloOk && (
            <Card title="连接详情" size="small" style={{ marginTop: 16 }}>
               <Descriptions size="small" column={1}>
                  <Descriptions.Item label="协议版本">{helloOk.protocol}</Descriptions.Item>
                  <Descriptions.Item label="服务器版本">{helloOk.server?.version}</Descriptions.Item>
                  <Descriptions.Item label="连接 ID">{helloOk.server?.connId}</Descriptions.Item>
                  <Descriptions.Item label="心跳间隔">{helloOk.policy?.tickIntervalMs}ms</Descriptions.Item>
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

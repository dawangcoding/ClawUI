import React, { useState, useEffect, useRef } from 'react'
import { Typography, Form, Input, Button, Alert, Space } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import { useGateway } from '../../../contexts/GatewayContext'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('ExternalGatewayStep')

const { Title, Paragraph } = Typography

interface Props {
   onConnected: () => void
   onBack: () => void
}

export default function ExternalGatewayStep({ onConnected, onBack }: Props) {
   const { connected, lastError } = useGateway()
   const [gatewayUrl, setGatewayUrl] = useState('')
   const [token, setToken] = useState('')
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const connectedCalledRef = useRef(false)

   useEffect(() => {
      if (connected && !connectedCalledRef.current) {
         connectedCalledRef.current = true
         log.log('External gateway connected')
         onConnected()
      }
   }, [connected, onConnected])

   const handleConnect = async () => {
      log.log('Connecting to external gateway: %s', gatewayUrl)
      setLoading(true)
      setError(null)
      connectedCalledRef.current = false
      try {
         const saveResult = await window.clawAPI.gateway.saveConfig({ gatewayUrl, token })
         if (!saveResult.success) {
            setError(saveResult.error ?? '保存配置失败')
            setLoading(false)
            return
         }
         const connectResult = await window.clawAPI.gateway.connect()
         if (!connectResult.success) {
            setError(connectResult.error ?? '连接失败')
            setLoading(false)
         }
         // 连接成功会由 useEffect 中的 connected 状态变化处理
      } catch (err) {
         log.error('Connect error:', err)
         setError(err instanceof Error ? err.message : String(err))
         setLoading(false)
      }
   }

   const displayError = error ?? (lastError && loading ? null : lastError)

   return (
      <div>
         <Title level={3} style={{ marginBottom: 8 }}>
            连接外部 Gateway
         </Title>
         <Paragraph type="secondary" style={{ marginBottom: 24 }}>
            输入已有 OpenClaw Gateway 的连接信息。
         </Paragraph>

         {displayError && (
            <Alert
               type="error"
               message="连接失败"
               description={displayError}
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
                  disabled={loading}
               />
            </Form.Item>
            <Form.Item label="Token" required>
               <Input.Password
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="认证令牌"
                  disabled={loading}
               />
            </Form.Item>
            <Form.Item>
               <Space>
                  <Button onClick={onBack} disabled={loading}>
                     上一步
                  </Button>
                  <Button
                     type="primary"
                     icon={<LinkOutlined />}
                     onClick={handleConnect}
                     loading={loading}
                     disabled={!gatewayUrl || !token}
                  >
                     测试连接
                  </Button>
               </Space>
            </Form.Item>
         </Form>
      </div>
   )
}

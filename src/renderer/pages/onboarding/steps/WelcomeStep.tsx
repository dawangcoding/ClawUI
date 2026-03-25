import React from 'react'
import { Typography, Card, Space } from 'antd'
import { CloudServerOutlined, ApiOutlined } from '@ant-design/icons'
import type { GatewayMode } from '../../../types/global'
import styles from '../OnboardingWizard.module.css'

const { Title, Text, Paragraph } = Typography

interface Props {
   bundledAvailable: boolean
   onSelect: (mode: GatewayMode) => void
}

export default function WelcomeStep({ bundledAvailable, onSelect }: Props) {
   return (
      <div>
         <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Title level={2} style={{ marginBottom: 8 }}>
               欢迎使用 ClawUI
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 15 }}>
               ClawUI 是 OpenClaw 的桌面客户端。请选择 Gateway 的连接方式开始使用。
            </Paragraph>
         </div>

         <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card
               hoverable={bundledAvailable}
               className={bundledAvailable ? styles.modeCard : undefined}
               style={{
                  cursor: bundledAvailable ? 'pointer' : 'not-allowed',
                  opacity: bundledAvailable ? 1 : 0.5,
               }}
               onClick={() => bundledAvailable && onSelect('builtin')}
            >
               <Space size={16} align="start">
                  <CloudServerOutlined style={{ fontSize: 28, color: '#1668dc' }} />
                  <div>
                     <Text strong style={{ fontSize: 15 }}>
                        内置 Gateway
                     </Text>
                     <Text
                        type="secondary"
                        style={{
                           display: 'inline',
                           marginLeft: 8,
                           fontSize: 12,
                        }}
                     >
                        推荐
                     </Text>
                     <Paragraph
                        type="secondary"
                        style={{ marginBottom: 0, marginTop: 4, fontSize: 13 }}
                     >
                        使用内置的 OpenClaw Gateway，自动启动和管理。适合个人使用。
                     </Paragraph>
                     {!bundledAvailable && (
                        <Paragraph
                           type="warning"
                           style={{ marginBottom: 0, marginTop: 4, fontSize: 12 }}
                        >
                           内置 Gateway 不可用（未打包）
                        </Paragraph>
                     )}
                  </div>
               </Space>
            </Card>

            <Card
               hoverable
               className={styles.modeCard}
               style={{ cursor: 'pointer' }}
               onClick={() => onSelect('external')}
            >
               <Space size={16} align="start">
                  <ApiOutlined style={{ fontSize: 28, color: '#8c8c8c' }} />
                  <div>
                     <Text strong style={{ fontSize: 15 }}>
                        连接外部 Gateway
                     </Text>
                     <Paragraph
                        type="secondary"
                        style={{ marginBottom: 0, marginTop: 4, fontSize: 13 }}
                     >
                        连接到已有的 OpenClaw Gateway 实例。需要提供 URL 和认证令牌。
                     </Paragraph>
                  </div>
               </Space>
            </Card>
         </Space>
      </div>
   )
}

import React from 'react'
import { Alert, Button } from 'antd'
import { useNavigation } from '../contexts/NavigationContext'
import { useGateway } from '../contexts/GatewayContext'

export default function ConnectionBanner() {
   const { navigate } = useNavigation()
   const { connectionState, lastError } = useGateway()

   const isError = connectionState === 'error'
   const isReconnecting = connectionState === 'reconnecting'

   return (
      <Alert
         type={isError ? 'error' : 'warning'}
         message={
            isError
               ? '连接失败'
               : isReconnecting
                 ? '正在重新连接...'
                 : '未连接到 Gateway'
         }
         description={
            isError
               ? (lastError ?? '无法连接到 Gateway 服务器，请检查配置。')
               : isReconnecting
                 ? (lastError
                      ? `正在尝试重新连接到 Gateway... (${lastError})`
                      : '正在尝试重新连接到 Gateway...')
                 : '请先配置并连接到 Gateway 以使用全部功能。'
         }
         action={
            <Button size="small" onClick={() => navigate('overview')}>
               连接设置
            </Button>
         }
         banner
         closable={false}
      />
   )
}

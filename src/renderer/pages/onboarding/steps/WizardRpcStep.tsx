import React, { useEffect, useCallback } from 'react'
import { Typography, Alert, Button, Spin } from 'antd'
import { useWizardRpc } from '../hooks/useWizardRpc'
import { useWizardModels } from '../hooks/useWizardModels'
import WizardStepRenderer from '../components/WizardStepRenderer'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('WizardRpcStep')

const { Title, Paragraph } = Typography

interface Props {
   onDone: () => void
}

export default function WizardRpcStep({ onDone }: Props) {
   const {
      currentStep,
      done,
      endStatus,
      endError,
      loading,
      error,
      autoAnswering,
      startWizard,
      answerStep,
   } = useWizardRpc()

   // 获取模型列表用于格式化显示
   const { getModelDisplayName } = useWizardModels()

   useEffect(() => {
      startWizard()
   }, []) // eslint-disable-line react-hooks/exhaustive-deps

   useEffect(() => {
      if (done && endStatus === 'done') {
         log.log('Wizard completed successfully')
         onDone()
      }
   }, [done, endStatus, onDone])

   const handleAnswer = useCallback(
      (stepId: string, value: unknown) => {
         answerStep(stepId, value)
      },
      [answerStep],
   )

   const handleRetry = useCallback(() => {
      startWizard()
   }, [startWizard])

   // 初始加载或自动配置中
   if (!currentStep && !error && !done) {
      return (
         <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <Spin size="large" />
            <Paragraph type="secondary" style={{ marginTop: 16 }}>
               {autoAnswering ? '正在自动配置...' : '正在初始化配置向导...'}
            </Paragraph>
         </div>
      )
   }

   // wizard 异常终止（error 或 cancelled）
   if (done && endStatus && endStatus !== 'done') {
      return (
         <div>
            <Title level={3} style={{ marginBottom: 8 }}>
               配置向导
            </Title>
            <Alert
               type={endStatus === 'cancelled' ? 'warning' : 'error'}
               message={endStatus === 'cancelled' ? '配置向导已取消' : '配置向导异常终止'}
               description={endError ?? '向导未能正常完成，配置可能未保存。'}
               style={{ marginBottom: 24 }}
            />
            <Button type="primary" onClick={handleRetry}>
               重新配置
            </Button>
         </div>
      )
   }

   // wizard.start 失败
   if (error && !currentStep) {
      return (
         <div>
            <Title level={3} style={{ marginBottom: 8 }}>
               配置向导
            </Title>
            <Alert
               type="error"
               message="初始化失败"
               description={error}
               style={{ marginBottom: 24 }}
            />
            <Button type="primary" onClick={handleRetry}>
               重试
            </Button>
         </div>
      )
   }

   return (
      <div>
         {/* 步骤错误提示 */}
         {error && (
            <Alert
               type="error"
               message="操作失败"
               description={error}
               style={{ marginBottom: 16 }}
               closable
            />
         )}

         {/* 当前步骤 */}
         {currentStep && (
            <WizardStepRenderer
               step={currentStep}
               loading={loading}
               onAnswer={handleAnswer}
               getModelDisplayName={getModelDisplayName}
            />
         )}
      </div>
   )
}

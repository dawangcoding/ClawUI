import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Steps } from 'antd'
import { useGateway } from '../../contexts/GatewayContext'
import WelcomeStep from './steps/WelcomeStep'
import BuiltinGatewayStep from './steps/BuiltinGatewayStep'
import ExternalGatewayStep from './steps/ExternalGatewayStep'
import WizardRpcStep from './steps/WizardRpcStep'
import CompletionStep from './steps/CompletionStep'
import { createLogger } from '../../../shared/logger'
import type { GatewayMode } from '../../types/global'
import styles from './OnboardingWizard.module.css'

const log = createLogger('Onboarding')

type Phase = 'welcome' | 'gateway' | 'wizard' | 'complete'

interface Props {
   onComplete: () => void
}

export default function OnboardingWizard({ onComplete }: Props) {
   const { connected } = useGateway()
   const [phase, setPhase] = useState<Phase>('welcome')
   const [mode, setMode] = useState<GatewayMode | null>(null)
   const [bundledAvailable, setBundledAvailable] = useState(false)

   useEffect(() => {
      window.clawAPI.gateway.checkBundled().then((available) => {
         log.log('Bundled available: %s', available)
         setBundledAvailable(available)
      })
   }, [])

   const handleModeSelect = useCallback(
      async (selected: GatewayMode) => {
         log.log('Mode selected: %s', selected)
         setMode(selected)
         try {
            await window.clawAPI.gateway.setMode(selected)
         } catch (err) {
            log.error('setMode error:', err)
         }
         setPhase('gateway')
      },
      [],
   )

   const handleGatewayConnected = useCallback(() => {
      log.log('Gateway connected, mode=%s', mode)
      if (mode === 'builtin') {
         setPhase('wizard')
      } else {
         // 外部模式不需要 wizard，直接完成
         setPhase('complete')
      }
   }, [mode])

   const handleWizardDone = useCallback(() => {
      log.log('Wizard done')
      setPhase('complete')
   }, [])

   const handleComplete = useCallback(async () => {
      log.log('Completing onboarding')
      try {
         await window.clawAPI.gateway.markOnboardingCompleted()
      } catch (err) {
         log.error('markOnboardingCompleted error:', err)
      }
      onComplete()
   }, [onComplete])

   const handleSwitchToExternal = useCallback(async () => {
      log.log('Switching to external mode')
      setMode('external')
      try {
         await window.clawAPI.gateway.setMode('external')
      } catch (err) {
         log.error('setMode error:', err)
      }
   }, [])

   const currentStepIndex = useMemo(() => {
      switch (phase) {
         case 'welcome':
            return 0
         case 'gateway':
            return 1
         case 'wizard':
            return 2
         case 'complete':
            return mode === 'builtin' ? 3 : 2
         default:
            return 0
      }
   }, [phase, mode])

   const steps = useMemo(() => {
      const items = [
         { title: '选择模式' },
         { title: '连接 Gateway' },
      ]
      if (mode === 'builtin' || mode === null) {
         items.push({ title: '配置' })
      }
      items.push({ title: '完成' })
      return items
   }, [mode])

   return (
      <div className={styles.container}>
         <div className={styles.dragRegion} />
         <div className={styles.body}>
            <div className={styles.inner}>
               <div className={styles.stepsBar}>
                  <Steps current={currentStepIndex} items={steps} size="small" />
               </div>
               <div className={styles.stepContent}>
                  {phase === 'welcome' && (
                     <WelcomeStep
                        bundledAvailable={bundledAvailable}
                        onSelect={handleModeSelect}
                     />
                  )}
                  {phase === 'gateway' && mode === 'builtin' && (
                     <BuiltinGatewayStep
                        onConnected={handleGatewayConnected}
                        onSwitchToExternal={handleSwitchToExternal}
                     />
                  )}
                  {phase === 'gateway' && mode === 'external' && (
                     <ExternalGatewayStep onConnected={handleGatewayConnected} />
                  )}
                  {phase === 'wizard' && (
                     <WizardRpcStep onDone={handleWizardDone} />
                  )}
                  {phase === 'complete' && (
                     <CompletionStep mode={mode} onFinish={handleComplete} />
                  )}
               </div>
            </div>
         </div>
      </div>
   )
}

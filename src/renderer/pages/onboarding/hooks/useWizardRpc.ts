import { useState, useCallback, useRef } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import { createLogger } from '../../../../shared/logger'
import {
   type WizardPhase,
   isAuthProviderStep,
   isPostAuthSignal,
   shouldShowToUser,
   resolveAutoAnswer,
} from './wizard-auto-answer'

const log = createLogger('useWizardRpc')

// 自动回答循环的最大步数（安全保护）
const MAX_AUTO_ANSWER_STEPS = 60

// ── WizardStep 类型（镜像 Gateway 协议） ──

export interface WizardStepOption {
   value: unknown
   label: string
   /** Human-readable name (e.g., "MoonshotAI: Kimi K2.5"), falls back to label when absent */
   name?: string
   hint?: string
}

export interface WizardStep {
   id: string
   type: 'note' | 'select' | 'text' | 'confirm' | 'multiselect' | 'progress' | 'action'
   title?: string
   message?: string
   options?: WizardStepOption[]
   initialValue?: unknown
   placeholder?: string
   sensitive?: boolean
   executor?: 'gateway' | 'client'
}

interface WizardStartResult {
   sessionId: string
   done: boolean
   step?: WizardStep
   status?: string
   error?: string
}

interface WizardNextResult {
   done: boolean
   step?: WizardStep
   status?: string
   error?: string
}

export type WizardEndStatus = 'done' | 'cancelled' | 'error'

export interface UseWizardRpcReturn {
   sessionId: string | null
   currentStep: WizardStep | null
   done: boolean
   /** wizard 结束状态：'done' 表示正常完成，'error'/'cancelled' 表示异常终止 */
   endStatus: WizardEndStatus | null
   /** wizard 结束时的错误信息（status 为 error/cancelled 时） */
   endError: string | null
   loading: boolean
   error: string | null
   /** 是否正在自动回答非模型步骤 */
   autoAnswering: boolean
   startWizard: () => Promise<void>
   answerStep: (stepId: string, value: unknown) => Promise<void>
   cancelWizard: () => Promise<void>
}

export function useWizardRpc(): UseWizardRpcReturn {
   const { rpc } = useGateway()
   const [sessionId, setSessionId] = useState<string | null>(null)
   const [currentStep, setCurrentStep] = useState<WizardStep | null>(null)
   const [done, setDone] = useState(false)
   const [endStatus, setEndStatus] = useState<WizardEndStatus | null>(null)
   const [endError, setEndError] = useState<string | null>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [autoAnswering, setAutoAnswering] = useState(false)

   // 阶段状态和取消标志使用 ref（避免闭包过期问题）
   const phaseRef = useRef<WizardPhase>('pre-auth')
   const cancelledRef = useRef(false)
   const sessionIdRef = useRef<string | null>(null)

   /**
    * 处理 wizard 完成状态。
    * 返回 true 表示 wizard 已结束（done=true），调用者应停止处理。
    */
   const handleDone = useCallback(
      (result: { done: boolean; status?: string; error?: string }): boolean => {
         if (!result.done) return false

         setDone(true)
         setCurrentStep(null)
         setAutoAnswering(false)
         const status = (result.status ?? 'done') as WizardEndStatus
         setEndStatus(status)
         if (status === 'error' || status === 'cancelled') {
            const errMsg =
               result.error ??
               (status === 'cancelled' ? '配置向导已取消' : '配置向导异常终止')
            setEndError(errMsg)
            log.warn('Wizard ended with status=%s, error=%s', status, errMsg)
         }
         return true
      },
      [],
   )

   /**
    * 核心循环：持续自动回答非模型步骤，直到遇到需要用户交互的步骤或 wizard 结束。
    *
    * @param sid - wizard session ID
    * @param initialStep - 起始步骤
    */
   const processStepLoop = useCallback(
      async (sid: string, initialStep: WizardStep | undefined) => {
         let step = initialStep
         let autoCount = 0

         while (step) {
            // ── 每步详细日志（调试用） ──
            log.log(
               '[step] #%d phase=%s id=%s type=%s msg=%s opts=%s init=%s sensitive=%s',
               autoCount,
               phaseRef.current,
               step.id,
               step.type,
               (step.message ?? step.title ?? '(none)').slice(0, 120),
               step.options
                  ? JSON.stringify(step.options.map((o) => o.value))
                  : '(none)',
               step.initialValue !== undefined ? JSON.stringify(step.initialValue) : '(none)',
               step.sensitive ?? false,
            )

            // 检查取消标志
            if (cancelledRef.current) {
               log.log('processStepLoop: cancelled, stopping')
               setAutoAnswering(false)
               return
            }

            // 安全保护：防止无限循环
            if (autoCount >= MAX_AUTO_ANSWER_STEPS) {
               log.warn('processStepLoop: exceeded max auto-answer steps (%d), falling back to user', MAX_AUTO_ANSWER_STEPS)
               setAutoAnswering(false)
               setCurrentStep(step)
               setLoading(false)
               return
            }

            // ── 阶段转换检测 ──
            if (phaseRef.current === 'pre-auth' && isAuthProviderStep(step)) {
               log.log('Phase transition: pre-auth → auth (step=%s)', step.id)
               phaseRef.current = 'auth'
            } else if (phaseRef.current === 'auth' && isPostAuthSignal(step)) {
               log.log('Phase transition: auth → post-auth (step=%s)', step.id)
               phaseRef.current = 'post-auth'
            }

            // ── 判断是否展示给用户 ──
            if (shouldShowToUser(step, phaseRef.current)) {
               log.log(
                  '→ Show to user: phase=%s, step=%s, type=%s, msg=%s',
                  phaseRef.current,
                  step.id,
                  step.type,
                  (step.message ?? step.title ?? '(none)').slice(0, 80),
               )
               setAutoAnswering(false)
               setCurrentStep(step)
               setLoading(false)
               return
            }

            // ── 自动回答 ──
            const answer = resolveAutoAnswer(step, phaseRef.current)
            if (answer === undefined) {
               // 无法确定默认答案，回退展示给用户
               log.warn(
                  'Cannot auto-answer, falling back to user: step=%s, type=%s',
                  step.id,
                  step.type,
               )
               setAutoAnswering(false)
               setCurrentStep(step)
               setLoading(false)
               return
            }

            log.log(
               'Auto-answer: phase=%s, step=%s, type=%s, answer=%s',
               phaseRef.current,
               step.id,
               step.type,
               JSON.stringify(answer),
            )
            setAutoAnswering(true)
            autoCount++

            try {
               const result = await rpc<WizardNextResult>(RPC.WIZARD_NEXT, {
                  sessionId: sid,
                  answer: { stepId: step.id, value: answer },
               })

               if (handleDone(result)) return

               step = result.step
            } catch (err) {
               const msg = err instanceof Error ? err.message : String(err)
               log.error('Auto-answer RPC error: %s', msg)
               setError(msg)
               setAutoAnswering(false)
               setLoading(false)
               return
            }
         }

         // step 为 undefined — 不应发生，但安全处理
         setAutoAnswering(false)
         setLoading(false)
      },
      [rpc, handleDone],
   )

   const startWizard = useCallback(async () => {
      log.log('Starting wizard')
      setLoading(true)
      setError(null)
      setDone(false)
      setEndStatus(null)
      setEndError(null)
      setCurrentStep(null)
      setAutoAnswering(false)
      phaseRef.current = 'pre-auth'
      cancelledRef.current = false

      try {
         const result = await rpc<WizardStartResult>(RPC.WIZARD_START, { mode: 'local' })
         log.log(
            'wizard.start result: sessionId=%s, done=%s, status=%s',
            result.sessionId,
            result.done,
            result.status,
         )
         setSessionId(result.sessionId)
         sessionIdRef.current = result.sessionId

         if (handleDone(result)) {
            setLoading(false)
            return
         }

         // 进入自动回答循环
         await processStepLoop(result.sessionId, result.step)
      } catch (err) {
         const msg = err instanceof Error ? err.message : String(err)
         log.error('wizard.start error: %s', msg)
         setError(msg)
         setAutoAnswering(false)
         setLoading(false)
      }
   }, [rpc, handleDone, processStepLoop])

   const answerStep = useCallback(
      async (stepId: string, value: unknown) => {
         const sid = sessionIdRef.current
         if (!sid) return
         log.log('Answering step: stepId=%s, value=%s', stepId, JSON.stringify(value))
         setLoading(true)
         setError(null)
         setCurrentStep(null)
         try {
            const result = await rpc<WizardNextResult>(RPC.WIZARD_NEXT, {
               sessionId: sid,
               answer: { stepId, value },
            })
            log.log(
               'wizard.next result: done=%s, status=%s, nextStep=%s',
               result.done,
               result.status,
               result.step ? `${result.step.type}:${result.step.id}` : '(none)',
            )

            if (handleDone(result)) {
               setLoading(false)
               return
            }

            // 用户回答后的下一步可能需要自动回答
            await processStepLoop(sid, result.step)
         } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            log.error('wizard.next error: %s', msg)
            setError(msg)
            setLoading(false)
         }
      },
      [rpc, handleDone, processStepLoop],
   )

   const cancelWizard = useCallback(async () => {
      const sid = sessionIdRef.current
      if (!sid) return
      log.log('Cancelling wizard: sessionId=%s', sid)
      cancelledRef.current = true
      try {
         await rpc(RPC.WIZARD_CANCEL, { sessionId: sid })
      } catch (err) {
         log.error('wizard.cancel error:', err)
      }
      setDone(true)
      setEndStatus('cancelled')
      setCurrentStep(null)
      setAutoAnswering(false)
   }, [rpc])

   return {
      sessionId,
      currentStep,
      done,
      endStatus,
      endError,
      loading,
      error,
      autoAnswering,
      startWizard,
      answerStep,
      cancelWizard,
   }
}

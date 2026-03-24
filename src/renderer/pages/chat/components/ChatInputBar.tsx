import React, { useCallback, useMemo, useState } from 'react'
import { Upload } from 'antd'
import { ChatInput, Attachments } from '@agentscope-ai/chat'
import { IconButton, Select } from '@agentscope-ai/design'
import {
   SparkImageuploadLine,
   SparkAttachmentLine,
} from '@agentscope-ai/icons'
import type {
   GatewaySessionRow,
   SessionsPatchResult,
} from '../../../../shared/types/gateway-protocol'
import { RPC } from '../../../../shared/types/gateway-rpc'
import { useModels } from '../hooks/useModels'
import { useThinkingLevel } from '../hooks/useThinkingLevel'
import { useAttachments } from '../hooks/useAttachments'
import { useSpeechInput } from '../hooks/useSpeechInput'
import ThinkingLevelButton from './ThinkingLevelButton'
import SlashCommandMenu, { useSlashCommandState } from './SlashCommandMenu'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('ChatInputBar')

interface ChatInputBarProps {
   value: string
   onChange: (value: string) => void
   onSubmit: (message: string, attachments?: unknown[]) => void
   onCancel: () => void
   loading: boolean
   disabled: boolean
   sessionKey: string
   sessionInfo: GatewaySessionRow | null
   connected: boolean
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>
   onSessionInfoRefresh: () => void
}

export default function ChatInputBar({
   value,
   onChange,
   onSubmit,
   onCancel,
   loading,
   disabled,
   sessionKey,
   sessionInfo,
   connected,
   rpc,
   onSessionInfoRefresh,
}: ChatInputBarProps) {
   // ── Hooks ──
   const { models } = useModels({ connected, rpc })
   const { level: thinkingLevel, setLevel: setThinkingLevel, loading: thinkingLoading } =
      useThinkingLevel({ sessionInfo, sessionKey, rpc, onSessionInfoRefresh })
   const {
      attachments,
      handleFileChange,
      handlePasteFile,
      clearAttachments,
      toProtocolAttachments,
   } = useAttachments()

   const { speechConfig } = useSpeechInput({
      onTranscript: (text) => onChange(value ? value + text : text),
   })

   // ── Slash command autocomplete ──
   const { isSlashMode, filteredCommands } = useSlashCommandState(value)
   const [activeCommandIndex, setActiveCommandIndex] = useState(0)

   // Reset active index when filtered list changes
   const prevFilteredLenRef = React.useRef(filteredCommands.length)
   if (prevFilteredLenRef.current !== filteredCommands.length) {
      prevFilteredLenRef.current = filteredCommands.length
      if (activeCommandIndex >= filteredCommands.length) {
         setActiveCommandIndex(0)
      }
   }

   const handleCommandSelect = useCallback(
      (command: string) => {
         onChange('')
         setActiveCommandIndex(0)
         onSubmit(command)
      },
      [onChange, onSubmit],
   )

   const handleCommandFill = useCallback(
      (command: string) => {
         onChange(command + ' ')
         setActiveCommandIndex(0)
      },
      [onChange],
   )

   const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
         if (!isSlashMode || filteredCommands.length === 0) return

         if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveCommandIndex((prev) =>
               prev <= 0 ? filteredCommands.length - 1 : prev - 1,
            )
         } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveCommandIndex((prev) =>
               prev >= filteredCommands.length - 1 ? 0 : prev + 1,
            )
         } else if (e.key === 'Enter') {
            e.preventDefault()
            const selected = filteredCommands[activeCommandIndex]
            if (selected) {
               handleCommandSelect(selected.command)
            }
         } else if (e.key === 'Tab') {
            e.preventDefault()
            const selected = filteredCommands[activeCommandIndex]
            if (selected) {
               handleCommandFill(selected.command)
            }
         } else if (e.key === 'Escape') {
            e.preventDefault()
            onChange('')
         }
      },
      [isSlashMode, filteredCommands, activeCommandIndex, handleCommandSelect, handleCommandFill, onChange],
   )

   // ── Model selection ──
   // currentModel 需要转换为 provider/id 格式以匹配 select 的 value
   const currentModel = useMemo(() => {
      if (!sessionInfo?.model) return ''
      const model = sessionInfo.model
      const provider = sessionInfo.modelProvider
      // 如果 model 已经包含 "/"（如 "moonshotai/kimi-k2.5"），直接返回
      if (model.includes('/')) return model
      // 否则拼接 provider
      return provider ? `${provider}/${model}` : model
   }, [sessionInfo?.model, sessionInfo?.modelProvider])

   // 构建模型选项时拼接 provider/id，参考 OpenClaw UI 的 buildChatModelOption()
   const modelOptions = useMemo(
      () =>
         models.map((m) => {
            // 拼接成 provider/id 格式，如 "openrouter/moonshotai/kimi-k2.5"
            const value = m.provider ? `${m.provider}/${m.id}` : m.id
            return { value, label: m.name }
         }),
      [models],
   )

   const handleModelChange = useCallback(
      async (modelId: string) => {
         log.log('Switching model: %s', modelId)
         try {
            const result = await rpc<SessionsPatchResult>(RPC.SESSIONS_PATCH, {
               key: sessionKey,
               model: modelId,
            })
            if (result?.resolved?.model) {
               log.log(
                  'Model resolved: model=%s, provider=%s',
                  result.resolved.model,
                  result.resolved.modelProvider,
               )
            }
            onSessionInfoRefresh()

            // 查找目标模型，判断是否支持 reasoning
            // modelId 格式为 "provider/id"，需要从 catalog 中匹配
            const target = models.find((m) => {
               const catalogValue = m.provider ? `${m.provider}/${m.id}` : m.id
               return catalogValue === modelId
            })
            if (target && target.reasoning === false && thinkingLevel !== 'off') {
               await setThinkingLevel('off')
            }
         } catch (err) {
            log.error('Failed to switch model:', err)
         }
      },
      [rpc, sessionKey, onSessionInfoRefresh, models, thinkingLevel, setThinkingLevel],
   )

   // ── Submit handler ──
   const handleSubmit = useCallback(
      (message: string) => {
         const protocolAttachments = toProtocolAttachments()
         const finalAttachments = protocolAttachments.length > 0 ? protocolAttachments : undefined
         log.log(
            'handleSubmit: message.length=%d, attachments=%d, firstAttachmentKeys=%s',
            message.length,
            protocolAttachments.length,
            protocolAttachments.length > 0
               ? Object.keys(protocolAttachments[0]).join(',')
               : 'none',
         )
         onSubmit(message, finalAttachments)
         clearAttachments()
      },
      [onSubmit, toProtocolAttachments, clearAttachments],
   )

   // ── Prefix buttons ──
   const prefixButtons = useMemo(() => {
      const modelSelectNode = connected && modelOptions.length > 0 ? (
         <span key="model-select" className="model-select-wrapper">
            <Select
               variant="borderless"
               size="small"
               options={modelOptions}
               value={currentModel || undefined}
               onChange={handleModelChange}
               placeholder="选择模型"
               popupMatchSelectWidth={false}
               popupClassName="model-select-popup"
               style={{ maxWidth: 260, fontSize: 12 }}
            />
         </span>
      ) : null

      const imageUploadNode = (
         <Upload
            accept="image/*"
            beforeUpload={(file) => {
               handlePasteFile(file)
               return false
            }}
            showUploadList={false}
            fileList={[]}
            multiple
            disabled={disabled}
            key="image-upload"
         >
            <IconButton
               icon={<SparkImageuploadLine />}
               bordered={false}
               disabled={disabled}
            />
         </Upload>
      )

      const fileUploadNode = (
         <Upload
            accept="image/*"
            beforeUpload={(file) => {
               handlePasteFile(file)
               return false
            }}
            showUploadList={false}
            fileList={[]}
            multiple
            disabled={disabled}
            key="file-upload"
         >
            <IconButton
               icon={<SparkAttachmentLine />}
               bordered={false}
               disabled={disabled}
            />
         </Upload>
      )

      const thinkingNode = (
         <ThinkingLevelButton
            key="thinking"
            level={thinkingLevel}
            onLevelChange={setThinkingLevel}
            disabled={disabled}
            loading={thinkingLoading}
         />
      )

      return [imageUploadNode, fileUploadNode, thinkingNode, modelSelectNode].filter(Boolean)
   }, [
      disabled,
      thinkingLevel,
      setThinkingLevel,
      thinkingLoading,
      handleFileChange,
      connected,
      modelOptions,
      currentModel,
      handleModelChange,
   ])

   // ── Header (attachment preview) ──
   const senderHeader = useMemo(
      () => (
         <ChatInput.Header
            closable={false}
            open={attachments.length > 0}
         >
            <Attachments
               items={attachments}
               onChange={handleFileChange}
            />
         </ChatInput.Header>
      ),
      [attachments, handleFileChange],
   )

   return (
      <div
         className="chat-input-bar-wrapper"
         style={{ padding: '12px 24px', position: 'relative' }}
      >
         <style>{`
            .chat-input-bar-wrapper > [class*="sender"],
            .chat-input-bar-wrapper > [class*="sender"]:focus-within {
               border-color: #4a6741 !important;
            }
            /* 模型选择下拉菜单字体 */
            .model-select-popup .ant-select-item {
               font-size: 12px !important;
            }
            /* 内容区 padding 增大，给输入框和按钮更多呼吸空间 */
            .chat-input-bar-wrapper [class*="sender-content"] {
               padding: 12px !important;
            }
            /* 输入框文字：13px，与截图一致 */
            .chat-input-bar-wrapper [class*="sender-input"] {
               margin: 2px 0 !important;
               padding: 4px 8px !important;
               min-height: 24px !important;
               font-size: 13px !important;
               line-height: 20px !important;
            }
            /* 底部工具栏间距 */
            .chat-input-bar-wrapper [class*="sender-content-bottom"] {
               margin-top: 8px !important;
            }
            /* prefix 区域：flex 居中对齐 + 撑满宽度 */
            .chat-input-bar-wrapper [class*="sender-prefix"] {
               display: flex !important;
               align-items: center !important;
               flex: 1 !important;
            }
            /* 内层 ant-flex 撑满宽度，使 margin-left:auto 生效 */
            .chat-input-bar-wrapper [class*="sender-prefix"] > .ant-flex {
               width: 100% !important;
               align-items: center !important;
            }
            /* Upload 包装层 inline-flex 居中，避免撑开行高 */
            .chat-input-bar-wrapper [class*="sender-prefix"] .ant-upload-wrapper,
            .chat-input-bar-wrapper [class*="sender-prefix"] .ant-upload {
               display: inline-flex !important;
               align-items: center !important;
            }
            /* 模型选择器对齐：与按钮同高居中 */
            .chat-input-bar-wrapper [class*="sender-prefix"] .ant-select {
               height: 28px !important;
               line-height: 28px !important;
            }
            .chat-input-bar-wrapper [class*="sender-prefix"] .ant-select .ant-select-selector {
               height: 28px !important;
               padding-top: 0 !important;
               padding-bottom: 0 !important;
               align-items: center !important;
            }
            /* 模型选择器靠右 */
            .chat-input-bar-wrapper .model-select-wrapper {
               margin-left: auto !important;
               display: inline-flex !important;
               align-items: center !important;
            }
            /* prefix 区域内纯 icon 按钮统一 28px，排除思考级别按钮 */
            .chat-input-bar-wrapper [class*="sender-prefix"] .ant-btn:not(.thinking-level-btn) {
               width: 28px !important;
               height: 28px !important;
               min-width: 28px !important;
               padding: 0 !important;
               font-size: 14px !important;
            }
            /* 思考级别按钮：自适应宽度，不被固定尺寸约束 */
            .chat-input-bar-wrapper [class*="sender-prefix"] .thinking-level-btn {
               width: auto !important;
               min-width: auto !important;
            }
            /* 发送按钮: 32px 圆形绿色 */
            .chat-input-bar-wrapper [class*="actions-list"] .ant-btn-primary,
            .chat-input-bar-wrapper [class*="actions-list"] [class*="btn-primary"] {
               width: 32px !important;
               height: 32px !important;
               min-width: 32px !important;
               border-radius: 50% !important;
               padding: 0 !important;
               font-size: 16px !important;
               background-color: #4a9e4a !important;
               border-color: #4a9e4a !important;
               color: #fff !important;
            }
            .chat-input-bar-wrapper [class*="actions-list"] .ant-btn-primary:hover,
            .chat-input-bar-wrapper [class*="actions-list"] [class*="btn-primary"]:hover {
               background-color: #5ab05a !important;
               border-color: #5ab05a !important;
            }
            .chat-input-bar-wrapper [class*="actions-list"] .ant-btn-primary:disabled,
            .chat-input-bar-wrapper [class*="actions-list"] [class*="btn-primary"]:disabled {
               background-color: rgba(74, 158, 74, 0.4) !important;
               border-color: transparent !important;
               color: rgba(255, 255, 255, 0.6) !important;
            }
         `}</style>
         {isSlashMode && (
            <SlashCommandMenu
               activeIndex={activeCommandIndex}
               onSelect={handleCommandSelect}
               filteredCommands={filteredCommands}
            />
         )}
         <ChatInput
            value={value}
            onChange={onChange}
            onSubmit={handleSubmit}
            onCancel={onCancel}
            onKeyDown={handleKeyDown}
            submitType={isSlashMode ? false : 'enter'}
            loading={loading}
            disabled={disabled}
            placeholder={disabled ? '请先连接 Gateway' : '输入消息... (/ 开头为命令)'}
            // @ts-expect-error allowSpeech 运行时支持 ControlledSpeechConfig，但 .d.ts 类型为 boolean
            allowSpeech={speechConfig}
            initialRows={1}
            onPasteFile={handlePasteFile}
            prefix={prefixButtons}
            header={senderHeader}
            styles={{ prefix: { flex: 1 } }}
         />
      </div>
   )
}

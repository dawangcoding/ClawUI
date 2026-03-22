// ── 从 content blocks 中提取并配对工具调用与结果 ──
// Gateway 历史消息中，工具调用块的 type 取决于 API 提供商：
//   - Anthropic: tool_use / tool_result
//   - OpenAI:    toolCall / toolResult（也可能 functionCall）
// 需要兼容所有格式。参考 openclaw/ui tool-cards.ts

import type { ToolCallItem } from '../types'

/** 将工具结果内容转换为可展示文本 */
export function formatToolResultContent(content: unknown): string {
   if (typeof content === 'string') return content
   if (Array.isArray(content)) {
      const texts: string[] = []
      for (const item of content) {
         if (typeof item === 'object' && item !== null) {
            const block = item as Record<string, unknown>
            // 兼容 { type: 'text', text: '...' } 格式
            if (
               'type' in block &&
               typeof block.type === 'string' &&
               block.type.toLowerCase() === 'text' &&
               'text' in block &&
               typeof block.text === 'string'
            ) {
               texts.push(block.text)
            }
            // 兼容 { type: 'image', mimeType: '...', bytes: ... } 格式
            else if (
               'type' in block &&
               typeof block.type === 'string' &&
               block.type.toLowerCase() === 'image'
            ) {
               const mime = (block.mimeType as string) ?? 'image'
               const size = typeof block.bytes === 'number' ? ` ${Math.round(block.bytes / 1024)}kb` : ''
               const omitted = block.omitted ? ' (omitted)' : ''
               texts.push(`[${mime}${size}${omitted}]`)
            }
         }
      }
      if (texts.length > 0) return texts.join('\n')
   }
   if (content === undefined || content === null) return ''
   try {
      return JSON.stringify(content, null, 2)
   } catch {
      return String(content)
   }
}

/** 安全序列化 JSON，失败时回退到 String() */
function safeStringify(value: unknown): string {
   if (value === undefined || value === null) return ''
   if (typeof value === 'string') return value
   try {
      return JSON.stringify(value, null, 2)
   } catch {
      return String(value)
   }
}

/** 判断一个 content block 是否为工具调用 */
function isToolCallBlock(block: Record<string, unknown>): boolean {
   const kind = (typeof block.type === 'string' ? block.type : '').toLowerCase()
   return (
      ['toolcall', 'tool_call', 'tooluse', 'tool_use', 'functioncall', 'function_call'].includes(
         kind,
      ) || (typeof block.name === 'string' && (block.arguments != null || block.input != null))
   )
}

/** 判断一个 content block 是否为工具结果 */
function isToolResultBlock(block: Record<string, unknown>): boolean {
   const kind = (typeof block.type === 'string' ? block.type : '').toLowerCase()
   return ['toolresult', 'tool_result'].includes(kind)
}

/** 从 block 中提取工具调用 ID */
function getToolCallId(block: Record<string, unknown>): string {
   if (typeof block.id === 'string' && block.id) return block.id
   if (typeof block.toolCallId === 'string' && block.toolCallId) return block.toolCallId
   if (typeof block.tool_call_id === 'string' && block.tool_call_id) return block.tool_call_id
   return ''
}

/** 从工具结果 block 中提取其关联的工具调用 ID */
function getToolResultCallId(block: Record<string, unknown>): string {
   if (typeof block.tool_use_id === 'string' && block.tool_use_id) return block.tool_use_id
   if (typeof block.toolCallId === 'string' && block.toolCallId) return block.toolCallId
   if (typeof block.tool_call_id === 'string' && block.tool_call_id) return block.tool_call_id
   if (typeof block.id === 'string' && block.id) return block.id
   return ''
}

/** 从 block 中提取工具参数（兼容 input / arguments） */
function getToolArgs(block: Record<string, unknown>): unknown {
   return block.input ?? block.arguments ?? block.args
}

/** 从工具结果 block 中提取文本内容 */
function getToolResultText(block: Record<string, unknown>): string | undefined {
   if (typeof block.text === 'string') return block.text
   if (typeof block.content === 'string') return block.content
   if (Array.isArray(block.content)) return formatToolResultContent(block.content)
   return undefined
}

/**
 * 从 content blocks 中提取工具调用并配对工具结果
 *
 * 兼容多种 block type 格式：
 *   工具调用: tool_use / toolCall / tool_call / functionCall / function_call
 *   工具结果: tool_result / toolResult / toolresult
 *
 * @param blocks - Gateway 返回的 content blocks（可能是字符串、数组、或 undefined）
 * @returns 配对后的工具调用列表
 */
export function extractToolCalls(
   blocks: unknown[] | string | undefined,
): ToolCallItem[] {
   if (!blocks || typeof blocks === 'string' || !Array.isArray(blocks)) {
      return []
   }

   // Pass 1: 收集工具结果，以 toolCallId 为 key 建索引
   const resultMap = new Map<string, { content: unknown; text?: string }>()
   for (const raw of blocks) {
      if (!raw || typeof raw !== 'object') continue
      const block = raw as Record<string, unknown>
      if (!isToolResultBlock(block)) continue
      const callId = getToolResultCallId(block)
      if (callId) {
         resultMap.set(callId, {
            content: block.content,
            text: getToolResultText(block),
         })
      }
   }

   // Pass 2: 收集工具调用并配对结果
   const items: ToolCallItem[] = []
   for (const raw of blocks) {
      if (!raw || typeof raw !== 'object') continue
      const block = raw as Record<string, unknown>
      if (!isToolCallBlock(block)) continue

      const id = getToolCallId(block)
      if (!id) continue

      const name = typeof block.name === 'string' ? block.name : 'tool'
      const args = getToolArgs(block)
      const matched = resultMap.get(id)

      items.push({
         id,
         name,
         input: args,
         inputText: safeStringify(args),
         result: matched?.content,
         resultText: matched?.text ?? (matched ? formatToolResultContent(matched.content) : undefined),
         status: matched ? 'completed' : 'pending',
      })
   }

   return items
}

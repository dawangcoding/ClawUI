import { useEffect, useRef, useCallback } from 'react'

export interface SlashCommandItem {
   command: string
   description: string
   category: string
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
   // 会话
   { command: '/new', description: '启动新会话', category: '会话' },
   { command: '/reset', description: '重置当前会话', category: '会话' },
   { command: '/compact', description: '压缩会话上下文', category: '会话' },
   { command: '/stop', description: '停止当前运行', category: '会话' },
   { command: '/clear', description: '清除聊天历史', category: '会话' },
   // 模型
   { command: '/model', description: '显示或设置模型', category: '模型' },
   { command: '/think', description: '设置思考级别', category: '模型' },
   { command: '/verbose', description: '切换冗长模式', category: '模型' },
   { command: '/fast', description: '切换快速模式', category: '模型' },
   // 工具
   { command: '/help', description: '显示可用命令', category: '工具' },
   { command: '/status', description: '显示会话状态', category: '工具' },
   { command: '/export', description: '导出会话为 Markdown', category: '工具' },
   { command: '/usage', description: '显示令牌用量', category: '工具' },
   // Agent
   { command: '/agents', description: '列出所有 Agent', category: 'Agent' },
   { command: '/kill', description: '中止子 Agent', category: 'Agent' },
   { command: '/skill', description: '运行 Skill', category: 'Agent' },
   { command: '/steer', description: '操纵子 Agent', category: 'Agent' },
]

interface SlashCommandMenuProps {
   activeIndex: number
   onSelect: (command: string) => void
   filteredCommands: SlashCommandItem[]
}

export function useSlashCommandState(inputValue: string) {
   // Only show when input starts with "/" and has no space (still typing the command itself)
   const isSlashMode = inputValue.startsWith('/') && !inputValue.includes(' ')
   const query = isSlashMode ? inputValue.toLowerCase() : ''

   const filteredCommands = isSlashMode
      ? SLASH_COMMANDS.filter((c) => c.command.startsWith(query))
      : []

   return { isSlashMode: isSlashMode && filteredCommands.length > 0, filteredCommands, query }
}

export default function SlashCommandMenu({
   activeIndex,
   onSelect,
   filteredCommands,
}: SlashCommandMenuProps) {
   const listRef = useRef<HTMLDivElement>(null)
   const itemRefs = useRef<(HTMLDivElement | null)[]>([])

   // Scroll active item into view
   useEffect(() => {
      const activeEl = itemRefs.current[activeIndex]
      if (activeEl && listRef.current) {
         activeEl.scrollIntoView({ block: 'nearest' })
      }
   }, [activeIndex])

   const handleClick = useCallback(
      (command: string) => {
         onSelect(command)
      },
      [onSelect],
   )

   if (filteredCommands.length === 0) return null

   const isDark = true

   // Group by category
   const grouped = new Map<string, SlashCommandItem[]>()
   for (const cmd of filteredCommands) {
      const list = grouped.get(cmd.category) ?? []
      list.push(cmd)
      grouped.set(cmd.category, list)
   }

   let globalIndex = 0

   return (
      <div
         style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 4,
            background: isDark ? '#1f1f1f' : '#fff',
            border: `1px solid ${isDark ? '#3a3a3a' : '#e0e0e0'}`,
            borderRadius: 8,
            boxShadow: isDark
               ? '0 -4px 16px rgba(0,0,0,0.4)'
               : '0 -4px 16px rgba(0,0,0,0.1)',
            maxHeight: 320,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
         }}
      >
         <div
            ref={listRef}
            style={{
               overflowY: 'auto',
               padding: '4px 0',
            }}
         >
            {Array.from(grouped.entries()).map(([category, commands]) => (
               <div key={category}>
                  <div
                     style={{
                        padding: '6px 12px 2px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: isDark ? '#888' : '#999',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                     }}
                  >
                     {category}
                  </div>
                  {commands.map((cmd) => {
                     const idx = globalIndex++
                     const isActive = idx === activeIndex
                     return (
                        <div
                           key={cmd.command}
                           ref={(el) => {
                              itemRefs.current[idx] = el
                           }}
                           onMouseDown={(e) => {
                              e.preventDefault()
                              handleClick(cmd.command)
                           }}
                           style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 12px',
                              cursor: 'pointer',
                              background: isActive
                                 ? isDark
                                    ? '#2a3a2a'
                                    : '#e8f5e9'
                                 : 'transparent',
                              transition: 'background 0.1s',
                           }}
                           onMouseEnter={(e) => {
                              if (!isActive) {
                                 e.currentTarget.style.background = isDark
                                    ? '#2a2a2a'
                                    : '#f5f5f5'
                              }
                           }}
                           onMouseLeave={(e) => {
                              if (!isActive) {
                                 e.currentTarget.style.background = 'transparent'
                              }
                           }}
                        >
                           <span
                              style={{
                                 fontFamily: 'monospace',
                                 fontSize: 13,
                                 fontWeight: 500,
                                 color: isDark ? '#7ec87e' : '#2e7d32',
                                 minWidth: 80,
                              }}
                           >
                              {cmd.command}
                           </span>
                           <span
                              style={{
                                 fontSize: 12,
                                 color: isDark ? '#aaa' : '#666',
                              }}
                           >
                              {cmd.description}
                           </span>
                        </div>
                     )
                  })}
               </div>
            ))}
         </div>
      </div>
   )
}

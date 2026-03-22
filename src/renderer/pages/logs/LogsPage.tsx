import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Typography, Checkbox, Space } from 'antd'
import { Button, Input, Alert } from '@agentscope-ai/design'
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { RPC } from '../../../shared/types/gateway-rpc'
import type { LogEntry, LogLevel } from '../../../shared/types/gateway-protocol'
import { parseLogLine } from './parse-log-line'
import EmptyState from '../../components/EmptyState'
import styles from './LogsPage.module.css'

const { Title, Text } = Typography

const LOG_LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
const LOG_BUFFER_LIMIT = 2000

const LEVEL_STYLE_MAP: Record<LogLevel, string> = {
   trace: styles.levelTrace,
   debug: styles.levelDebug,
   info: styles.levelInfo,
   warn: styles.levelWarn,
   error: styles.levelError,
   fatal: styles.levelFatal,
}

const LOG_LEVEL_STYLE_MAP: Record<string, string> = {
   trace: styles.logLevelTrace,
   debug: styles.logLevelDebug,
   info: styles.logLevelInfo,
   warn: styles.logLevelWarn,
   error: styles.logLevelError,
   fatal: styles.logLevelFatal,
}

const DEFAULT_LEVEL_FILTERS: Record<LogLevel, boolean> = {
   trace: false,
   debug: false,
   info: false,
   warn: true,
   error: true,
   fatal: true,
}

function formatTime(value?: string | null): string {
   if (!value) return ''
   const date = new Date(value)
   if (Number.isNaN(date.getTime())) return value
   return date.toLocaleTimeString()
}

function matchesFilter(entry: LogEntry, needle: string): boolean {
   if (!needle) return true
   const haystack = [entry.message, entry.subsystem, entry.raw].filter(Boolean).join(' ').toLowerCase()
   return haystack.includes(needle)
}

function exportLogs(lines: string[], label: string): void {
   if (lines.length === 0) return
   const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/plain' })
   const url = URL.createObjectURL(blob)
   const anchor = document.createElement('a')
   const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
   anchor.href = url
   anchor.download = `clawui-logs-${label}-${stamp}.log`
   anchor.click()
   URL.revokeObjectURL(url)
}

export default function LogsPage() {
   const { rpc, connected } = useGateway()
   const [entries, setEntries] = useState<LogEntry[]>([])
   const [cursor, setCursor] = useState<number | null>(null)
   const [file, setFile] = useState<string | null>(null)
   const [truncated, setTruncated] = useState(false)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [filterText, setFilterText] = useState('')
   const [levelFilters, setLevelFilters] = useState<Record<LogLevel, boolean>>(
      () => ({ ...DEFAULT_LEVEL_FILTERS }),
   )
   const [autoFollow, setAutoFollow] = useState(true)
   const containerRef = useRef<HTMLDivElement>(null)
   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
   const cursorRef = useRef<number | null>(null)

   // 同步 cursor 到 ref，避免 loadLogs 的 useCallback 依赖 cursor 状态
   cursorRef.current = cursor

   const loadLogs = useCallback(
      async (reset = false) => {
         if (!connected) return
         setLoading(true)
         setError(null)
         try {
            const result = await rpc<{
               cursor?: number
               lines?: unknown[]
               truncated?: boolean
               file?: string
               reset?: boolean
               size?: number
            }>(RPC.LOGS_TAIL, {
               cursor: reset ? undefined : (cursorRef.current ?? undefined),
               limit: 200,
               maxBytes: 512000,
            })

            if (result?.cursor !== undefined) {
               setCursor(result.cursor)
            }
            if (typeof result?.file === 'string') {
               setFile(result.file)
            }
            setTruncated(Boolean(result?.truncated))

            if (result?.lines && Array.isArray(result.lines)) {
               const lines = result.lines.filter(
                  (line): line is string => typeof line === 'string',
               )
               const newEntries = lines.map(parseLogLine)
               const shouldReset = reset || result.reset || cursorRef.current == null

               if (shouldReset) {
                  setEntries(newEntries)
               } else {
                  setEntries((prev) => [...prev, ...newEntries].slice(-LOG_BUFFER_LIMIT))
               }
            }
         } catch (err) {
            console.error('[LogsPage] Load error:', err)
            setError(String(err))
         } finally {
            setLoading(false)
         }
      },
      [rpc, connected],
   )

   // 初始加载
   useEffect(() => {
      if (connected) {
         loadLogs(true)
      }
   }, [connected, loadLogs])

   // 轮询（2s 间隔）
   useEffect(() => {
      if (!connected) return
      pollRef.current = setInterval(() => {
         loadLogs(false)
      }, 2000)
      return () => {
         if (pollRef.current) clearInterval(pollRef.current)
      }
   }, [connected, loadLogs])

   // 自动跟随
   useEffect(() => {
      if (autoFollow && containerRef.current) {
         requestAnimationFrame(() => {
            if (containerRef.current) {
               containerRef.current.scrollTop = containerRef.current.scrollHeight
            }
         })
      }
   }, [entries, autoFollow])

   // 过滤逻辑
   const needle = filterText.trim().toLowerCase()
   const levelFiltered = LOG_LEVELS.some((l) => !levelFilters[l])

   const filteredEntries = useMemo(() => {
      return entries.filter((entry) => {
         if (entry.level && !levelFilters[entry.level]) return false
         return matchesFilter(entry, needle)
      })
   }, [entries, levelFilters, needle])

   const toggleLevel = useCallback((level: LogLevel) => {
      setLevelFilters((prev) => ({ ...prev, [level]: !prev[level] }))
   }, [])

   const handleExport = useCallback(() => {
      const label = needle || levelFiltered ? 'filtered' : 'visible'
      exportLogs(
         filteredEntries.map((e) => e.raw),
         label,
      )
   }, [filteredEntries, needle, levelFiltered])

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
         {/* 标题区 */}
         <div className={styles.pageHeader}>
            <div>
               <Title level={4} style={{ margin: 0 }}>
                  日志
               </Title>
               <div className={styles.subtitle}>Gateway 文件日志 (JSONL)</div>
            </div>
            <Space>
               <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={() => loadLogs(true)}
               >
                  刷新
               </Button>
               <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  disabled={filteredEntries.length === 0}
                  onClick={handleExport}
               >
                  导出{needle || levelFiltered ? '已过滤' : '可见'}
               </Button>
            </Space>
         </div>

         {/* 搜索 + 自动跟随 */}
         <div className={styles.filterRow}>
            <div className={styles.filterSearch}>
               <Input
                  placeholder="搜索日志"
                  allowClear
                  size="small"
                  value={filterText}
                  onChange={(e) => setFilterText(typeof e === 'string' ? e : e.target.value)}
               />
            </div>
            <Checkbox checked={autoFollow} onChange={(e) => setAutoFollow(e.target.checked)}>
               自动跟随
            </Checkbox>
         </div>

         {/* 级别芯片 */}
         <div className={styles.chipRow}>
            {LOG_LEVELS.map((level) => (
               <span
                  key={level}
                  className={`${styles.levelChip} ${LEVEL_STYLE_MAP[level]} ${
                     levelFilters[level] ? styles.levelChipActive : styles.levelChipInactive
                  }`}
                  onClick={() => toggleLevel(level)}
               >
                  <Checkbox
                     checked={levelFilters[level]}
                     style={{ pointerEvents: 'none' }}
                  />
                  <span>{level}</span>
               </span>
            ))}
         </div>

         {/* 文件路径 */}
         {file && <div className={styles.filePath}>文件: {file}</div>}

         {/* 截断提示 */}
         {truncated && (
            <div className={styles.truncationNotice}>
               日志输出已截断，显示最新部分。
            </div>
         )}

         {/* 错误提示 */}
         {error && (
            <Alert
               type="error"
               message={error}
               closable
               onClose={() => setError(null)}
               style={{ marginTop: 10 }}
            />
         )}

         {/* 日志流 */}
         <div ref={containerRef} className={styles.logStream}>
            {filteredEntries.length === 0 ? (
               <div className={styles.emptyStream}>暂无日志条目</div>
            ) : (
               filteredEntries.map((entry, i) => (
                  <div key={i} className={styles.logRow}>
                     <div className={styles.logTime}>{formatTime(entry.time)}</div>
                     <div
                        className={`${styles.logLevel} ${LOG_LEVEL_STYLE_MAP[entry.level ?? ''] ?? ''}`}
                     >
                        {entry.level ?? ''}
                     </div>
                     <div className={styles.logSubsystem} title={entry.subsystem ?? ''}>
                        {entry.subsystem ?? ''}
                     </div>
                     <div className={styles.logMessage}>{entry.message ?? entry.raw}</div>
                  </div>
               ))
            )}
         </div>
      </div>
   )
}

// ── 会话管理页面 ──

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
   Button,
   Input,
   Select,
   Checkbox,
   Dropdown,
   Modal,
   Alert,
   Spin,
   message,
} from 'antd'
import {
   ReloadOutlined,
   DeleteOutlined,
   MessageOutlined,
   MoreOutlined,
   SearchOutlined,
   DownOutlined,
   RightOutlined,
} from '@ant-design/icons'
import { useGateway } from '../../contexts/GatewayContext'
import { useNavigation } from '../../contexts/NavigationContext'
import { RPC } from '../../../shared/types/gateway-rpc'
import type {
   GatewaySessionRow,
   SessionsListResult,
   SessionsPatchResult,
} from '../../../shared/types/gateway-protocol'
import EmptyState from '../../components/EmptyState'
import styles from './SessionsPage.module.css'

// ── 工具函数 ──

function formatRelativeTime(ts: number | null | undefined): string {
   if (ts == null) return '\u2014'
   const now = Date.now()
   const diff = now - ts
   if (diff < 0) return '刚刚'
   const seconds = Math.floor(diff / 1000)
   if (seconds < 60) return '刚刚'
   const minutes = Math.floor(seconds / 60)
   if (minutes < 60) return `${minutes}m ago`
   const hours = Math.floor(minutes / 60)
   if (hours < 24) return `${hours}h ago`
   const days = Math.floor(hours / 24)
   return `${days}d ago`
}

function formatSessionTokens(row: GatewaySessionRow): string {
   if (row.totalTokens == null) return 'n/a'
   const total = row.totalTokens ?? 0
   const ctx = row.contextTokens ?? 0
   return ctx ? `${total.toLocaleString()} / ${ctx.toLocaleString()}` : total.toLocaleString()
}

function normalizeProvider(provider?: string | null): string {
   if (!provider) return ''
   const normalized = provider.trim().toLowerCase()
   if (normalized === 'z.ai' || normalized === 'z-ai') return 'zai'
   return normalized
}

function isBinaryThinkingProvider(provider?: string | null): boolean {
   return normalizeProvider(provider) === 'zai'
}

function kindClassName(kind: string | undefined): string {
   switch (kind) {
      case 'direct':
         return styles.kindDirect
      case 'group':
         return styles.kindGroup
      case 'global':
         return styles.kindGlobal
      default:
         return styles.kindUnknown
   }
}

// ── 下拉选项定义 ──

const THINKING_OPTIONS = [
   { value: '', label: 'inherit' },
   { value: 'off', label: 'off' },
   { value: 'minimal', label: 'minimal' },
   { value: 'low', label: 'low' },
   { value: 'medium', label: 'medium' },
   { value: 'high', label: 'high' },
   { value: 'xhigh', label: 'xhigh' },
]

const THINKING_OPTIONS_BINARY = [
   { value: '', label: 'inherit' },
   { value: 'off', label: 'off' },
   { value: 'on', label: 'on' },
]

const FAST_OPTIONS = [
   { value: '', label: 'inherit' },
   { value: 'on', label: 'on' },
   { value: 'off', label: 'off' },
]

const VERBOSE_OPTIONS = [
   { value: '', label: 'inherit' },
   { value: 'off', label: 'off' },
   { value: 'on', label: 'on' },
   { value: 'full', label: 'full' },
]

const REASONING_OPTIONS = [
   { value: '', label: 'inherit' },
   { value: 'off', label: 'off' },
   { value: 'on', label: 'on' },
   { value: 'stream', label: 'stream' },
]

// ── 客户端搜索 ──

function filterRows(rows: GatewaySessionRow[], query: string): GatewaySessionRow[] {
   const q = query.trim().toLowerCase()
   if (!q) return rows
   return rows.filter((row) => {
      const key = (row.key ?? '').toLowerCase()
      const label = (row.label ?? '').toLowerCase()
      const kind = (row.kind ?? '').toLowerCase()
      const displayName = (row.displayName ?? '').toLowerCase()
      return (
         key.includes(q) || label.includes(q) || kind.includes(q) || displayName.includes(q)
      )
   })
}

// ── 客户端排序 ──

type SortColumn = 'key' | 'kind' | 'updated' | 'tokens'
type SortDir = 'asc' | 'desc'

function sortRows(
   rows: GatewaySessionRow[],
   column: SortColumn,
   dir: SortDir,
): GatewaySessionRow[] {
   return [...rows].sort((a, b) => {
      let cmp = 0
      switch (column) {
         case 'key':
            cmp = (a.key ?? '').localeCompare(b.key ?? '')
            break
         case 'kind':
            cmp = (a.kind ?? '').localeCompare(b.kind ?? '')
            break
         case 'updated':
            cmp = (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
            break
         case 'tokens':
            cmp = (a.totalTokens ?? 0) - (b.totalTokens ?? 0)
            break
      }
      return dir === 'asc' ? cmp : -cmp
   })
}

// ── 分页选项 ──

const PAGE_SIZE_OPTIONS = [
   { value: 10, label: '10 / 页' },
   { value: 25, label: '25 / 页' },
   { value: 50, label: '50 / 页' },
   { value: 100, label: '100 / 页' },
]

// ── 主组件 ──

export default function SessionsPage() {
   const { rpc, connected } = useGateway()
   const { navigate } = useNavigation()

   // 数据
   const [sessions, setSessions] = useState<GatewaySessionRow[]>([])
   const [sessionsResult, setSessionsResult] = useState<SessionsListResult | null>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)

   // 筛选器
   const [filterActive, setFilterActive] = useState('')
   const [filterLimit, setFilterLimit] = useState('120')
   const [includeGlobal, setIncludeGlobal] = useState(true)
   const [includeUnknown, setIncludeUnknown] = useState(false)

   // 搜索
   const [searchQuery, setSearchQuery] = useState('')

   // 排序
   const [sortColumn, setSortColumn] = useState<SortColumn>('updated')
   const [sortDir, setSortDir] = useState<SortDir>('desc')

   // 分页
   const [page, setPage] = useState(0)
   const [pageSize, setPageSize] = useState(10)

   // 展开行
   const [expandedKey, setExpandedKey] = useState<string | null>(null)

   // ── 加载数据 ──

   const loadSessions = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      setError(null)
      try {
         const activeMin = parseInt(filterActive, 10)
         const limit = parseInt(filterLimit, 10)
         const result = await rpc<SessionsListResult>(RPC.SESSIONS_LIST, {
            includeGlobal,
            includeUnknown,
            ...(activeMin > 0 ? { activeMinutes: activeMin } : {}),
            ...(limit > 0 ? { limit } : {}),
         })
         setSessionsResult(result)
         setSessions(result?.sessions ?? [])
      } catch (err) {
         console.error('[SessionsPage] Load error:', err)
         setError(err instanceof Error ? err.message : String(err))
      } finally {
         setLoading(false)
      }
   }, [rpc, connected, filterActive, filterLimit, includeGlobal, includeUnknown])

   useEffect(() => {
      loadSessions()
   }, [loadSessions])

   // ── 操作 ──

   const handleDelete = useCallback(
      async (key: string) => {
         try {
            await rpc(RPC.SESSIONS_DELETE, { key, deleteTranscript: true })
            message.success('会话已删除')
            loadSessions()
         } catch (err) {
            message.error(`删除失败: ${err instanceof Error ? err.message : String(err)}`)
         }
      },
      [rpc, loadSessions],
   )

   const handlePatch = useCallback(
      async (key: string, fields: Record<string, unknown>) => {
         try {
            await rpc<SessionsPatchResult>(RPC.SESSIONS_PATCH, { key, ...fields })
            loadSessions()
         } catch (err) {
            message.error(`修改失败: ${err instanceof Error ? err.message : String(err)}`)
         }
      },
      [rpc, loadSessions],
   )

   const handleOpenInChat = useCallback(
      (sessionKey: string) => {
         navigate('chat', { sessionKey })
      },
      [navigate],
   )

   // ── 数据处理管道：搜索 → 排序 ──

   const processedSessions = useMemo(() => {
      let rows = sessions
      rows = filterRows(rows, searchQuery)
      rows = sortRows(rows, sortColumn, sortDir)
      return rows
   }, [sessions, searchQuery, sortColumn, sortDir])

   // ── 分页计算 ──

   const totalRows = processedSessions.length
   const totalPages = Math.ceil(totalRows / pageSize)
   const pagedSessions = useMemo(() => {
      const start = page * pageSize
      return processedSessions.slice(start, start + pageSize)
   }, [processedSessions, page, pageSize])

   const rangeStart = totalRows === 0 ? 0 : page * pageSize + 1
   const rangeEnd = Math.min((page + 1) * pageSize, totalRows)

   // ── 排序点击处理 ──

   const handleSortClick = useCallback(
      (col: SortColumn) => {
         if (sortColumn === col) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
         } else {
            setSortColumn(col)
            setSortDir('desc')
         }
         setPage(0)
      },
      [sortColumn],
   )

   // ── 展开行切换 ──

   const toggleExpand = useCallback((key: string) => {
      setExpandedKey((prev) => (prev === key ? null : key))
   }, [])

   // ── 未连接状态 ──

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   // ── Store 路径显示 ──

   const storePath = (sessionsResult as Record<string, unknown> | null)?.path
   const storeDisplay =
      typeof storePath === 'string' ? storePath : sessionsResult ? '(multiple)' : null

   // ── 渲染辅助 ──

   function renderSortableHeader(label: string, col: SortColumn) {
      const isActive = sortColumn === col
      const arrow = isActive ? (sortDir === 'asc' ? '\u2191' : '\u2193') : '\u2195'
      return (
         <span className={styles.sortableHeader} onClick={() => handleSortClick(col)}>
            {label}
            <span className={isActive ? styles.sortArrowActive : styles.sortArrow}>{arrow}</span>
         </span>
      )
   }

   function renderExpandedPanel(row: GatewaySessionRow) {
      const isBinary = isBinaryThinkingProvider(row.modelProvider ?? row.provider)
      const thinkingOpts = isBinary ? THINKING_OPTIONS_BINARY : THINKING_OPTIONS
      const currentThinking = row.thinkingLevel ?? ''
      const hasThinkingOption = thinkingOpts.some((o) => o.value === currentThinking)
      const displayThinkingOpts =
         hasThinkingOption || !currentThinking
            ? thinkingOpts
            : [...thinkingOpts, { value: currentThinking, label: currentThinking }]

      const currentFast = row.fastMode === true ? 'on' : row.fastMode === false ? 'off' : ''
      const currentVerbose = row.verboseLevel ?? ''
      const currentReasoning = row.reasoningLevel ?? ''

      return (
         <div className={styles.expandedPanel}>
            <div className={styles.paramItem}>
               <span className={styles.paramLabel}>Thinking</span>
               <div className={styles.paramSelect}>
                  <Select
                     size="small"
                     value={currentThinking}
                     options={displayThinkingOpts}
                     disabled={loading}
                     onChange={(val) => handlePatch(row.key, { thinkingLevel: val || null })}
                     style={{ width: '100%' }}
                  />
               </div>
            </div>
            <div className={styles.paramItem}>
               <span className={styles.paramLabel}>Fast</span>
               <div className={styles.paramSelect}>
                  <Select
                     size="small"
                     value={currentFast}
                     options={FAST_OPTIONS}
                     disabled={loading}
                     onChange={(val) => {
                        const fastMode = val === 'on' ? true : val === 'off' ? false : null
                        handlePatch(row.key, { fastMode })
                     }}
                     style={{ width: '100%' }}
                  />
               </div>
            </div>
            <div className={styles.paramItem}>
               <span className={styles.paramLabel}>Verbose</span>
               <div className={styles.paramSelect}>
                  <Select
                     size="small"
                     value={currentVerbose}
                     options={VERBOSE_OPTIONS}
                     disabled={loading}
                     onChange={(val) => handlePatch(row.key, { verboseLevel: val || null })}
                     style={{ width: '100%' }}
                  />
               </div>
            </div>
            <div className={styles.paramItem}>
               <span className={styles.paramLabel}>Reasoning</span>
               <div className={styles.paramSelect}>
                  <Select
                     size="small"
                     value={currentReasoning}
                     options={REASONING_OPTIONS}
                     disabled={loading}
                     onChange={(val) => handlePatch(row.key, { reasoningLevel: val || null })}
                     style={{ width: '100%' }}
                  />
               </div>
            </div>
         </div>
      )
   }

   function renderRow(row: GatewaySessionRow) {
      const isExpanded = expandedKey === row.key
      const canOpenInChat = row.kind !== 'global'
      const showDisplayName =
         row.displayName && row.displayName !== row.key && row.displayName !== row.label

      const menuItems = [
         ...(canOpenInChat
            ? [
                 {
                    key: 'open-chat',
                    icon: <MessageOutlined />,
                    label: '在对话中打开',
                    onClick: () => handleOpenInChat(row.key),
                 },
              ]
            : []),
         {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
            danger: true,
            onClick: () => {
               Modal.confirm({
                  title: '删除会话',
                  content: `确认删除会话 "${row.key}" 吗？\n\n将同时删除会话记录和转录。`,
                  okText: '删除',
                  okType: 'danger',
                  cancelText: '取消',
                  onOk: () => handleDelete(row.key),
               })
            },
         },
      ]

      return (
         <React.Fragment key={row.key}>
            <div
               className={isExpanded ? styles.listRowExpanded : styles.listRow}
               onClick={() => toggleExpand(row.key)}
            >
               {/* Key */}
               <div className={styles.keyCell}>
                  <span className={styles.keyText}>
                     {isExpanded ? (
                        <DownOutlined style={{ fontSize: 9, marginRight: 6, opacity: 0.5 }} />
                     ) : (
                        <RightOutlined style={{ fontSize: 9, marginRight: 6, opacity: 0.3 }} />
                     )}
                     {row.key}
                  </span>
                  {showDisplayName && <div className={styles.displayName}>{row.displayName}</div>}
               </div>

               {/* Label */}
               <div
                  className={`${styles.labelInput} ${styles.labelCol}`}
                  onClick={(e) => e.stopPropagation()}
               >
                  <Input
                     size="small"
                     placeholder="(optional)"
                     defaultValue={row.label ?? ''}
                     disabled={loading}
                     onBlur={(e) => {
                        const val = e.target.value.trim()
                        const newLabel = val || null
                        if (newLabel !== (row.label ?? null)) {
                           handlePatch(row.key, { label: newLabel })
                        }
                     }}
                     onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
                  />
               </div>

               {/* Kind */}
               <div>
                  <span className={kindClassName(row.kind)}>{row.kind ?? 'direct'}</span>
               </div>

               {/* Updated */}
               <div className={styles.timeText}>{formatRelativeTime(row.updatedAt)}</div>

               {/* Tokens */}
               <div className={`${styles.tokenText} ${styles.tokenCol}`}>
                  {formatSessionTokens(row)}
               </div>

               {/* Actions */}
               <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                     menu={{ items: menuItems }}
                     trigger={['click']}
                     placement="bottomRight"
                  >
                     <Button type="text" size="small" icon={<MoreOutlined />} />
                  </Dropdown>
               </div>
            </div>

            {/* 展开面板 */}
            {isExpanded && renderExpandedPanel(row)}
         </React.Fragment>
      )
   }

   // ── 渲染 ──

   return (
      <div className={styles.pageContainer}>
         {/* 页面头部 */}
         <div className={styles.pageHeader}>
            <div>
               <h4 className={styles.pageTitle}>会话</h4>
               <div className={styles.subtitle}>活动会话和默认设置。</div>
            </div>
            <Button
               icon={<ReloadOutlined />}
               onClick={loadSessions}
               loading={loading}
               size="small"
            >
               刷新
            </Button>
         </div>

         {/* 工具栏：筛选 + 搜索 */}
         <div className={styles.toolbar}>
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>Active</span>
               <input
                  className={styles.filterInput}
                  placeholder="min"
                  value={filterActive}
                  onChange={(e) => {
                     setFilterActive(e.target.value)
                     setPage(0)
                  }}
               />
            </div>
            <div className={styles.filterGroup}>
               <span className={styles.filterLabel}>Limit</span>
               <input
                  className={styles.filterInput}
                  value={filterLimit}
                  onChange={(e) => {
                     setFilterLimit(e.target.value)
                     setPage(0)
                  }}
               />
            </div>
            <Checkbox
               className={styles.filterCheckbox}
               checked={includeGlobal}
               onChange={(e) => {
                  setIncludeGlobal(e.target.checked)
                  setPage(0)
               }}
            >
               Global
            </Checkbox>
            <Checkbox
               className={styles.filterCheckbox}
               checked={includeUnknown}
               onChange={(e) => {
                  setIncludeUnknown(e.target.checked)
                  setPage(0)
               }}
            >
               Unknown
            </Checkbox>
            <Input
               className={styles.searchInput}
               placeholder="搜索 key、label、kind..."
               prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary)' }} />}
               value={searchQuery}
               onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(0)
               }}
               allowClear
               size="small"
            />
         </div>

         {/* 摘要条 */}
         {sessionsResult && (
            <div className={styles.summaryBar}>
               <span className={styles.summaryDot} />
               <span>
                  {totalRows} 个会话
                  {searchQuery && ` (已过滤)`}
               </span>
               {storeDisplay && (
                  <>
                     <span className={styles.summarySep}>|</span>
                     <span>Store: {storeDisplay}</span>
                  </>
               )}
            </div>
         )}

         {/* 错误提示 */}
         {error && (
            <Alert
               className={styles.errorBanner}
               type="error"
               message={error}
               closable
               onClose={() => setError(null)}
            />
         )}

         {/* 列表 */}
         <div className={styles.listContainer}>
            {/* 列头 */}
            <div className={styles.listHeader}>
               <span>{renderSortableHeader('Key', 'key')}</span>
               <span className={styles.labelCol}>Label</span>
               <span>{renderSortableHeader('Kind', 'kind')}</span>
               <span>{renderSortableHeader('Updated', 'updated')}</span>
               <span className={styles.tokenCol}>{renderSortableHeader('Tokens', 'tokens')}</span>
               <span />
            </div>

            {/* 内容区 */}
            {loading && sessions.length === 0 ? (
               <div className={styles.loadingOverlay}>
                  <Spin />
               </div>
            ) : pagedSessions.length === 0 ? (
               <div className={styles.emptyList}>
                  {searchQuery ? '没有匹配的会话' : '暂无会话数据'}
               </div>
            ) : (
               pagedSessions.map((row) => renderRow(row))
            )}

            {/* 分页 */}
            {totalRows > 0 && (
               <div className={styles.pagination}>
                  <span className={styles.paginationInfo}>
                     {rangeStart}-{rangeEnd} / {totalRows}
                  </span>
                  <div className={styles.paginationControls}>
                     <button
                        className={styles.pageButton}
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                     >
                        &lt;
                     </button>
                     {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageIdx: number
                        if (totalPages <= 5) {
                           pageIdx = i
                        } else if (page <= 2) {
                           pageIdx = i
                        } else if (page >= totalPages - 3) {
                           pageIdx = totalPages - 5 + i
                        } else {
                           pageIdx = page - 2 + i
                        }
                        return (
                           <button
                              key={pageIdx}
                              className={
                                 pageIdx === page ? styles.pageButtonActive : styles.pageButton
                              }
                              onClick={() => setPage(pageIdx)}
                           >
                              {pageIdx + 1}
                           </button>
                        )
                     })}
                     <button
                        className={styles.pageButton}
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                     >
                        &gt;
                     </button>
                     <Select
                        className={styles.pageSizeSelect}
                        size="small"
                        value={pageSize}
                        options={PAGE_SIZE_OPTIONS}
                        onChange={(val) => {
                           setPageSize(val)
                           setPage(0)
                        }}
                        variant="borderless"
                     />
                  </div>
               </div>
            )}
         </div>
      </div>
   )
}

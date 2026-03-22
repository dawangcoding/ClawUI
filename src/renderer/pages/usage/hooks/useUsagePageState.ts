import { useReducer, useCallback, useEffect, useMemo, useRef } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import { createLogger } from '../../../../shared/logger'
import type {
   FullSessionsUsageResult,
   CostUsageSummaryResult,
   FullSessionUsageTimeSeries,
   UsageSessionLogsResult,
   CostUsageTotals,
   SessionsUsageAggregates,
   SessionUsageEntry,
} from '../../../../shared/types/gateway-protocol'
import type {
   UsagePageState,
   UsagePageAction,
   UsageInsightStats,
   UsageFilterOptions,
   QuerySuggestion,
   SessionLogRole,
} from '../usage-types'
import {
   buildAggregatesFromSessions,
   buildUsageInsightStats,
   formatIsoDate,
   createEmptyCostUsageTotals,
   mergeCostUsageTotals,
} from '../usage-utils'
import { filterSessionsByQuery, buildQuerySuggestions } from '../usage-query'

const log = createLogger('UsagePage')

// ── 默认日期范围（最近 7 天） ──

function getDefaultDateRange(): { startDate: string; endDate: string } {
   const end = new Date()
   const start = new Date()
   start.setDate(start.getDate() - 7)
   return { startDate: formatIsoDate(start), endDate: formatIsoDate(end) }
}

const initialState: UsagePageState = {
   loading: false,
   error: null,
   usageResult: null,
   costSummary: null,
   ...getDefaultDateRange(),
   timeZone: 'local',
   chartMode: 'tokens',
   dailyChartMode: 'total',
   query: '',
   queryDraft: '',
   selectedSessions: [],
   selectedDays: [],
   selectedHours: [],
   sessionSort: 'cost',
   sessionSortDir: 'desc',
   sessionsTab: 'all',
   recentSessions: [],
   timeSeries: null,
   timeSeriesLoading: false,
   timeSeriesMode: 'cumulative',
   timeSeriesBreakdownMode: 'total',
   timeSeriesCursorStart: null,
   timeSeriesCursorEnd: null,
   sessionLogs: null,
   sessionLogsLoading: false,
   sessionLogsExpanded: false,
   logFilterRoles: [],
   logFilterTools: [],
   logFilterHasTools: false,
   logFilterQuery: '',
   headerPinned: false,
   contextExpanded: false,
}

// ── Reducer 辅助 ──

function toggleInArray<T>(arr: T[], item: T): T[] {
   return arr.includes(item)
      ? arr.filter((v) => v !== item)
      : [...arr, item]
}

// ── Reducer ──

function reducer(
   state: UsagePageState,
   action: UsagePageAction,
): UsagePageState {
   switch (action.type) {
      case 'SET_LOADING':
         return { ...state, loading: action.loading }

      case 'SET_ERROR':
         return { ...state, error: action.error }

      case 'SET_USAGE_DATA':
         return {
            ...state,
            usageResult: action.usageResult,
            costSummary: action.costSummary,
         }

      case 'SET_DATE_RANGE':
         return {
            ...state,
            startDate: action.startDate,
            endDate: action.endDate,
            selectedSessions: [],
            selectedDays: [],
            selectedHours: [],
         }

      case 'SET_TIME_ZONE':
         return {
            ...state,
            timeZone: action.timeZone,
            selectedHours: [],
         }

      case 'SET_CHART_MODE':
         return { ...state, chartMode: action.chartMode }

      case 'SET_DAILY_CHART_MODE':
         return { ...state, dailyChartMode: action.mode }

      case 'SET_QUERY':
         return { ...state, query: action.query }

      case 'SET_QUERY_DRAFT':
         return { ...state, queryDraft: action.queryDraft }

      case 'SELECT_SESSION': {
         if (action.shiftKey) {
            return {
               ...state,
               selectedSessions: toggleInArray(
                  state.selectedSessions,
                  action.key,
               ),
            }
         }
         const isSelected =
            state.selectedSessions.length === 1 &&
            state.selectedSessions[0] === action.key
         return {
            ...state,
            selectedSessions: isSelected ? [] : [action.key],
         }
      }

      case 'CLEAR_SESSIONS':
         return { ...state, selectedSessions: [] }

      case 'SELECT_DAY': {
         if (action.shiftKey) {
            return {
               ...state,
               selectedDays: toggleInArray(
                  state.selectedDays,
                  action.day,
               ),
            }
         }
         const isSelected =
            state.selectedDays.length === 1 &&
            state.selectedDays[0] === action.day
         return {
            ...state,
            selectedDays: isSelected ? [] : [action.day],
         }
      }

      case 'CLEAR_DAYS':
         return { ...state, selectedDays: [] }

      case 'SELECT_HOUR': {
         if (action.shiftKey) {
            return {
               ...state,
               selectedHours: toggleInArray(
                  state.selectedHours,
                  action.hour,
               ),
            }
         }
         const isSelected =
            state.selectedHours.length === 1 &&
            state.selectedHours[0] === action.hour
         return {
            ...state,
            selectedHours: isSelected ? [] : [action.hour],
         }
      }

      case 'CLEAR_HOURS':
         return { ...state, selectedHours: [] }

      case 'CLEAR_ALL_FILTERS':
         return {
            ...state,
            query: '',
            queryDraft: '',
            selectedSessions: [],
            selectedDays: [],
            selectedHours: [],
         }

      case 'SET_SESSION_SORT':
         return { ...state, sessionSort: action.sort }

      case 'SET_SESSION_SORT_DIR':
         return { ...state, sessionSortDir: action.dir }

      case 'SET_SESSIONS_TAB':
         return { ...state, sessionsTab: action.tab }

      case 'SET_TIMESERIES':
         return { ...state, timeSeries: action.timeSeries }

      case 'SET_TIMESERIES_LOADING':
         return { ...state, timeSeriesLoading: action.loading }

      case 'SET_TIMESERIES_MODE':
         return { ...state, timeSeriesMode: action.mode }

      case 'SET_TIMESERIES_BREAKDOWN':
         return { ...state, timeSeriesBreakdownMode: action.mode }

      case 'SET_TIMESERIES_CURSOR':
         return {
            ...state,
            timeSeriesCursorStart: action.start,
            timeSeriesCursorEnd: action.end,
         }

      case 'SET_SESSION_LOGS':
         return { ...state, sessionLogs: action.logs }

      case 'SET_SESSION_LOGS_LOADING':
         return { ...state, sessionLogsLoading: action.loading }

      case 'TOGGLE_SESSION_LOGS_EXPANDED':
         return {
            ...state,
            sessionLogsExpanded: !state.sessionLogsExpanded,
         }

      case 'SET_LOG_FILTER_ROLES':
         return { ...state, logFilterRoles: action.roles }

      case 'SET_LOG_FILTER_TOOLS':
         return { ...state, logFilterTools: action.tools }

      case 'SET_LOG_FILTER_HAS_TOOLS':
         return { ...state, logFilterHasTools: action.hasTools }

      case 'SET_LOG_FILTER_QUERY':
         return { ...state, logFilterQuery: action.query }

      case 'CLEAR_LOG_FILTERS':
         return {
            ...state,
            logFilterRoles: [],
            logFilterTools: [],
            logFilterHasTools: false,
            logFilterQuery: '',
         }

      case 'TOGGLE_HEADER_PINNED':
         return { ...state, headerPinned: !state.headerPinned }

      case 'TOGGLE_CONTEXT_EXPANDED':
         return { ...state, contextExpanded: !state.contextExpanded }

      case 'ADD_RECENT_SESSION':
         if (state.recentSessions.includes(action.key)) return state
         return {
            ...state,
            recentSessions: [action.key, ...state.recentSessions],
         }

      default:
         return state
   }
}

// ── Hook ──

export function useUsagePageState() {
   const [state, dispatch] = useReducer(reducer, initialState)
   const { connected, rpc } = useGateway()
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   const mountedRef = useRef(true)
   const initialLoadRef = useRef(false)
   const prevDateRef = useRef({
      startDate: state.startDate,
      endDate: state.endDate,
   })

   // 组件卸载时标记
   useEffect(() => {
      mountedRef.current = true
      return () => {
         mountedRef.current = false
      }
   }, [])

   // ── 数据加载 ──

   const loadUsage = useCallback(async () => {
      if (!connected) return
      dispatch({ type: 'SET_LOADING', loading: true })
      dispatch({ type: 'SET_ERROR', error: null })
      try {
         const [usageResult, costSummary] = await Promise.all([
            rpc<FullSessionsUsageResult>(RPC.SESSIONS_USAGE, {
               startDate: state.startDate,
               endDate: state.endDate,
               limit: 1000,
               includeContextWeight: true,
            }),
            rpc<CostUsageSummaryResult>(RPC.USAGE_COST, {
               startDate: state.startDate,
               endDate: state.endDate,
            }).catch((err: unknown) => {
               log.warn(
                  '加载费用汇总失败: %s',
                  String(err),
               )
               return null
            }),
         ])
         if (!mountedRef.current) return
         log.log(
            '数据加载完成: %d 个会话',
            usageResult.sessions?.length ?? 0,
         )
         dispatch({
            type: 'SET_USAGE_DATA',
            usageResult,
            costSummary,
         })
      } catch (err: unknown) {
         if (!mountedRef.current) return
         const message =
            err instanceof Error ? err.message : '加载使用数据失败'
         log.error('数据加载错误: %s', message)
         dispatch({ type: 'SET_ERROR', error: message })
      } finally {
         if (mountedRef.current) {
            dispatch({ type: 'SET_LOADING', loading: false })
         }
      }
   }, [connected, rpc, state.startDate, state.endDate])

   // 挂载时自动加载（连接就绪后）
   useEffect(() => {
      if (connected && !initialLoadRef.current) {
         initialLoadRef.current = true
         loadUsage()
      }
   }, [connected, loadUsage])

   // 日期范围变更后防抖加载（400ms）
   useEffect(() => {
      const prev = prevDateRef.current
      if (
         prev.startDate === state.startDate &&
         prev.endDate === state.endDate
      ) {
         return
      }
      prevDateRef.current = {
         startDate: state.startDate,
         endDate: state.endDate,
      }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
         loadUsage()
      }, 400)
      return () => {
         if (debounceRef.current) {
            clearTimeout(debounceRef.current)
            debounceRef.current = null
         }
      }
   }, [state.startDate, state.endDate, loadUsage])

   // ── 会话详情加载 ──

   const loadSessionDetail = useCallback(
      async (key: string) => {
         if (!connected) return
         dispatch({ type: 'SET_TIMESERIES_LOADING', loading: true })
         dispatch({
            type: 'SET_SESSION_LOGS_LOADING',
            loading: true,
         })
         dispatch({ type: 'SET_TIMESERIES', timeSeries: null })
         dispatch({ type: 'SET_SESSION_LOGS', logs: null })
         try {
            const [timeSeries, logsResult] = await Promise.all([
               rpc<FullSessionUsageTimeSeries>(
                  RPC.SESSIONS_USAGE_TIMESERIES,
                  { key },
               ).catch((err: unknown) => {
                  log.warn(
                     '加载时间序列失败: %s',
                     String(err),
                  )
                  return null
               }),
               rpc<UsageSessionLogsResult>(
                  RPC.SESSIONS_USAGE_LOGS,
                  { key },
               ).catch((err: unknown) => {
                  log.warn(
                     '加载会话日志失败: %s',
                     String(err),
                  )
                  return null
               }),
            ])
            if (!mountedRef.current) return
            dispatch({
               type: 'SET_TIMESERIES',
               timeSeries: timeSeries ?? null,
            })
            dispatch({
               type: 'SET_SESSION_LOGS',
               logs: logsResult?.logs ?? null,
            })
         } catch (err: unknown) {
            if (!mountedRef.current) return
            log.error(
               '加载会话详情失败: %s',
               String(err),
            )
         } finally {
            if (mountedRef.current) {
               dispatch({
                  type: 'SET_TIMESERIES_LOADING',
                  loading: false,
               })
               dispatch({
                  type: 'SET_SESSION_LOGS_LOADING',
                  loading: false,
               })
            }
         }
      },
      [connected, rpc],
   )

   // 选中单个会话时自动加载详情
   useEffect(() => {
      if (state.selectedSessions.length === 1) {
         const key = state.selectedSessions[0]
         dispatch({ type: 'ADD_RECENT_SESSION', key })
         loadSessionDetail(key)
      }
   }, [state.selectedSessions, loadSessionDetail])

   // ── 派生数据 (useMemo) ──

   // 1. 通过查询过滤会话
   const { filteredSessions, queryWarnings } = useMemo(() => {
      const sessions = state.usageResult?.sessions ?? []
      if (!state.query.trim()) {
         return {
            filteredSessions: sessions,
            queryWarnings: [] as string[],
         }
      }
      const result = filterSessionsByQuery(sessions, state.query)
      return {
         filteredSessions: result.sessions,
         queryWarnings: result.warnings,
      }
   }, [state.usageResult?.sessions, state.query])

   // 2. 按选中日期过滤
   const dayFilteredSessions = useMemo(() => {
      if (state.selectedDays.length === 0) return filteredSessions
      return filteredSessions.filter((s) => {
         const dates = s.usage?.activityDates
         if (dates) {
            return state.selectedDays.some((d) => dates.includes(d))
         }
         if (s.updatedAt) {
            const dateStr = formatIsoDate(new Date(s.updatedAt))
            return state.selectedDays.includes(dateStr)
         }
         return false
      })
   }, [filteredSessions, state.selectedDays])

   // 3. 按选中小时过滤（检查会话活动窗口是否与选中小时重叠）
   const hourFilteredSessions = useMemo(() => {
      if (state.selectedHours.length === 0) {
         return dayFilteredSessions
      }
      return dayFilteredSessions.filter((s) => {
         const start = s.usage?.firstActivity ?? s.updatedAt
         const end = s.usage?.lastActivity ?? s.updatedAt
         if (!start || !end) return false
         const hours = new Set<number>()
         let cursor = Math.min(start, end)
         const endMs = Math.max(start, end)
         while (cursor <= endMs) {
            const d = new Date(cursor)
            hours.add(
               state.timeZone === 'utc'
                  ? d.getUTCHours()
                  : d.getHours(),
            )
            cursor += 3600000
         }
         return state.selectedHours.some((h) => hours.has(h))
      })
   }, [dayFilteredSessions, state.selectedHours, state.timeZone])

   // 4. 活跃会话：若有选中会话则只取选中的，否则取过滤后全部
   const activeSessions = useMemo(() => {
      if (state.selectedSessions.length === 0) {
         return hourFilteredSessions
      }
      const set = new Set(state.selectedSessions)
      return hourFilteredSessions.filter((s) => set.has(s.key))
   }, [hourFilteredSessions, state.selectedSessions])

   // 5. 显示的总计
   const displayTotals = useMemo<CostUsageTotals | null>(() => {
      if (activeSessions.length === 0) {
         return state.usageResult?.totals ?? null
      }
      const totals = createEmptyCostUsageTotals()
      for (const s of activeSessions) {
         if (s.usage) mergeCostUsageTotals(totals, s.usage)
      }
      return totals
   }, [activeSessions, state.usageResult?.totals])

   // 6. 活跃聚合
   const activeAggregates = useMemo<
      SessionsUsageAggregates | null
   >(() => {
      if (!state.usageResult) return null
      const totalLen = state.usageResult.sessions?.length ?? 0
      const isFiltered = activeSessions.length !== totalLen
      if (!isFiltered) return state.usageResult.aggregates
      return buildAggregatesFromSessions(
         activeSessions,
         state.usageResult.aggregates,
      )
   }, [activeSessions, state.usageResult])

   // 7. 洞察统计
   const insightStats = useMemo<UsageInsightStats | null>(() => {
      if (!activeAggregates || !displayTotals) return null
      return buildUsageInsightStats(
         activeSessions,
         displayTotals,
         activeAggregates,
      )
   }, [activeSessions, displayTotals, activeAggregates])

   // 8. 过滤选项
   const filterOptions = useMemo<UsageFilterOptions>(() => {
      const sessions = state.usageResult?.sessions ?? []
      const agg = state.usageResult?.aggregates
      const unique = (items: (string | undefined)[]) =>
         [...new Set(items.filter((v): v is string => !!v))]
      return {
         agents: unique(sessions.map((s) => s.agentId)),
         channels: unique(sessions.map((s) => s.channel)),
         providers: unique([
            ...sessions.map((s) => s.modelProvider),
            ...sessions.map((s) => s.providerOverride),
            ...(agg?.byProvider.map((p) => p.provider) ?? []),
         ]),
         models: unique([
            ...sessions.map((s) => s.model),
            ...(agg?.byModel.map((m) => m.model) ?? []),
         ]),
         tools: unique(
            agg?.tools.tools.map((t) => t.name) ?? [],
         ),
      }
   }, [state.usageResult])

   // 9. 查询建议
   const querySuggestions = useMemo<QuerySuggestion[]>(() => {
      if (!state.queryDraft.trim()) return []
      return buildQuerySuggestions(
         state.queryDraft,
         state.usageResult?.sessions ?? [],
         state.usageResult?.aggregates,
      )
   }, [state.queryDraft, state.usageResult])

   // 10. 会话数量是否达到上限
   const sessionsLimitReached = useMemo(
      () => (state.usageResult?.sessions?.length ?? 0) >= 1000,
      [state.usageResult],
   )

   // 11. 主要选中的会话（详情面板用）
   const primarySelectedSession = useMemo<
      SessionUsageEntry | null
   >(() => {
      if (state.selectedSessions.length !== 1) return null
      const key = state.selectedSessions[0]
      return (
         (state.usageResult?.sessions ?? []).find(
            (s) => s.key === key,
         ) ?? null
      )
   }, [state.selectedSessions, state.usageResult?.sessions])

   // ── Dispatch 包装回调 ──

   const onRefresh = useCallback(() => {
      loadUsage()
   }, [loadUsage])

   const onStartDateChange = useCallback(
      (startDate: string) => {
         dispatch({
            type: 'SET_DATE_RANGE',
            startDate,
            endDate: state.endDate,
         })
      },
      [state.endDate],
   )

   const onEndDateChange = useCallback(
      (endDate: string) => {
         dispatch({
            type: 'SET_DATE_RANGE',
            startDate: state.startDate,
            endDate,
         })
      },
      [state.startDate],
   )

   const onTimeZoneChange = useCallback(
      (timeZone: 'local' | 'utc') => {
         dispatch({ type: 'SET_TIME_ZONE', timeZone })
      },
      [],
   )

   const onChartModeChange = useCallback(
      (chartMode: 'tokens' | 'cost') => {
         dispatch({ type: 'SET_CHART_MODE', chartMode })
      },
      [],
   )

   const onDailyChartModeChange = useCallback(
      (mode: 'total' | 'by-type') => {
         dispatch({ type: 'SET_DAILY_CHART_MODE', mode })
      },
      [],
   )

   const onQueryDraftChange = useCallback(
      (queryDraft: string) => {
         dispatch({ type: 'SET_QUERY_DRAFT', queryDraft })
      },
      [],
   )

   const onApplyQuery = useCallback(() => {
      dispatch({ type: 'SET_QUERY', query: state.queryDraft })
   }, [state.queryDraft])

   const onClearQuery = useCallback(() => {
      dispatch({ type: 'SET_QUERY', query: '' })
      dispatch({ type: 'SET_QUERY_DRAFT', queryDraft: '' })
   }, [])

   const onSelectSession = useCallback(
      (key: string, shiftKey: boolean) => {
         dispatch({ type: 'SELECT_SESSION', key, shiftKey })
      },
      [],
   )

   const onClearSessions = useCallback(() => {
      dispatch({ type: 'CLEAR_SESSIONS' })
   }, [])

   const onSelectDay = useCallback(
      (day: string, shiftKey: boolean) => {
         dispatch({ type: 'SELECT_DAY', day, shiftKey })
      },
      [],
   )

   const onClearDays = useCallback(() => {
      dispatch({ type: 'CLEAR_DAYS' })
   }, [])

   const onSelectHour = useCallback(
      (hour: number, shiftKey: boolean) => {
         dispatch({ type: 'SELECT_HOUR', hour, shiftKey })
      },
      [],
   )

   const onClearHours = useCallback(() => {
      dispatch({ type: 'CLEAR_HOURS' })
   }, [])

   const onClearAllFilters = useCallback(() => {
      dispatch({ type: 'CLEAR_ALL_FILTERS' })
   }, [])

   const onSessionSortChange = useCallback(
      (sort: UsagePageState['sessionSort']) => {
         dispatch({ type: 'SET_SESSION_SORT', sort })
      },
      [],
   )

   const onSessionSortDirChange = useCallback(
      (dir: 'asc' | 'desc') => {
         dispatch({ type: 'SET_SESSION_SORT_DIR', dir })
      },
      [],
   )

   const onSessionsTabChange = useCallback(
      (tab: 'all' | 'recent') => {
         dispatch({ type: 'SET_SESSIONS_TAB', tab })
      },
      [],
   )

   const onTimeSeriesModeChange = useCallback(
      (mode: 'cumulative' | 'per-turn') => {
         dispatch({ type: 'SET_TIMESERIES_MODE', mode })
      },
      [],
   )

   const onTimeSeriesBreakdownChange = useCallback(
      (mode: 'total' | 'by-type') => {
         dispatch({ type: 'SET_TIMESERIES_BREAKDOWN', mode })
      },
      [],
   )

   const onTimeSeriesCursorChange = useCallback(
      (start: number | null, end: number | null) => {
         dispatch({
            type: 'SET_TIMESERIES_CURSOR',
            start,
            end,
         })
      },
      [],
   )

   const onToggleSessionLogsExpanded = useCallback(() => {
      dispatch({ type: 'TOGGLE_SESSION_LOGS_EXPANDED' })
   }, [])

   const onLogFilterRolesChange = useCallback(
      (roles: SessionLogRole[]) => {
         dispatch({ type: 'SET_LOG_FILTER_ROLES', roles })
      },
      [],
   )

   const onLogFilterToolsChange = useCallback(
      (tools: string[]) => {
         dispatch({ type: 'SET_LOG_FILTER_TOOLS', tools })
      },
      [],
   )

   const onLogFilterHasToolsChange = useCallback(
      (hasTools: boolean) => {
         dispatch({
            type: 'SET_LOG_FILTER_HAS_TOOLS',
            hasTools,
         })
      },
      [],
   )

   const onLogFilterQueryChange = useCallback(
      (query: string) => {
         dispatch({ type: 'SET_LOG_FILTER_QUERY', query })
      },
      [],
   )

   const onClearLogFilters = useCallback(() => {
      dispatch({ type: 'CLEAR_LOG_FILTERS' })
   }, [])

   const onToggleHeaderPinned = useCallback(() => {
      dispatch({ type: 'TOGGLE_HEADER_PINNED' })
   }, [])

   const onToggleContextExpanded = useCallback(() => {
      dispatch({ type: 'TOGGLE_CONTEXT_EXPANDED' })
   }, [])

   // ── 返回 ──

   return {
      // 原始状态
      state,

      // 派生数据
      filteredSessions,
      queryWarnings,
      dayFilteredSessions,
      hourFilteredSessions,
      activeSessions,
      displayTotals,
      activeAggregates,
      insightStats,
      filterOptions,
      querySuggestions,
      sessionsLimitReached,
      primarySelectedSession,

      // 数据加载
      loadUsage,
      loadSessionDetail,

      // Dispatch 包装回调
      onRefresh,
      onStartDateChange,
      onEndDateChange,
      onTimeZoneChange,
      onChartModeChange,
      onDailyChartModeChange,
      onQueryDraftChange,
      onApplyQuery,
      onClearQuery,
      onSelectSession,
      onClearSessions,
      onSelectDay,
      onClearDays,
      onSelectHour,
      onClearHours,
      onClearAllFilters,
      onSessionSortChange,
      onSessionSortDirChange,
      onSessionsTabChange,
      onTimeSeriesModeChange,
      onTimeSeriesBreakdownChange,
      onTimeSeriesCursorChange,
      onToggleSessionLogsExpanded,
      onLogFilterRolesChange,
      onLogFilterToolsChange,
      onLogFilterHasToolsChange,
      onLogFilterQueryChange,
      onClearLogFilters,
      onToggleHeaderPinned,
      onToggleContextExpanded,
   }
}

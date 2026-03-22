import type {
   FullSessionsUsageResult,
   CostUsageSummaryResult,
   FullSessionUsageTimeSeries,
   UsageSessionLogEntry,
   CostUsageTotals,
   SessionsUsageAggregates,
   SessionUsageEntry,
   SessionMessageCounts,
   SessionToolUsage,
   SessionModelUsage,
   SessionLatencyStats,
   CostUsageDailyEntry,
} from '../../../shared/types/gateway-protocol'

export type {
   FullSessionsUsageResult,
   CostUsageSummaryResult,
   FullSessionUsageTimeSeries,
   UsageSessionLogEntry,
   CostUsageTotals,
   SessionsUsageAggregates,
   SessionUsageEntry,
   SessionMessageCounts,
   SessionToolUsage,
   SessionModelUsage,
   SessionLatencyStats,
   CostUsageDailyEntry,
}

export type SessionLogRole = 'user' | 'assistant' | 'tool' | 'toolResult'

export type UsageColumnId =
   | 'channel'
   | 'agent'
   | 'provider'
   | 'model'
   | 'messages'
   | 'tools'
   | 'errors'
   | 'duration'

export type QuerySuggestion = { label: string; value: string }

export interface UsageMosaicStats {
   hasData: boolean
   totalTokens: number
   hourTotals: number[]
   weekdayTotals: Array<{ label: string; tokens: number }>
}

export interface UsageInsightStats {
   durationSumMs: number
   durationCount: number
   avgDurationMs: number
   throughputTokensPerMin?: number
   throughputCostPerMin?: number
   errorRate: number
   peakErrorDay?: { date: string; errors: number; messages: number; rate: number }
}

export interface UsageFilterOptions {
   agents: string[]
   channels: string[]
   providers: string[]
   models: string[]
   tools: string[]
}

export interface UsagePageState {
   // 数据加载
   loading: boolean
   error: string | null
   usageResult: FullSessionsUsageResult | null
   costSummary: CostUsageSummaryResult | null

   // 日期范围
   startDate: string
   endDate: string
   timeZone: 'local' | 'utc'

   // 显示模式
   chartMode: 'tokens' | 'cost'
   dailyChartMode: 'total' | 'by-type'

   // 过滤/查询
   query: string
   queryDraft: string

   // 选中状态
   selectedSessions: string[]
   selectedDays: string[]
   selectedHours: number[]

   // 会话列表控制
   sessionSort: 'tokens' | 'cost' | 'recent' | 'messages' | 'errors'
   sessionSortDir: 'asc' | 'desc'
   sessionsTab: 'all' | 'recent'
   recentSessions: string[]

   // 会话详情
   timeSeries: FullSessionUsageTimeSeries | null
   timeSeriesLoading: boolean
   timeSeriesMode: 'cumulative' | 'per-turn'
   timeSeriesBreakdownMode: 'total' | 'by-type'
   timeSeriesCursorStart: number | null
   timeSeriesCursorEnd: number | null
   sessionLogs: UsageSessionLogEntry[] | null
   sessionLogsLoading: boolean
   sessionLogsExpanded: boolean

   // 日志过滤
   logFilterRoles: SessionLogRole[]
   logFilterTools: string[]
   logFilterHasTools: boolean
   logFilterQuery: string

   // UI 状态
   headerPinned: boolean
   contextExpanded: boolean
}

// 定义 reducer 所有 action 类型
export type UsagePageAction =
   | { type: 'SET_LOADING'; loading: boolean }
   | { type: 'SET_ERROR'; error: string | null }
   | {
        type: 'SET_USAGE_DATA'
        usageResult: FullSessionsUsageResult
        costSummary: CostUsageSummaryResult | null
     }
   | { type: 'SET_DATE_RANGE'; startDate: string; endDate: string }
   | { type: 'SET_TIME_ZONE'; timeZone: 'local' | 'utc' }
   | { type: 'SET_CHART_MODE'; chartMode: 'tokens' | 'cost' }
   | { type: 'SET_DAILY_CHART_MODE'; mode: 'total' | 'by-type' }
   | { type: 'SET_QUERY'; query: string }
   | { type: 'SET_QUERY_DRAFT'; queryDraft: string }
   | { type: 'SELECT_SESSION'; key: string; shiftKey: boolean }
   | { type: 'CLEAR_SESSIONS' }
   | { type: 'SELECT_DAY'; day: string; shiftKey: boolean }
   | { type: 'CLEAR_DAYS' }
   | { type: 'SELECT_HOUR'; hour: number; shiftKey: boolean }
   | { type: 'CLEAR_HOURS' }
   | { type: 'CLEAR_ALL_FILTERS' }
   | { type: 'SET_SESSION_SORT'; sort: UsagePageState['sessionSort'] }
   | { type: 'SET_SESSION_SORT_DIR'; dir: 'asc' | 'desc' }
   | { type: 'SET_SESSIONS_TAB'; tab: 'all' | 'recent' }
   | { type: 'SET_TIMESERIES'; timeSeries: FullSessionUsageTimeSeries | null }
   | { type: 'SET_TIMESERIES_LOADING'; loading: boolean }
   | { type: 'SET_TIMESERIES_MODE'; mode: 'cumulative' | 'per-turn' }
   | { type: 'SET_TIMESERIES_BREAKDOWN'; mode: 'total' | 'by-type' }
   | { type: 'SET_TIMESERIES_CURSOR'; start: number | null; end: number | null }
   | { type: 'SET_SESSION_LOGS'; logs: UsageSessionLogEntry[] | null }
   | { type: 'SET_SESSION_LOGS_LOADING'; loading: boolean }
   | { type: 'TOGGLE_SESSION_LOGS_EXPANDED' }
   | { type: 'SET_LOG_FILTER_ROLES'; roles: SessionLogRole[] }
   | { type: 'SET_LOG_FILTER_TOOLS'; tools: string[] }
   | { type: 'SET_LOG_FILTER_HAS_TOOLS'; hasTools: boolean }
   | { type: 'SET_LOG_FILTER_QUERY'; query: string }
   | { type: 'CLEAR_LOG_FILTERS' }
   | { type: 'TOGGLE_HEADER_PINNED' }
   | { type: 'TOGGLE_CONTEXT_EXPANDED' }
   | { type: 'ADD_RECENT_SESSION'; key: string }
